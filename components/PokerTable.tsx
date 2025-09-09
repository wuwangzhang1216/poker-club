import React, { useState, useEffect, useRef } from 'react';
import { GameState, ActionType, Player as PlayerType, GamePhase, PlayerStats, Card } from '../types';
import Player from './Player';
import CardComponent from './Card';
import ActionButtons from './ActionButtons';
import PotChips from './PotChips';
import { getChipColor } from './Chip';

interface PokerTableProps {
    gameState: GameState;
    prevGameState: GameState | null;
    playerStats: Record<string, PlayerStats>;
    isThinking: boolean;
    onRequestExit: () => void;
    getPlayerCardVisibility: (player: PlayerType) => boolean;
    humanPlayerId: string | null;
    winners: PlayerType[];
}

const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return isMobile;
};

// --- Player & Bet Positioning Logic ---

const getCircularPlayerPositions = (numPlayers: number, humanPlayerIndex: number) => {
    const positions = [];
    const angleStep = (2 * Math.PI) / numPlayers;
    const bottomAngle = Math.PI / 2;
    const angleOffset = bottomAngle - (angleStep * humanPlayerIndex);

    for (let i = 0; i < numPlayers; i++) {
        const angle = angleOffset + i * angleStep;
        const x = 50 + 37 * Math.cos(angle);
        const y = 50 + 35 * Math.sin(angle);
        positions.push({ top: `${y}%`, left: `${x}%`, transform: 'translate(-50%, -50%)' });
    }
    return positions;
};

const getMobilePlayerPositions = (numPlayers: number, humanPlayerIndex: number) => {
    const positions: any[] = Array(numPlayers).fill({});
    positions[humanPlayerIndex] = { bottom: '2%', left: '50%', transform: 'translateX(-50%)' };

    const aiIndices = Array.from({ length: numPlayers }, (_, i) => i).filter(i => i !== humanPlayerIndex);
    
    const leftCount = Math.ceil(aiIndices.length / 2);
    const rightSideAIs = aiIndices.slice(leftCount);
    const leftSideAIs = aiIndices.slice(0, leftCount);

    leftSideAIs.forEach((aiIndex, i) => {
        const yPercent = 15 + i * 25; // 15%, 40%, 65%
        positions[aiIndex] = { top: `${yPercent}%`, left: '2%', transform: 'translateY(-50%)' };
    });

    rightSideAIs.forEach((aiIndex, i) => {
        const yPercent = 15 + i * 25; // 15%, 40%, 65%
        positions[aiIndex] = { top: `${yPercent}%`, right: '2%', transform: 'translateY(-50%)' };
    });

    return positions;
};


