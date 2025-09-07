// Fix: Corrected the React import statement. The 'a,' was a typo causing import resolution to fail.
// Fix: Corrected the React import statement to properly import hooks and resolve subsequent 'Cannot find name' errors.
import React, { useState, useEffect, useCallback } from 'react';
import { GameState, Player, Card, GamePhase, ActionType, HandEvaluation, PlayerStats, LobbyConfig, PlayerConfig } from './types';
import { createDeck, shuffleDeck, dealCards, findBestHand, compareHands, getHandName, calculateWinProbabilities } from './services/pokerLogic';
import { getAIAction } from './services/geminiService';
import PokerTable from './components/PokerTable';
import GameSetup from './components/GameSetup';
import GameLobby from './components/GameLobby';
import WinnerModal from './components/WinnerModal';
import GameOverModal from './components/GameOverModal';
import ExitConfirmationModal from './components/ExitConfirmationModal';
import ActionButtons from './components/ActionButtons';
import playSound, { SoundEffect } from './services/audioService';

const AI_THINKING_TIME = 1500; // ms
const CURRENT_USER_ID_KEY = 'gemini-poker-club-userId';

type AppStage = 'setup' | 'lobby' | 'playing';

const generateId = () => Math.random().toString(36).substring(2, 9);


const App: React.FC = () => {
    const [appStage, setAppStage] = useState<AppStage>('setup');
    const [lobbyConfig, setLobbyConfig] = useState<LobbyConfig | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [playerStats, setPlayerStats] = useState<Record<string, PlayerStats>>({});
    const [isThinking, setIsThinking] = useState(false);
    const [winners, setWinners] = useState<Player[]>([]);
    const [winningHand, setWinningHand] = useState('');
    const [isGameOver, setIsGameOver] = useState(false);
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        const userIdFromSession = sessionStorage.getItem(CURRENT_USER_ID_KEY);
        if (userIdFromSession) {
            setCurrentUserId(userIdFromSession);
        }

        // Handle joining a lobby via a URL with encoded state in the hash
        const hash = window.location.hash.substring(1);
        if (hash) {
            try {
                const decodedLobby: LobbyConfig = JSON.parse(atob(hash));
                if (decodedLobby && decodedLobby.players) {
                    console.log("Joining lobby from URL hash data.");
                    setLobbyConfig(decodedLobby);
                    setAppStage('lobby');

                    // Clean the hash from URL after loading
                    try {
                        const params = new URLSearchParams(window.location.search);
                        const lobbyId = params.get('lobby');
                        const cleanUrl = lobbyId ? `${window.location.pathname}?lobby=${lobbyId}` : window.location.pathname;
                        window.history.replaceState(null, '', cleanUrl);
                    } catch (e) {
                        console.warn("Could not clean URL hash.", e);
                    }
                    return; // Stop further processing
                }
            } catch (e) {
                console.error("Could not parse lobby data from hash.", e);
                 try { window.history.replaceState(null, '', window.location.pathname); } catch (err) {}
            }
        }
        
        // If a lobby ID is present without hash data, it's a broken link. Default to setup.
        const params = new URLSearchParams(window.location.search);
        const lobbyId = params.get('lobby');
        if (lobbyId && !hash) {
             console.warn("Lobby ID found in URL, but no lobby data. A host needs to provide a link with data. Showing setup screen.");
             try {
                window.history.replaceState({}, '', window.location.pathname);
             } catch(e) { console.warn('Could not clear URL parameters.', e)}
        }
    }, []);

    const initializeGame = useCallback((finalLobbyConfig: LobbyConfig) => {
        const newPlayers: Player[] = finalLobbyConfig.players.map(config => ({
            id: config.id,
            name: config.name,
            chips: config.chips,
            isHost: config.isHost,
            hand: [],
            isAI: config.isAI,
            isFolded: false,
            bet: 0,
            totalBet: 0,
            action: null,
            hasActed: false,
        }));

        setGameState({
            players: newPlayers,
            deck: [],
            communityCards: [],
            pot: 0,
            currentPlayerIndex: 0,
            dealerIndex: -1,
            smallBlind: finalLobbyConfig.smallBlind,
            bigBlind: finalLobbyConfig.bigBlind,
            smallBlindIndex: -1,
            bigBlindIndex: -1,
            gamePhase: GamePhase.SETUP,
            currentBet: 0,
            minRaise: finalLobbyConfig.bigBlind,
            lastRaiserIndex: -1
        });
        setIsGameOver(false);
        setAppStage('playing');
    }, []);

    const handleCreateLobby = async (hostConfig: PlayerConfig, smallBlind: number, bigBlind: number) => {
        const lobbyId = generateId(); 
        const newLobbyConfig: LobbyConfig = {
            id: lobbyId,
            players: [
                { ...hostConfig, isHost: true },
                { id: generateId(), name: 'Gemini Agent 1', chips: 1000, isAI: true },
                { id: generateId(), name: 'Gemini Agent 2', chips: 1000, isAI: true },
            ],
            smallBlind,
            bigBlind,
            gameStarted: false,
        };
        
        console.log(`Simulating lobby creation with ID: ${lobbyId}`);
        
        sessionStorage.setItem(CURRENT_USER_ID_KEY, hostConfig.id);
        try {
            // Set the lobbyId in the query param for the host's URL
            window.history.pushState({}, '', `?lobby=${lobbyId}`);
        } catch (e) {
            console.warn("Could not update URL: History API is not available in this environment.", e);
        }

        setLobbyConfig(newLobbyConfig);
        setCurrentUserId(hostConfig.id);
        setAppStage('lobby');
    };

    const handleUpdateLobby = (updatedLobby: LobbyConfig) => {
        // In a client-only model, this is the sole source of truth.
        setLobbyConfig(updatedLobby);
    };
    
    const handleStartGame = () => {
        if (!lobbyConfig) return;
        const isHost = lobbyConfig.players.find(p => p.id === currentUserId)?.isHost ?? false;

        if (isHost) {
            const updatedLobby = { ...lobbyConfig, gameStarted: true };
            // Host starts the game directly. Other players need a sync mechanism.
            // In this backend-less version, other players will not see the game start.
            // This is a known limitation.
            initializeGame(updatedLobby);
        }
    };
    
    const handleShowdown = useCallback((players: Player[], pot: number, communityCards: Card[]) => {
        const playersWithResetBets = players.map(p => ({ ...p, bet: 0 }));
        const activePlayers = playersWithResetBets.filter(p => !p.isFolded);
        let finalPlayers: Player[] = [];
        let winningPlayers: Player[] = [];

        if (activePlayers.length === 1) {
            const winner = activePlayers[0];
            finalPlayers = playersWithResetBets.map(p => 
                p.id === winner.id ? { ...p, chips: p.chips + pot } : p
            );
            winningPlayers = finalPlayers.filter(p => p.id === winner.id);
            setWinners(winningPlayers);
            setWinningHand('the last one standing');
            playSound(SoundEffect.WIN);
        } else {
            let bestHandEvals: { player: Player, eval: HandEvaluation }[] = [];
            for (const player of activePlayers) {
                const allCards = [...player.hand, ...communityCards];
                const handEval = findBestHand(allCards);
                bestHandEvals.push({ player, eval: handEval });
            }
            bestHandEvals.sort((a, b) => compareHands(b.eval, a.eval));
            
            const winningEval = bestHandEvals[0].eval;
            const winnersData = bestHandEvals.filter(h => compareHands(h.eval, winningEval) === 0);
            
            const prizePerWinner = Math.floor(pot / winnersData.length);
            const remainder = pot % winnersData.length;
            const winnerIds = new Set(winnersData.map(w => w.player.id));
            const firstWinnerId = winnersData.length > 0 ? winnersData[0].player.id : null;
            
            finalPlayers = playersWithResetBets.map(p => {
                if (winnerIds.has(p.id)) {
                    let prize = prizePerWinner;
                    if (p.id === firstWinnerId) {
                        prize += remainder;
                    }
                    return { ...p, chips: p.chips + prize };
                }
                return p;
            });
            
            winningPlayers = finalPlayers.filter(p => winnerIds.has(p.id));

            setWinners(winningPlayers);
            setWinningHand(getHandName(winningEval));
            playSound(SoundEffect.WIN);
        }

        setGameState(gs => gs && { ...gs, players: finalPlayers, gamePhase: GamePhase.SHOWDOWN, pot: 0 });

        setTimeout(() => {
            startNewHand();
        }, 5000);
    }, []);

    const runAllInShowdownSequence = useCallback(async (startingGs: GameState) => {
        let deck = [...startingGs.deck];
        let communityCards = [...startingGs.communityCards];

        const streetsToDeal = [];
        if (communityCards.length < 3) streetsToDeal.push('flop');
        if (communityCards.length < 4) streetsToDeal.push('turn');
        if (communityCards.length < 5) streetsToDeal.push('river');

        for (const street of streetsToDeal) {
            await new Promise(resolve => setTimeout(resolve, 1200)); // Delay for suspense

            if (street === 'flop') {
                if (deck.length > 3) {
                    deck.pop(); // burn
                    communityCards.push(deck.pop()!, deck.pop()!, deck.pop()!);
                }
            } else { // turn or river
                if (deck.length > 1) {
                    deck.pop(); // burn
                    communityCards.push(deck.pop()!);
                }
            }
            
            playSound(SoundEffect.DEAL);
            
            setGameState(gs => {
                if (!gs) return null;
                return {
                    ...gs,
                    deck: [...deck],
                    communityCards: [...communityCards],
                    gamePhase: GamePhase.SHOWDOWN, 
                };
            });
        }

        await new Promise(resolve => setTimeout(resolve, 1500));
        handleShowdown(startingGs.players, startingGs.pot, communityCards);

    }, [handleShowdown]);

    const endBettingRoundAndAdvance = useCallback((currentGs: GameState) => {
        if (!currentGs) return;
        
        const playersWithResetActions = currentGs.players.map(p => ({ ...p, bet: 0, action: null, hasActed: p.isFolded || p.chips === 0 }));
        
        const playersWhoCanBet = playersWithResetActions.filter(p => !p.isFolded && p.chips > 0);
        const totalActivePlayers = playersWithResetActions.filter(p => !p.isFolded).length;

        if (totalActivePlayers <= 1) {
            handleShowdown(playersWithResetActions, currentGs.pot, currentGs.communityCards);
            return;
        }

        if (playersWhoCanBet.length <= 1) {
            const finalStateBeforeSequence = { ...currentGs, players: playersWithResetActions };
            setGameState(finalStateBeforeSequence);
            runAllInShowdownSequence(finalStateBeforeSequence);
            return;
        }
        
        if (currentGs.gamePhase === GamePhase.RIVER) {
            handleShowdown(playersWithResetActions, currentGs.pot, currentGs.communityCards);
            return;
        }

        const newDeck = [...currentGs.deck];
        let newCommunityCards = [...currentGs.communityCards];
        let newGamePhase: GamePhase = currentGs.gamePhase;

        switch (currentGs.gamePhase) {
            case GamePhase.PRE_FLOP:
                if (newDeck.length >= 4) { newDeck.pop(); newCommunityCards.push(newDeck.pop()!, newDeck.pop()!, newDeck.pop()!); }
                newGamePhase = GamePhase.FLOP;
                playSound(SoundEffect.DEAL);
                break;
            case GamePhase.FLOP:
            case GamePhase.TURN:
                if (newDeck.length >= 2) { newDeck.pop(); newCommunityCards.push(newDeck.pop()!); }
                newGamePhase = currentGs.gamePhase === GamePhase.FLOP ? GamePhase.TURN : GamePhase.RIVER;
                playSound(SoundEffect.DEAL);
                break;
        }
        
        let firstToAct = (currentGs.dealerIndex + 1) % playersWithResetActions.length;
        while(playersWithResetActions[firstToAct].isFolded || playersWithResetActions[firstToAct].chips === 0) {
            firstToAct = (firstToAct + 1) % playersWithResetActions.length;
        }

        setGameState({
            ...currentGs,
            gamePhase: newGamePhase,
            players: playersWithResetActions,
            pot: currentGs.pot,
            communityCards: newCommunityCards,
            deck: newDeck,
            currentPlayerIndex: firstToAct,
            lastRaiserIndex: firstToAct,
            currentBet: 0,
            minRaise: currentGs.bigBlind,
        });
    }, [handleShowdown, runAllInShowdownSequence]);
    
    const startNewHand = useCallback(() => {
        setGameState(gs => {
            if (!gs) return null;

            let players = gs.players.filter(p => p.chips > 0);
            if (players.length < 2) {
                setWinners(players);
                setWinningHand("by winning all the chips!");
                setIsGameOver(true);
                return { ...gs, gamePhase: GamePhase.SHOWDOWN };
            }

            const deck = shuffleDeck(createDeck());
            playSound(SoundEffect.SHUFFLE);
            players = players.map(p => ({ ...p, hand: [], isFolded: false, bet: 0, action: null, hasActed: false, totalBet: 0 }));
            
            const dealerIndex = (gs.dealerIndex + 1) % players.length;
            
            let smallBlindIndex = (dealerIndex + 1) % players.length;
            while(players[smallBlindIndex].chips === 0) {
                 smallBlindIndex = (smallBlindIndex + 1) % players.length;
            }

            let bigBlindIndex = (smallBlindIndex + 1) % players.length;
            while(players[bigBlindIndex].chips === 0) {
                 bigBlindIndex = (bigBlindIndex + 1) % players.length;
            }
            
            const smallBlindAmount = Math.min(gs.smallBlind, players[smallBlindIndex].chips);
            players[smallBlindIndex].chips -= smallBlindAmount;
            players[smallBlindIndex].bet = smallBlindAmount;
            players[smallBlindIndex].totalBet = smallBlindAmount;

            const bigBlindAmount = Math.min(gs.bigBlind, players[bigBlindIndex].chips);
            players[bigBlindIndex].chips -= bigBlindAmount;
            players[bigBlindIndex].bet = bigBlindAmount;
            players[bigBlindIndex].totalBet = bigBlindAmount;
            
            playSound(SoundEffect.BET);
            
            const pot = smallBlindAmount + bigBlindAmount;

            let currentPlayerIndex = (bigBlindIndex + 1) % players.length;
             while(players[currentPlayerIndex].chips === 0) {
                 currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
            }

            dealCards(players, deck, 2);
            playSound(SoundEffect.DEAL);
            
            setWinners([]);
            setWinningHand('');

            return {
                ...gs,
                players,
                deck,
                communityCards: [],
                pot,
                dealerIndex,
                smallBlindIndex,
                bigBlindIndex,
                currentPlayerIndex,
                lastRaiserIndex: bigBlindIndex,
                gamePhase: GamePhase.PRE_FLOP,
                currentBet: gs.bigBlind,
                minRaise: gs.bigBlind,
            };
        });
    }, []);
    
    const handlePlayerAction = useCallback((action: ActionType, amount: number) => {
        setGameState(gs => {
            if (!gs) return null;
    
            let players = JSON.parse(JSON.stringify(gs.players));
            const { currentPlayerIndex } = gs;
            let currentBet = gs.currentBet;
            let minRaise = gs.minRaise;
            let newPot = gs.pot;
            const currentPlayer = players[currentPlayerIndex];
    
            currentPlayer.hasActed = true;
            currentPlayer.action = action;
    
            switch (action) {
                case ActionType.FOLD:
                    currentPlayer.isFolded = true;
                    playSound(SoundEffect.FOLD);
                    break;
                case ActionType.CHECK:
                    playSound(SoundEffect.CHECK);
                    break;
                case ActionType.CALL:
                    const callAmount = Math.min(currentPlayer.chips, currentBet - currentPlayer.bet);
                    currentPlayer.chips -= callAmount;
                    currentPlayer.bet += callAmount;
                    currentPlayer.totalBet += callAmount;
                    newPot += callAmount;
                    playSound(SoundEffect.BET);
                    break;
                case ActionType.BET:
                case ActionType.RAISE:
                    const totalBetAmount = Math.min(currentPlayer.chips + currentPlayer.bet, amount);
                    const amountToPutIn = totalBetAmount - currentPlayer.bet;
                    const raiseAmount = totalBetAmount - currentBet;

                    const isFullRaise = raiseAmount >= gs.minRaise && (currentPlayer.chips - amountToPutIn) > 0;

                    currentPlayer.chips -= amountToPutIn;
                    currentPlayer.bet = totalBetAmount;
                    currentPlayer.totalBet += amountToPutIn;
                    newPot += amountToPutIn;
                    currentBet = totalBetAmount;
                    
                    playSound(SoundEffect.BET);
                    
                    if (isFullRaise) {
                        minRaise = raiseAmount;
                        players = players.map((p: Player, index: number) => {
                            if (index !== currentPlayerIndex && !p.isFolded && p.chips > 0) {
                                return { ...p, hasActed: false };
                            }
                            return p;
                        });
                    }
                    break;
            }
            
            const tempGs = { ...gs, players, currentBet, minRaise, pot: newPot };
    
            const activePlayersLeft = players.filter((p:Player) => !p.isFolded).length;
            if (activePlayersLeft <= 1) {
                setTimeout(() => handleShowdown(players, newPot, gs.communityCards), 1200);
                return tempGs;
            }
    
            const activePlayers = players.filter((p:Player) => !p.isFolded);
            const highestBet = Math.max(...activePlayers.map((p:Player) => p.bet));
            
            const allPlayersHaveActed = activePlayers.every((p:Player) => p.hasActed || p.chips === 0);
            const allBetsAreSettled = activePlayers.every((p:Player) => p.bet === highestBet || p.chips === 0);

            if (allPlayersHaveActed && allBetsAreSettled) {
                setTimeout(() => endBettingRoundAndAdvance(tempGs), 1200);
                return tempGs;
            }
    
            let nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
            while (players[nextPlayerIndex].isFolded || players[nextPlayerIndex].chips === 0) {
                nextPlayerIndex = (nextPlayerIndex + 1) % players.length;
            }
    
            return { ...tempGs, currentPlayerIndex: nextPlayerIndex };
        });
    }, [endBettingRoundAndAdvance, handleShowdown]);

    const handleEndGame = () => {
        setIsExitModalOpen(false);
        setIsGameOver(false);
        setGameState(null);
        setLobbyConfig(null);
        setWinners([]);
        setWinningHand('');
        try {
            window.history.replaceState({}, '', window.location.pathname);
        } catch (e) {
            console.warn("Could not update URL: History API is not available in this environment.", e);
        }
        setAppStage('setup');
    };

    const handleLeaveLobby = () => {
        // In a client-only model, leaving is the same as resetting the app state.
        handleEndGame();
    };

    const handleRequestExit = () => setIsExitModalOpen(true);
    const handleCancelExit = () => setIsExitModalOpen(false);
    
    useEffect(() => {
        if (!gameState || gameState.gamePhase === GamePhase.SETUP || gameState.gamePhase === GamePhase.SHOWDOWN) {
            setPlayerStats({});
            return;
        }

        const calculateStats = () => {
            const activePlayers = gameState.players.filter(p => !p.isFolded);
            if (activePlayers.length < 2) {
                setPlayerStats({});
                return;
            }
            
            const humanPlayers = gameState.players.filter(p => !p.isAI && !p.isFolded);
            if (humanPlayers.length === 0) {
                setPlayerStats({});
                return;
            }
            
            const fullDeck = createDeck(); 
            const allStats = calculateWinProbabilities(activePlayers, gameState.communityCards, fullDeck);
            
            const newPlayerStats: Record<string, PlayerStats> = {};
            humanPlayers.forEach(p => {
                if (allStats[p.id]) {
                    newPlayerStats[p.id] = allStats[p.id];
                }
            });
            setPlayerStats(newPlayerStats);
        };

        calculateStats();

    }, [gameState?.communityCards, gameState?.players, gameState?.gamePhase]);

    useEffect(() => {
        if (!gameState || appStage !== 'playing' || gameState.gamePhase === GamePhase.SHOWDOWN || gameState.gamePhase === GamePhase.SETUP || isGameOver) return;
        
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (!currentPlayer) return;

        if (currentPlayer.isAI) {
            if (!isThinking) {
                setIsThinking(true);
                const performAIAction = async () => {
                    const response = await getAIAction(gameState, currentPlayer);
                    setTimeout(() => {
                        setIsThinking(false);
                        if (gameState.players[gameState.currentPlayerIndex]?.id === currentPlayer.id) {
                             handlePlayerAction(response.action, response.amount);
                        }
                    }, AI_THINKING_TIME);
                };
                performAIAction();
            }
        }
    }, [gameState?.currentPlayerIndex, gameState?.gamePhase, isGameOver, appStage, handlePlayerAction, isThinking]);

    useEffect(() => {
        if (gameState && gameState.gamePhase === GamePhase.SETUP) {
            startNewHand();
        }
    }, [gameState?.gamePhase, startNewHand]);
    
    if (appStage === 'setup') {
        return <GameSetup onCreateLobby={handleCreateLobby} />;
    }
    
    if (appStage === 'lobby' && lobbyConfig) {
        return <GameLobby 
            lobbyConfig={lobbyConfig} 
            onStartGame={handleStartGame} 
            onEndLobby={handleEndGame}
            onLeaveLobby={handleLeaveLobby}
            onUpdateLobby={handleUpdateLobby}
            currentUserId={currentUserId}
            onSetCurrentUser={(id) => {
                setCurrentUserId(id);
                sessionStorage.setItem(CURRENT_USER_ID_KEY, id);
            }}
        />;
    }

    if (appStage === 'playing' && gameState) {
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        const isMyTurn = currentPlayer && !currentPlayer.isAI && currentPlayer.id === currentUserId;
        const isGameActive = gameState.gamePhase !== GamePhase.SHOWDOWN && gameState.gamePhase !== GamePhase.SETUP;

        const getPlayerCardVisibility = (player: Player): boolean => {
            if (gameState.gamePhase === GamePhase.SHOWDOWN) {
                return !player.isFolded;
            }
            return player.id === currentUserId;
        };

        return (
            <div className="bg-[#0A0A0A] min-h-screen w-full flex flex-col items-center justify-center font-sans text-white p-4 overflow-hidden">
                <div className="w-full flex-grow flex flex-col items-center justify-center">
                    <PokerTable 
                        gameState={gameState} 
                        playerStats={playerStats}
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
                                disabled={!isMyTurn || isThinking}
                            />
                        )}
                    </div>
                </div>
                {isGameOver && winners.length > 0 && <GameOverModal winner={winners[0]} onRestart={handleEndGame} />}
                {!isGameOver && winners.length > 0 && <WinnerModal winners={winners} hand={winningHand} />}
                {isExitModalOpen && <ExitConfirmationModal onConfirm={handleEndGame} onCancel={handleCancelExit} />}
            </div>
        );
    }

    return <div>Loading...</div>;
};

export default App;