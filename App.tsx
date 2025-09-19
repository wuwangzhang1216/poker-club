import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Player, GamePhase, ActionType, PlayerStats, GameMode, GameStartOptions } from './types';
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
    const [turnTimeRemaining, setTurnTimeRemaining] = useState<number | null>(null);
    const [levelTimeRemaining, setLevelTimeRemaining] = useState<number | null>(null);
    const prevGameState = useRef<GameState | null>(null);
    const humanPlayerId = useRef<string | null>(null);
    const isGameActive = useRef(false); // New ref to track game status
    const turnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const turnCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const levelCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const latestGameStateRef = useRef<GameState | null>(null);

    useEffect(() => {
        // Preload sounds when the app first mounts
        audioService.loadSounds();
    }, []);

    const clearTurnTimers = useCallback(() => {
        if (turnTimeoutRef.current) {
            clearTimeout(turnTimeoutRef.current);
            turnTimeoutRef.current = null;
        }
        if (turnCountdownRef.current) {
            clearInterval(turnCountdownRef.current);
            turnCountdownRef.current = null;
        }
    }, []);

    const clearLevelTimer = useCallback(() => {
        if (levelCountdownRef.current) {
            clearInterval(levelCountdownRef.current);
            levelCountdownRef.current = null;
        }
    }, []);

    const applyPlayerAction = useCallback((playerId: string, action: ActionType, amount: number) => {
        setGameState(prev => {
            if (!prev) return prev;
            return pokerLogic.handlePlayerAction(prev, playerId, action, amount);
        });
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
            if (isGameActive.current) {
                applyPlayerAction(currentPlayer.id, action, amount);
            }
        } catch (error) {
            console.error("Error getting AI action, AI will check or fold.", error);
            // Fallback action if API fails
            const fallbackAction = state.currentBet > currentPlayer.bet ? ActionType.FOLD : ActionType.CHECK;
            if (isGameActive.current) {
                applyPlayerAction(currentPlayer.id, fallbackAction, 0);
            }
        } finally {
            if (isGameActive.current) { // Only update if game is still active
                setIsThinking(false);
            }
        }
    }, [applyPlayerAction]);
    
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

    useEffect(() => {
        latestGameStateRef.current = gameState;
    }, [gameState]);

    useEffect(() => {
        if (!gameState || gameState.mode !== GameMode.TOURNAMENT || !gameState.tournament) {
            clearTurnTimers();
            setTurnTimeRemaining(null);
            return;
        }

        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (!currentPlayer) {
            clearTurnTimers();
            setTurnTimeRemaining(null);
            return;
        }

        const isHumanTurn = !currentPlayer.isAI && currentPlayer.id === humanPlayerId.current && !currentPlayer.isFolded && currentPlayer.chips > 0 && gameState.gamePhase !== GamePhase.SHOWDOWN;
        if (!isHumanTurn) {
            clearTurnTimers();
            setTurnTimeRemaining(null);
            return;
        }

        const timeLimit = gameState.tournament.turnTimeLimitSeconds;
        if (!timeLimit) {
            clearTurnTimers();
            setTurnTimeRemaining(null);
            return;
        }

        clearTurnTimers();
        setTurnTimeRemaining(timeLimit);

        turnTimeoutRef.current = setTimeout(() => {
            const latestState = latestGameStateRef.current;
            if (!latestState || latestState.mode !== GameMode.TOURNAMENT || !latestState.tournament) {
                return;
            }
            const latestPlayer = latestState.players[latestState.currentPlayerIndex];
            if (!latestPlayer || latestPlayer.id !== humanPlayerId.current || latestPlayer.isFolded || latestPlayer.chips === 0) {
                return;
            }
            const needsToCall = latestState.currentBet > latestPlayer.bet;
            const fallbackAction = needsToCall ? ActionType.FOLD : ActionType.CHECK;
            clearTurnTimers();
            setTurnTimeRemaining(null);
            applyPlayerAction(latestPlayer.id, fallbackAction, 0);
        }, timeLimit * 1000);

        turnCountdownRef.current = setInterval(() => {
            setTurnTimeRemaining(prev => {
                if (prev === null) return prev;
                return prev > 0 ? prev - 1 : 0;
            });
        }, 1000);

        return () => {
            clearTurnTimers();
        };
    }, [gameState, clearTurnTimers, applyPlayerAction]);

    useEffect(() => {
        if (!gameState || gameState.mode !== GameMode.TOURNAMENT || !gameState.tournament) {
            clearLevelTimer();
            setLevelTimeRemaining(null);
            return;
        }

        const updateRemaining = () => {
            const latestState = latestGameStateRef.current;
            if (!latestState || latestState.mode !== GameMode.TOURNAMENT || !latestState.tournament) {
                setLevelTimeRemaining(null);
                return;
            }
            const remainingMs = latestState.tournament.levelEndsAt - Date.now();
            if (remainingMs <= 0) {
                setLevelTimeRemaining(0);
                setGameState(prev => {
                    if (!prev || prev.mode !== GameMode.TOURNAMENT || !prev.tournament) {
                        return prev;
                    }

                    const { blindSchedule, blindLevelIndex, levelDurationMs } = prev.tournament;
                    const hasNextLevel = blindLevelIndex < blindSchedule.length - 1;
                    const nextIndex = hasNextLevel ? blindLevelIndex + 1 : blindLevelIndex;
                    const shouldApplyNow = hasNextLevel && prev.gamePhase === GamePhase.SETUP;
                    const nextBlinds = blindSchedule[nextIndex];

                    const updatedTournament = {
                        ...prev.tournament,
                        levelEndsAt: Date.now() + levelDurationMs,
                        blindLevelIndex: shouldApplyNow ? nextIndex : prev.tournament.blindLevelIndex,
                        pendingLevelIndex: shouldApplyNow ? null : (hasNextLevel ? nextIndex : null),
                    };

                    if (shouldApplyNow) {
                        return {
                            ...prev,
                            smallBlind: nextBlinds.smallBlind,
                            bigBlind: nextBlinds.bigBlind,
                            minRaise: nextBlinds.bigBlind,
                            tournament: updatedTournament,
                        };
                    }

                    if (!hasNextLevel) {
                        return {
                            ...prev,
                            tournament: {
                                ...updatedTournament,
                                pendingLevelIndex: null,
                            },
                        };
                    }

                    return {
                        ...prev,
                        tournament: updatedTournament,
                    };
                });
                return;
            }

            setLevelTimeRemaining(Math.max(1, Math.ceil(remainingMs / 1000)));
        };

        updateRemaining();
        clearLevelTimer();
        levelCountdownRef.current = setInterval(updateRemaining, 1000);

        return () => {
            clearLevelTimer();
        };
    }, [gameState, clearLevelTimer]);

    useEffect(() => {
        if (!gameState || gameState.mode !== GameMode.TOURNAMENT || !gameState.tournament) {
            return;
        }

        if (gameState.gamePhase !== GamePhase.SETUP) {
            return;
        }

        if (gameState.tournament.pendingLevelIndex == null) {
            return;
        }

        setGameState(prev => {
            if (!prev || prev.mode !== GameMode.TOURNAMENT || !prev.tournament) {
                return prev;
            }

            if (prev.gamePhase !== GamePhase.SETUP || prev.tournament.pendingLevelIndex == null) {
                return prev;
            }

            const targetIndex = prev.tournament.pendingLevelIndex;
            const nextBlinds = prev.tournament.blindSchedule[targetIndex];

            return {
                ...prev,
                smallBlind: nextBlinds.smallBlind,
                bigBlind: nextBlinds.bigBlind,
                minRaise: nextBlinds.bigBlind,
                tournament: {
                    ...prev.tournament,
                    blindLevelIndex: targetIndex,
                    pendingLevelIndex: null,
                },
            };
        });
    }, [gameState]);


    const handleStartGame = async (options: GameStartOptions) => {
        // Unlock audio context on the first user interaction
        await audioService.unlock();

        clearTurnTimers();
        clearLevelTimer();
        setTurnTimeRemaining(null);
        setLevelTimeRemaining(null);

        humanPlayerId.current = options.playerConfig.id;
        const initialState = pokerLogic.initializeGame(
            options.playerConfig,
            options.aiCount,
            options.smallBlind,
            options.bigBlind,
            options.aiDifficulty,
            options.mode,
            options.tournamentConfig
        );
        isGameActive.current = true; // Set game to active
        latestGameStateRef.current = initialState;
        setIsGameOver(false);
        setIsExitModalOpen(false);
        setWinners([]);
        setWinningHand('');
        setGameState(initialState);
        if (initialState.mode === GameMode.TOURNAMENT && initialState.tournament) {
            const remainingSeconds = Math.max(1, Math.ceil((initialState.tournament.levelEndsAt - Date.now()) / 1000));
            setLevelTimeRemaining(remainingSeconds);
        }
        audioService.playSound(SoundEffect.SHUFFLE);
    };

    const handlePlayerAction = (action: ActionType, amount: number) => {
        if (humanPlayerId.current) {
            clearTurnTimers();
            applyPlayerAction(humanPlayerId.current, action, amount);
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
        latestGameStateRef.current = null;
        clearTurnTimers();
        clearLevelTimer();
        setTurnTimeRemaining(null);
        setLevelTimeRemaining(null);
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
        <div className="bg-[#0A0A0A] h-screen w-full font-sans text-white px-2 sm:px-4 py-3 sm:py-6 overflow-hidden">
            <div className="mx-auto flex h-full max-w-5xl flex-col gap-3 sm:gap-6">
                <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
                    <PokerTable 
                        gameState={gameState}
                        prevGameState={prevGameState.current} 
                        playerStats={playerStats}
                        isThinking={isThinking}
                        onRequestExit={handleRequestExit} 
                        getPlayerCardVisibility={getPlayerCardVisibility}
                        humanPlayerId={humanPlayerId.current}
                        winners={winners}
                        levelTimeRemaining={levelTimeRemaining}
                    />
                </div>
                <div className="flex justify-center w-full flex-shrink-0 pb-1 sm:pb-0">
                    {gameState.gamePhase !== GamePhase.SHOWDOWN && currentPlayer && (
                        <ActionButtons 
                            player={currentPlayer} 
                            gameState={gameState} 
                            onAction={handlePlayerAction}
                            disabled={!isMyTurn || isThinking}
                            turnTimeRemaining={turnTimeRemaining}
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