const PokerTable: React.FC<PokerTableProps> = ({ gameState, prevGameState, playerStats, isThinking, onRequestExit, getPlayerCardVisibility, humanPlayerId, winners }) => {
    const { players, communityCards, pot, currentPlayerIndex, dealerIndex, smallBlindIndex, bigBlindIndex, gamePhase } = gameState;
    const isMobile = useIsMobile();
    const tableRef = useRef<HTMLDivElement>(null);
    const betPositionRefs = useRef<(HTMLDivElement | null)[]>([]);
    const playerRefs = useRef<(HTMLDivElement | null)[]>([]);

    const [revealedCards, setRevealedCards] = useState<Card[]>([]);
    const [animatingChips, setAnimatingChips] = useState<any[]>([]);
    const [animatingPotChips, setAnimatingPotChips] = useState<any[]>([]);
    
    const humanPlayerIndex = humanPlayerId ? players.findIndex(p => p.id === humanPlayerId) : 0;
    const currentPlayer = players[currentPlayerIndex];

    const playerPositions = isMobile 
        ? getMobilePlayerPositions(players.length, humanPlayerIndex)
        : getCircularPlayerPositions(players.length, humanPlayerIndex);

    const getBetPosition = (playerIndex: number) => {
        const playerPosition = playerPositions[playerIndex];

        if (isMobile) {
            const pos = { ...playerPosition };
            if (pos.left === '2%') { // Player on left
                pos.left = '44%';
            } else if (pos.right === '2%') { // Player on right
                delete pos.right;
                pos.left = '56%';
            } else { // Human player at bottom
                pos.bottom = '28%';
            }
            return pos;
        } else { // Circular logic
            const angleStep = (2 * Math.PI) / players.length;
            const bottomAngle = Math.PI / 2;
            const angleOffset = bottomAngle - (angleStep * humanPlayerIndex);
            const angle = angleOffset + playerIndex * angleStep;
            const x = 50 + 18 * Math.cos(angle);
            const y = 50 + 16 * Math.sin(angle);
            return { top: `${y}%`, left: `${x}%`, transform: 'translate(-50%, -50%)' };
        }
    };
    
    // Effect for revealing community cards one by one
    useEffect(() => {
        if (communityCards.length === 0 && revealedCards.length > 0) {
            setRevealedCards([]);
            return;
        }

        if (communityCards.length > revealedCards.length) {
            const newCards = communityCards.slice(revealedCards.length);
            const isFlop = communityCards.length === 3 && revealedCards.length === 0;
            
            newCards.forEach((card, index) => {
                setTimeout(() => {
                    setRevealedCards(prev => [...prev, card]);
                }, (isFlop ? index * 250 : 250) + 300); // Add initial delay after chip animation
            });
        }
    }, [communityCards]);


    // Effect for animating chips to the pot
    useEffect(() => {
        if (!prevGameState || !tableRef.current) return;

        const isBettingRoundOver = (
            (prevGameState.gamePhase === GamePhase.PRE_FLOP && gameState.gamePhase === GamePhase.FLOP) ||
            (prevGameState.gamePhase === GamePhase.FLOP && gameState.gamePhase === GamePhase.TURN) ||
            (prevGameState.gamePhase === GamePhase.TURN && gameState.gamePhase === GamePhase.RIVER) ||
            (prevGameState.gamePhase === GamePhase.RIVER && gameState.gamePhase === GamePhase.SHOWDOWN)
        );

        if (isBettingRoundOver) {
            const tableRect = tableRef.current.getBoundingClientRect();
            const potElement = tableRef.current.querySelector('#pot-container');
            if (!potElement) return;

            const potRect = potElement.getBoundingClientRect();
            const potCenter = {
                x: potRect.left - tableRect.left + potRect.width / 2,
                y: potRect.top - tableRect.top + potRect.height / 2,
            };

            const newAnimatingChips: any[] = [];

            prevGameState.players.forEach((player, index) => {
                if (player.bet > 0) {
                     const betAnchor = betPositionRefs.current[index];
                     if(betAnchor) {
                        const anchorRect = betAnchor.getBoundingClientRect();
                        const startPos = {
                            x: anchorRect.left - tableRect.left + anchorRect.width / 2,
                            y: anchorRect.top - tableRect.top + anchorRect.height / 2,
                        };
                        newAnimatingChips.push({
                            id: `chip-anim-${player.id}-${Date.now()}`,
                            from: startPos,
                            to: potCenter,
                            amount: player.bet,
                        });
                     }
                }
            });

            if (newAnimatingChips.length > 0) {
                setAnimatingChips(newAnimatingChips);
                setTimeout(() => setAnimatingChips([]), 600); // Animation duration
            }
        }
    }, [gameState.gamePhase, prevGameState]);

    // Effect for animating pot chips to winner(s)
    useEffect(() => {
        if (winners.length > 0 && tableRef.current) {
            const tableRect = tableRef.current.getBoundingClientRect();
            const potElement = tableRef.current.querySelector('#pot-container');
            if (!potElement) return;

            const potRect = potElement.getBoundingClientRect();
            const potCenter = {
                x: potRect.left - tableRect.left + potRect.width / 2,
                y: potRect.top - tableRect.top + potRect.height / 2,
            };

            const newAnimatingChips: any[] = [];
            winners.forEach(winner => {
                const winnerIndex = players.findIndex(p => p.id === winner.id);
                const winnerElement = playerRefs.current[winnerIndex];

                if (winnerElement) {
                    const winnerRect = winnerElement.getBoundingClientRect();
                    const winnerCenter = {
                        x: winnerRect.left - tableRect.left + winnerRect.width / 2,
                        y: winnerRect.top - tableRect.top + winnerRect.height / 2,
                    };

                    for (let i = 0; i < 20; i++) { // Animate 20 chips per winner
                        newAnimatingChips.push({
                            id: `pot-chip-${winner.id}-${i}-${Date.now()}`,
                            from: {
                                x: potCenter.x + (Math.random() - 0.5) * 50,
                                y: potCenter.y + (Math.random() - 0.5) * 30,
                            },
                            to: winnerCenter,
                            delay: Math.random() * 0.5,
                            amount: pot / winners.length / 20,
                        });
                    }
                }
            });

            if (newAnimatingChips.length > 0) {
                setAnimatingPotChips(newAnimatingChips);
                setTimeout(() => setAnimatingPotChips([]), 2000); // Animation duration + delay
            }
        }
    }, [winners, players, pot]);


    return (
        <div ref={tableRef} className="w-full max-h-full sm:max-h-none max-w-7xl aspect-[5/8] sm:aspect-[1000/720] relative">
            <style>{`
                @keyframes fly-to-pot {
                    0% {
                        transform: translate(var(--start-x), var(--start-y)) scale(1);
                        opacity: 1;
                    }
                    100% {
                        transform: translate(var(--end-x), var(--end-y)) scale(0.5);
                        opacity: 0;
                    }
                }
                .animate-fly-to-pot {
                    animation: fly-to-pot 0.6s ease-in forwards;
                }
                @keyframes fly-to-winner {
                    0% {
                        transform: translate(var(--start-x), var(--start-y)) scale(1);
                        opacity: 1;
                    }
                    100% {
                        transform: translate(var(--end-x), var(--end-y)) scale(0.2);
                        opacity: 0;
                    }
                }
                .animate-fly-to-winner {
                    animation: fly-to-winner 1s ease-in forwards;
                    animation-delay: var(--delay);
                }
            `}</style>

            <button 
                onClick={onRequestExit}
                className="absolute top-2 left-2 sm:top-4 sm:left-4 z-50 flex items-center space-x-2 p-2 sm:px-3 sm:py-2 bg-[#1A1A1A]/80 border-2 border-[#5A5A5A] rounded-lg text-[#CCCCCC] hover:bg-[#2D2D2D] hover:border-[#808080] transition-all duration-200 backdrop-blur-sm"
                aria-label="Exit Game"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className='hidden sm:inline'>Exit</span>
            </button>
            
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[90%] h-[95%] sm:h-[83.33%] bg-[#1C1C1C] rounded-3xl sm:rounded-full relative border-4 md:border-8 border-[#2D2D2D] shadow-2xl shadow-black/50 flex items-center justify-center">
                    <div className="w-[90%] h-[95%] sm:h-[83.33%] bg-[#0F5F0F] rounded-3xl sm:rounded-full border-2 md:border-4 border-[#B8860B]"></div>
                </div>
            </div>

            {/* Players */}
            {players.map((player, index) => {
                const isWinner = winners.length > 0 && winners.some(w => w.id === player.id);
                return (
                    <div 
                        key={player.id} 
                        ref={el => { playerRefs.current[index] = el; }}
                        style={playerPositions[index]}
                        className="absolute"
                    >
                         <Player
                            player={player}
                            stats={playerStats[player.id]}
                            showCards={getPlayerCardVisibility(player)}
                            isCurrent={index === currentPlayerIndex}
                            isDealer={index === dealerIndex}
                            isSmallBlind={index === smallBlindIndex}
                            isBigBlind={index === bigBlindIndex}
                            isWinner={isWinner}
                        />
                    </div>
                );
            })}
            
            {/* Player Bet Position Anchors */}
            {players.map((_, index) => (
                 // Fix: Corrected ref callback to not return a value, resolving a TypeScript type error.
                 <div key={`bet-anchor-${index}`} ref={el => { betPositionRefs.current[index] = el; }} style={getBetPosition(index)} className="absolute w-1 h-1" />
            ))}

            {/* Animating Chips */}
            {animatingChips.map(chip => {
                const chipColorClasses = getChipColor(chip.amount);
                return (
                    <div
                        key={chip.id}
                        className={`absolute z-40 animate-fly-to-pot`}
                        // Fix: Cast style object to React.CSSProperties to allow for CSS custom properties.
                        style={{
                             '--start-x': `${chip.from.x}px`,
                             '--start-y': `${chip.from.y}px`,
                             '--end-x': `${chip.to.x}px`,
                             '--end-y': `${chip.to.y}px`,
                             top: 0,
                             left: 0,
                        } as React.CSSProperties}
                    >
                       <div className={`w-5 h-5 rounded-full border-2 shadow-inner relative flex-shrink-0 ${chipColorClasses}`}>
                           <div className="absolute inset-0.5 border border-white/40 rounded-full"></div>
                       </div>
                    </div>
                );
            })}

            {/* Animating Pot Chips to Winner */}
            {animatingPotChips.map(chip => {
                const chipColorClasses = getChipColor(chip.amount);
                return (
                    <div
                        key={chip.id}
                        className={`absolute z-50 animate-fly-to-winner`}
                        style={{
                             '--start-x': `${chip.from.x}px`,
                             '--start-y': `${chip.from.y}px`,
                             '--end-x': `${chip.to.x}px`,
                             '--end-y': `${chip.to.y}px`,
                             '--delay': `${chip.delay}s`,
                             top: 0,
                             left: 0,
                        } as React.CSSProperties}
                    >
                       <div className={`w-5 h-5 rounded-full border-2 shadow-inner relative flex-shrink-0 ${chipColorClasses}`}>
                           <div className="absolute inset-0.5 border border-white/40 rounded-full"></div>
                       </div>
                    </div>
                );
            })}

            {/* Player Bets */}
            {players.map((player, index) => {
                if (player.bet <= 0 || player.isFolded) return null;
                const betPosition = getBetPosition(index);
                const chipColorClasses = getChipColor(player.bet);
                return (
                     <div key={`bet-${player.id}`} style={betPosition} className="absolute z-30">
                        <div className="bg-black/60 backdrop-blur-sm rounded-full flex items-center space-x-1 sm:space-x-2 px-2 py-1 sm:px-3 sm:py-1.5 shadow-md border border-black/40">
                            <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 shadow-inner relative flex-shrink-0 ${chipColorClasses}`}>
                                <div className="absolute inset-0.5 border border-white/40 rounded-full"></div>
                            </div>
                            <p className="text-xs sm:text-sm font-mono font-bold text-white">${player.bet}</p>
                        </div>
                    </div>
                );
            })}
            
            {/* Community Cards & Pot */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center space-y-1 sm:space-y-3 z-10 w-full">
                {/* Community Cards */}
                <div className="flex space-x-1 sm:space-x-2 h-20 sm:h-28 items-center">
                    {revealedCards.map((card, index) => (
                        <CardComponent key={index} card={card} />
                    ))}
                </div>

                {/* Pot Display */}
                {pot > 0 && (
                    <div id="pot-container" className={`bg-gradient-to-b from-black/50 to-black/80 border-2 border-[#D4AF37]/30 rounded-xl px-3 py-1.5 sm:px-6 sm:py-2 text-center shadow-lg shadow-black/50 backdrop-blur-sm flex items-center space-x-2 sm:space-x-4 transition-opacity duration-500 ${winners.length > 0 ? 'opacity-0' : 'opacity-100'}`}>
                        <PotChips amount={pot} />
                        <div className='text-left'>
                                <p className="text-xs sm:text-sm font-bold text-[#D4AF37]/80 tracking-widest uppercase">Pot</p>
                                <p className="text-base sm:text-3xl font-mono font-bold text-[#F7E7CE]">${pot}</p>
                        </div>
                    </div>
                )}
                
                {/* Turn Indicator */}
                 {currentPlayer && gamePhase !== GamePhase.SHOWDOWN && (
                    <div className="text-center bg-black/40 px-3 py-1 sm:px-4 sm:py-2 rounded-lg backdrop-blur-sm">
                        <p className="text-sm sm:text-lg font-semibold text-white animate-pulse">
                            {isThinking && currentPlayer.isAI ? `${currentPlayer.name} is thinking...` : `${currentPlayer.name}'s turn`}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PokerTable;