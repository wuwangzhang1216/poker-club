
import React, { useState, useEffect, useCallback } from 'react';
import { GameState, Player, Card, GamePhase, ActionType, HandEvaluation, PlayerStats } from './types';
import { createDeck, shuffleDeck, dealCards, findBestHand, compareHands, getHandName, calculateWinProbabilities } from './services/pokerLogic';
import { getAIAction } from './services/geminiService';
import PokerTable from './components/PokerTable';
import GameSetup, { PlayerConfig } from './components/GameSetup';
import GameLobby from './components/GameLobby';
import WinnerModal from './components/WinnerModal';
import GameOverModal from './components/GameOverModal';
import ExitConfirmationModal from './components/ExitConfirmationModal';
import ActionButtons from './components/ActionButtons';
import playSound, { SoundEffect } from './services/audioService';

const AI_THINKING_TIME = 1500; // ms

type AppStage = 'setup' | 'lobby' | 'playing';
interface LobbyConfig {
    players: PlayerConfig[];
    smallBlind: number;
    bigBlind: number;
}


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

    const handleCreateLobby = (playerConfigs: PlayerConfig[], smallBlind: number, bigBlind: number) => {
        setLobbyConfig({ players: playerConfigs, smallBlind, bigBlind });
        setAppStage('lobby');
    };

    const startGame = useCallback(() => {
        if (!lobbyConfig) return;
        
        const newPlayers: Player[] = lobbyConfig.players.map((config, i) => ({
            id: `player-${i}-${Date.now()}`,
            name: config.name,
            chips: config.chips,
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
            smallBlind: lobbyConfig.smallBlind,
            bigBlind: lobbyConfig.bigBlind,
            smallBlindIndex: -1,
            bigBlindIndex: -1,
            gamePhase: GamePhase.SETUP,
            currentBet: 0,
            minRaise: lobbyConfig.bigBlind,
            lastRaiserIndex: -1
        });
        setIsGameOver(false);
        setAppStage('playing');
    }, [lobbyConfig]);

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

    const advanceToNextPhase = useCallback(() => {
        setGameState(gs => {
            if (!gs) return null;
            
            // The pot is already up-to-date from handlePlayerAction.
            // We just need to reset player bets for the new round.
            const players = gs.players.map(p => ({ ...p, bet: 0, action: null, hasActed: p.isFolded || p.chips === 0 }));

            const activePlayers = players.filter(p => !p.isFolded && p.chips > 0);
            if (activePlayers.length <= 1) {
                handleShowdown(players, gs.pot, gs.communityCards);
                return gs; 
            }
            
            const newDeck = [...gs.deck];
            let newCommunityCards = [...gs.communityCards];
            let newGamePhase: GamePhase = gs.gamePhase;

            switch (gs.gamePhase) {
                case GamePhase.PRE_FLOP:
                    if (newDeck.length >= 4) { newDeck.pop(); newCommunityCards.push(newDeck.pop()!, newDeck.pop()!, newDeck.pop()!); }
                    newGamePhase = GamePhase.FLOP;
                    playSound(SoundEffect.DEAL);
                    break;
                case GamePhase.FLOP:
                case GamePhase.TURN:
                    if (newDeck.length >= 2) { newDeck.pop(); newCommunityCards.push(newDeck.pop()!); }
                    newGamePhase = gs.gamePhase === GamePhase.FLOP ? GamePhase.TURN : GamePhase.RIVER;
                    playSound(SoundEffect.DEAL);
                    break;
                case GamePhase.RIVER:
                    handleShowdown(players, gs.pot, gs.communityCards);
                    return gs; 
            }
            
            let firstToAct = (gs.dealerIndex + 1) % players.length;
            while(players[firstToAct].isFolded || players[firstToAct].chips === 0) {
                firstToAct = (firstToAct + 1) % players.length;
            }

            return {
                ...gs,
                gamePhase: newGamePhase,
                players,
                pot: gs.pot, // Pot is already correct
                communityCards: newCommunityCards,
                deck: newDeck,
                currentPlayerIndex: firstToAct,
                lastRaiserIndex: firstToAct,
                currentBet: 0,
                minRaise: gs.bigBlind,
            };
        });
    }, [handleShowdown]);
    
    const startNewHand = useCallback(() => {
        setGameState(gs => {
            if (!gs) return null;

            let players = gs.players.filter(p => p.chips > 0);
            if (players.length < 2) {
                setWinners(players);
                setWinningHand("by winning all the chips!");
                setIsGameOver(true);
                return { ...gs, gamePhase: GamePhase.SHOWDOWN }; // Stop the game loop
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
    
            let players = [...gs.players];
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
                        players = players.map((p, index) => {
                            if (index !== currentPlayerIndex && !p.isFolded && p.chips > 0) {
                                return { ...p, hasActed: false };
                            }
                            return p;
                        });
                    }
                    break;
            }
    
            const activePlayersLeft = players.filter(p => !p.isFolded).length;
            if (activePlayersLeft <= 1) {
                setTimeout(() => handleShowdown(players, newPot, gs.communityCards), 1200);
                return { ...gs, players, currentBet, minRaise, pot: newPot };
            }
    
            const activePlayers = players.filter(p => !p.isFolded);
            const highestBet = Math.max(...activePlayers.map(p => p.bet));
            
            const allPlayersHaveActed = activePlayers.every(p => p.hasActed || p.chips === 0);
            const allBetsAreSettled = activePlayers.every(p => p.bet === highestBet || p.chips === 0);

            if (allPlayersHaveActed && allBetsAreSettled) {
                setTimeout(advanceToNextPhase, 1200);
                return { ...gs, players, currentBet, minRaise, pot: newPot };
            }
    
            let nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
            while (players[nextPlayerIndex].isFolded || players[nextPlayerIndex].chips === 0) {
                nextPlayerIndex = (nextPlayerIndex + 1) % players.length;
            }
    
            return { ...gs, players, currentBet, minRaise, currentPlayerIndex: nextPlayerIndex, pot: newPot };
        });
    }, [advanceToNextPhase, handleShowdown]);

    const handleEndGame = () => {
        setIsExitModalOpen(false);
        setIsGameOver(false);
        setGameState(null);
        setLobbyConfig(null);
        setWinners([]);
        setWinningHand('');
        setAppStage('setup');
    };

    const handleRequestExit = () => {
        setIsExitModalOpen(true);
    };

    const handleCancelExit = () => {
        setIsExitModalOpen(false);
    };
    
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
    
    const handleBackToSetup = () => {
        setLobbyConfig(null);
        setAppStage('setup');
    };

    if (appStage === 'setup') {
        return <GameSetup onCreateLobby={handleCreateLobby} />;
    }
    
    if (appStage === 'lobby' && lobbyConfig) {
        return <GameLobby lobbyConfig={lobbyConfig} onStartGame={startGame} onBackToSetup={handleBackToSetup} />;
    }

    if (appStage === 'playing' && gameState) {
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        const isHumanTurn = currentPlayer && !currentPlayer.isAI;
        const isGameActive = gameState.gamePhase !== GamePhase.SHOWDOWN && gameState.gamePhase !== GamePhase.SETUP;

        return (
            <div className="bg-[#0A0A0A] min-h-screen w-full flex flex-col items-center justify-center font-sans text-white p-4 overflow-hidden">
                <div className="w-full flex-grow flex flex-col items-center justify-center">
                    <PokerTable 
                        gameState={gameState} 
                        playerStats={playerStats}
                        isThinking={isThinking}
                        onRequestExit={handleRequestExit} 
                    />
                    <div className="relative z-20 mt-6 h-[170px] flex items-center justify-center">
                        {isGameActive && currentPlayer && (
                            <ActionButtons 
                                player={currentPlayer} 
                                gameState={gameState} 
                                onAction={handlePlayerAction}
                                disabled={!isHumanTurn || isThinking}
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
