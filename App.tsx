import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Player, Card, GamePhase, ActionType, PlayerStats, LobbyConfig, PlayerConfig } from './types';
import * as api from './services/apiService';
import PokerTable from './components/PokerTable';
import GameSetup from './components/GameSetup';
import GameLobby from './components/GameLobby';
import WinnerModal from './components/WinnerModal';
import GameOverModal from './components/GameOverModal';
import ExitConfirmationModal from './components/ExitConfirmationModal';
import ActionButtons from './components/ActionButtons';
import TurnTransitionModal from './components/TurnTransitionModal';
import playSound, { SoundEffect } from './services/audioService';

const CURRENT_USER_ID_KEY = 'gemini-poker-club-userId';

type AppStage = 'setup' | 'lobby' | 'playing';

const App: React.FC = () => {
    const [appStage, setAppStage] = useState<AppStage>('setup');
    const [lobbyId, setLobbyId] = useState<string | null>(null);
    const [lobbyConfig, setLobbyConfig] = useState<LobbyConfig | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isThinking, setIsThinking] = useState(false);
    const [winners, setWinners] = useState<Player[]>([]);
    const [winningHand, setWinningHand] = useState('');
    const [isGameOver, setIsGameOver] = useState(false);
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isTurnAcknowledged, setIsTurnAcknowledged] = useState(false);
    const ws = useRef<WebSocket | null>(null);
    const prevGameState = useRef<GameState | null>(null);

    useEffect(() => {
        setCurrentUserId(sessionStorage.getItem(CURRENT_USER_ID_KEY));
        const params = new URLSearchParams(window.location.search);
        const lobbyIdFromUrl = params.get('lobby');

        if (lobbyIdFromUrl) {
            setLobbyId(lobbyIdFromUrl);
            api.getLobby(lobbyIdFromUrl)
                .then(config => {
                    setLobbyConfig(config);
                    setAppStage('lobby');
                })
                .catch(err => {
                    console.error("Failed to fetch lobby, returning to setup.", err);
                    window.history.replaceState({}, '', window.location.pathname);
                });
        }
    }, []);
    
    useEffect(() => {
        // Sound effect logic based on state changes
        if (!gameState || !prevGameState.current) {
            prevGameState.current = gameState;
            return;
        }
        if (gameState.pot > prevGameState.current.pot) playSound(SoundEffect.BET);
        if (gameState.communityCards.length > prevGameState.current.communityCards.length) playSound(SoundEffect.DEAL);
        const foldedPlayer = gameState.players.find((p, i) => p.isFolded && !prevGameState.current?.players[i]?.isFolded);
        if (foldedPlayer) playSound(SoundEffect.FOLD);
        
        // When the current player changes, reset the acknowledgement flag.
        if (gameState.currentPlayerIndex !== prevGameState.current.currentPlayerIndex) {
            setIsTurnAcknowledged(false);
        }

        prevGameState.current = gameState;
    }, [gameState]);


    const connectWebSocket = useCallback((lId: string, pId: string) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            return;
        }
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = 'localhost:8000'; // Target the backend server directly
        const wsUrl = `${wsProtocol}//${wsHost}/ws/${lId}/${pId}`;
        
        ws.current = new WebSocket(wsUrl);

        ws.current.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'LOBBY_UPDATE') {
                setLobbyConfig(data.lobby);
            } else if (data.type === 'GAME_START') {
                setGameState(data.game_state);
                setIsTurnAcknowledged(false); // Ensure modal shows for first player
                setAppStage('playing');
                playSound(SoundEffect.SHUFFLE);
            } else if (data.type === 'GAME_STATE_UPDATE') {
                setIsThinking(data.game_state.players[data.game_state.currentPlayerIndex]?.isAI ?? false);
                setGameState(data.game_state);
            } else if (data.type === 'WINNER_ANNOUNCEMENT') {
                setGameState(data.game_state); // update final chip counts
                setWinners(data.winners);
                setWinningHand(data.winning_hand);
                playSound(SoundEffect.WIN);
                setTimeout(() => {
                    setWinners([]);
                    setWinningHand('');
                }, 5000);
            } else if (data.type === 'GAME_OVER') {
                setIsGameOver(true);
                setWinners(data.winners);
            } else if (data.type === 'ERROR') {
                console.error("Server error:", data.message);
            }
        };

        ws.current.onclose = () => console.log('WebSocket disconnected');
        ws.current.onerror = (error) => console.error('WebSocket error:', error);

    }, []);

    const handleCreateLobby = async (hostConfig: PlayerConfig, smallBlind: number, bigBlind: number) => {
        try {
            const newLobby = await api.createLobby(hostConfig, smallBlind, bigBlind);
            
            const newLobbyId = newLobby.id;
            const host = newLobby.players.find(p => p.isHost);

            if (!newLobbyId || !host) {
                throw new Error("Invalid lobby data received from server.");
            }
            const newUserId = host.id;
            
            sessionStorage.setItem(CURRENT_USER_ID_KEY, newUserId);
            setCurrentUserId(newUserId);
            setLobbyId(newLobbyId);
            setLobbyConfig(newLobby);
            window.history.pushState({}, '', `?lobby=${newLobbyId}`);
            
            connectWebSocket(newLobbyId, newUserId);
            setAppStage('lobby');
        } catch (error) {
            console.error("Failed to create lobby:", error);
        }
    };

    const handleJoinLobby = async (name: string, chips: number) => {
        if (!lobbyId) return;
        try {
            const { player } = await api.joinLobby(lobbyId, name, chips);
            const newUserId = player.id;
            sessionStorage.setItem(CURRENT_USER_ID_KEY, newUserId);
            setCurrentUserId(newUserId);
            connectWebSocket(lobbyId, newUserId);
        } catch (error) {
            console.error("Failed to join lobby:", error);
        }
    };
    
    const handleStartGame = () => {
        if (lobbyId) api.startGame(lobbyId).catch(err => console.error("Failed to start game", err));
    };

    const handlePlayerAction = (action: ActionType, amount: number) => {
        if (lobbyId && currentUserId) {
            api.sendPlayerAction(lobbyId, currentUserId, action, amount)
                .catch(err => console.error("Failed to send action:", err));
        }
    };

    const handleEndGame = () => {
        ws.current?.close();
        ws.current = null;
        setIsExitModalOpen(false);
        setIsGameOver(false);
        setGameState(null);
        setLobbyConfig(null);
        setLobbyId(null);
        setWinners([]);
        setWinningHand('');
        setCurrentUserId(null);
        sessionStorage.removeItem(CURRENT_USER_ID_KEY);
        window.history.replaceState({}, '', window.location.pathname);
        setAppStage('setup');
    };
    
    const handleAddAI = () => {
      if (lobbyId) api.addAiPlayer(lobbyId).catch(err => console.error("Failed to add AI", err));
    }
    
    const handleRemovePlayer = (playerId: string) => {
        if(lobbyId) api.removePlayer(lobbyId, playerId).catch(err => console.error("Failed to remove player", err));
    }

    const handleRequestExit = () => setIsExitModalOpen(true);
    const handleCancelExit = () => setIsExitModalOpen(false);

    if (appStage === 'setup') {
        return <GameSetup onCreateLobby={handleCreateLobby} />;
    }
    
    if (appStage === 'lobby' && lobbyConfig) {
        return <GameLobby 
            lobbyConfig={lobbyConfig} 
            onStartGame={handleStartGame} 
            onLeaveLobby={handleEndGame}
            currentUserId={currentUserId}
            onJoinLobby={handleJoinLobby}
            onAddAI={handleAddAI}
            onRemovePlayer={handleRemovePlayer}
        />;
    }

    if (appStage === 'playing' && gameState) {
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        const isMyTurn = currentPlayer && !currentPlayer.isAI && currentPlayer.id === currentUserId;
        const isGameActive = gameState.gamePhase !== GamePhase.SHOWDOWN && gameState.gamePhase !== GamePhase.SETUP;
        const showTurnModal = isMyTurn && !isTurnAcknowledged && isGameActive;

        const getPlayerCardVisibility = (player: Player): boolean => {
            if (gameState.gamePhase === GamePhase.SHOWDOWN) {
                return !player.isFolded;
            }
            // For pass-and-play, only show cards if it is that player's turn and they have acknowledged it.
            const isThisPlayersTurn = player.id === currentPlayer?.id;
            if (isThisPlayersTurn && !player.isAI) {
                return isTurnAcknowledged;
            }
            return false;
        };

        return (
            <div className="bg-[#0A0A0A] min-h-screen w-full flex flex-col items-center justify-center font-sans text-white p-4 overflow-hidden">
                <div className="w-full flex-grow flex flex-col items-center justify-center">
                    <PokerTable 
                        gameState={gameState} 
                        playerStats={gameState.playerStats || {}}
                        isThinking={isThinking}
                        onRequestExit={handleRequestExit} 
                        getPlayerCardVisibility={getPlayerCardVisibility}
                    />
                    <div className="relative z-20 mt-6 h-[170px] flex items-center justify-center">
                        {isGameActive && currentPlayer && (
                            <ActionButtons 
                                player={currentPlayer} 
                                gameState={gameState} 
                                onAction={handlePlayerAction}
                                disabled={!isMyTurn || isThinking || showTurnModal}
                            />
                        )}
                    </div>
                </div>
                {showTurnModal && (
                    <TurnTransitionModal 
                        playerName={currentPlayer.name} 
                        onConfirm={() => {
                            setIsTurnAcknowledged(true);
                            playSound(SoundEffect.DEAL); // Sound for revealing your cards
                        }} 
                    />
                )}
                {isGameOver && winners.length > 0 && <GameOverModal winner={winners[0]} onRestart={handleEndGame} />}
                {!isGameOver && winners.length > 0 && <WinnerModal winners={winners} hand={winningHand} />}
                {isExitModalOpen && <ExitConfirmationModal onConfirm={handleEndGame} onCancel={handleCancelExit} />}
            </div>
        );
    }

    return <div className="flex items-center justify-center min-h-screen text-xl">Connecting...</div>;
};

export default App;