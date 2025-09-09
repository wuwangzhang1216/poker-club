import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Player, Card, GamePhase, ActionType, PlayerStats, PlayerConfig, AIDifficulty } from './types';
import * as pokerLogic from './services/pokerLogic';
import * as geminiService from './services/geminiService';
import PokerTable from './components/PokerTable';
import GameSetup from './components/GameSetup';
import GameOverModal from './components/GameOverModal';
import ExitConfirmationModal from './components/ExitConfirmationModal';
import ActionButtons from './components/ActionButtons';
import audioService, { SoundEffect } from './services/audioService';

const App: React.FC = () => {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isThinking, setIsThinking] = useState(false);
    const [winners, setWinners] = useState<Player[]>([]);
    const [winningHand, setWinningHand] = useState('');
    const [isGameOver, setIsGameOver] = useState(false);
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);
    const [playerStats, setPlayerStats] = useState<Record<string, PlayerStats>>({});
    const prevGameState = useRef<GameState | null>(null);
    const humanPlayerId = useRef<string | null>(null);
    const isGameActive = useRef(false); // New ref to track game status

    useEffect(() => {
        // Preload sounds when the app first mounts
        audioService.loadSounds();
    }, []);

    const handleAITurn = useCallback(async (state: GameState) => {
        const currentPlayer = state.players[state.currentPlayerIndex];
        if (!currentPlayer || !currentPlayer.isAI || currentPlayer.isFolded || currentPlayer.chips === 0) {
            return;
        }

        setIsThinking(true);
        // Add a small delay for more natural pacing
        await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
        
        // Abort AI action if the game has been exited during the delay
        if (!isGameActive.current) {
            setIsThinking(false);
            return;
        }

        try {
            const { action, amount } = await geminiService.getAIPlayerAction(state, currentPlayer);
            const newState = pokerLogic.handlePlayerAction(state, currentPlayer.id, action, amount);
            if (isGameActive.current) { // Check again before setting state
                setGameState(newState);
            }
        } catch (error) {
            console.error("Error getting AI action, AI will check or fold.", error);
            // Fallback action if API fails
            const fallbackAction = state.currentBet > currentPlayer.bet ? ActionType.FOLD : ActionType.CHECK;
            const newState = pokerLogic.handlePlayerAction(state, currentPlayer.id, fallbackAction, 0);
            if (isGameActive.current) { // Check again before setting state
                setGameState(newState);
            }
        } finally {
            if (isGameActive.current) { // Only update if game is still active
                setIsThinking(false);
            }
        }
    }, []);
    
    useEffect(() => {
        if (!gameState || isGameOver || winners.length > 0) {
            prevGameState.current = gameState;
            return;
        }
        
        const activePlayers = gameState.players.filter(p => !p.isFolded);

        // --- Sound effect logic ---
        if (prevGameState.current) {
            const handIsConcluding = gameState.gamePhase === GamePhase.SHOWDOWN || activePlayers.length <= 1;

            if (!handIsConcluding) {
                // Bet/Call/Raise sound
                if (gameState.pot > prevGameState.current.pot) {
                    audioService.playSound(SoundEffect.BET);
                }
                
                // Check sound
                const lastActorIndex = prevGameState.current.currentPlayerIndex;
                const actorNow = gameState.players[lastActorIndex];
                const actorBefore = prevGameState.current.players[lastActorIndex];
                if (actorNow?.action === ActionType.CHECK && actorNow.hasActed && !actorBefore?.hasActed) {
                    audioService.playSound(SoundEffect.CHECK);
                }

                // Fold sound
                const foldedPlayer = gameState.players.find((p, i) => p.isFolded && !prevGameState.current?.players[i]?.isFolded);
                if (foldedPlayer) {
                    audioService.playSound(SoundEffect.FOLD);
                }
            }

            // Deal sound
            if (gameState.communityCards.length > prevGameState.current.communityCards.length) {
                audioService.playSound(SoundEffect.DEAL);
            }
        }


        // --- Continuously calculate stats for the human player ---
        const humanPlayer = gameState.players.find(p => !p.isAI);
        if (humanPlayer) {
            const activePhases = [GamePhase.PRE_FLOP, GamePhase.FLOP, GamePhase.TURN, GamePhase.RIVER];
            if (!humanPlayer.isFolded && activePhases.includes(gameState.gamePhase)) {
                const stats = pokerLogic.calculateStats(
                    humanPlayer,
                    gameState.communityCards,
                    gameState.players.filter(p => !p.isFolded).length
                );
                setPlayerStats({ [humanPlayer.id]: stats });
            } else {
                // Clear stats if player folded or hand is over
                setPlayerStats({});
            }
        }

        // --- Game flow logic ---
        // Hand ends because everyone else folded
        if (activePlayers.length <= 1 && gameState.gamePhase !== GamePhase.SETUP && gameState.gamePhase !== GamePhase.SHOWDOWN) {
            setWinners(activePlayers);
            setWinningHand('the last one standing');
            audioService.playSound(SoundEffect.WIN);

            setTimeout(() => {
                // Now, update the state: distribute pot, reset pot, etc.
                const stateAfterWin = pokerLogic.endHand(gameState);
                const playersWithChips = stateAfterWin.players.filter(p => p.chips > 0);
                
                if (playersWithChips.length <= 1) {
                    setIsGameOver(true);
                    setWinners(playersWithChips);
                    setGameState(stateAfterWin); // Set final state for game over modal
                } else {
                    setWinners([]);
                    setWinningHand('');
                    setGameState(pokerLogic.startNewHand(stateAfterWin));
                    audioService.playSound(SoundEffect.SHUFFLE);
                }
            }, 3000); // Wait for chip animation to winner

        // Hand ends because it reached showdown
        } else if (gameState.gamePhase === GamePhase.SHOWDOWN) {
            const { winners, winningHandName } = pokerLogic.determineWinner(gameState);
            setWinners(winners);
            setWinningHand(winningHandName);
            audioService.playSound(SoundEffect.WIN);
            
            setTimeout(() => {
                // Now, update the state: distribute pot, reset pot, etc.
                const stateAfterWin = pokerLogic.endHand(gameState);
                const playersWithChips = stateAfterWin.players.filter(p => p.chips > 0);
                
                if (playersWithChips.length <= 1) {
                    setIsGameOver(true);
                    setWinners(playersWithChips);
                    setGameState(stateAfterWin);
                } else {
                    setWinners([]);
                    setWinningHand('');
                    setGameState(pokerLogic.startNewHand(stateAfterWin));
                    audioService.playSound(SoundEffect.SHUFFLE);
                }
            }, 5000); // Wait for showdown + chip animation
        } else {
            // If it's an AI's turn, let them act
            const currentPlayer = gameState.players[gameState.currentPlayerIndex];
            if (currentPlayer.isAI) {
                handleAITurn(gameState);
            }
        }

        prevGameState.current = gameState;
    }, [gameState, isGameOver, winners.length, handleAITurn]);


    const handleStartGame = async (playerConfig: PlayerConfig, aiCount: number, smallBlind: number, bigBlind: number, aiDifficulty: AIDifficulty) => {
        // Unlock audio context on the first user interaction
        await audioService.unlock();
        
        humanPlayerId.current = playerConfig.id;
        const initialState = pokerLogic.initializeGame(playerConfig, aiCount, smallBlind, bigBlind, aiDifficulty);
        isGameActive.current = true; // Set game to active
        setGameState(initialState);
        audioService.playSound(SoundEffect.SHUFFLE);
    };

    const handlePlayerAction = (action: ActionType, amount: number) => {
        if (gameState && humanPlayerId.current) {
            const newState = pokerLogic.handlePlayerAction(gameState, humanPlayerId.current, action, amount);
            setGameState(newState);
        }
    };

    const handleEndGame = () => {
        isGameActive.current = false; // Set game to inactive
        setIsExitModalOpen(false);
        setIsGameOver(false);
        setGameState(null);
        setWinners([]);
        setWinningHand('');
        humanPlayerId.current = null;
    };
    
    const handleRequestExit = () => setIsExitModalOpen(true);
    const handleCancelExit = () => setIsExitModalOpen(false);

    if (!gameState) {
        return <GameSetup onStartGame={handleStartGame} />;
    }
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const isMyTurn = currentPlayer && !currentPlayer.isAI && currentPlayer.id === humanPlayerId.current;

    const getPlayerCardVisibility = (player: Player): boolean => {
        if (gameState.gamePhase === GamePhase.SHOWDOWN) {
            return !player.isFolded;
        }
        return !player.isAI;
    };

    return (
        <div className="bg-[#0A0A0A] min-h-screen w-full flex flex-col items-center justify-center font-sans text-white p-2 sm:p-4 overflow-hidden">
            <div className="w-full flex-grow flex flex-col items-center justify-center pb-24 sm:pb-0">
                <PokerTable 
                    gameState={gameState}
                    prevGameState={prevGameState.current} 
                    playerStats={playerStats}
                    isThinking={isThinking}
                    onRequestExit={handleRequestExit} 
                    getPlayerCardVisibility={getPlayerCardVisibility}
                    humanPlayerId={humanPlayerId.current}
                    winners={winners}
                />
                <div className="fixed bottom-0 left-2 right-2 sm:left-0 sm:right-0 pb-4 sm:p-0 sm:relative sm:mt-6 h-auto flex items-center justify-center z-30 bg-[#0A0A0A] sm:bg-transparent">
                    {gameState.gamePhase !== GamePhase.SHOWDOWN && currentPlayer && (
                        <ActionButtons 
                            player={currentPlayer} 
                            gameState={gameState} 
                            onAction={handlePlayerAction}
                            disabled={!isMyTurn || isThinking}
                        />
                    )}
                </div>
            </div>
            {isGameOver && winners.length > 0 && <GameOverModal winner={winners[0]} onRestart={handleEndGame} />}
            {isExitModalOpen && <ExitConfirmationModal onConfirm={handleEndGame} onCancel={handleCancelExit} />}
        </div>
    );
};

export default App;