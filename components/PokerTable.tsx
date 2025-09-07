import React from 'react';
import { GameState, ActionType, Player as PlayerType, GamePhase, PlayerStats } from '../types';
import Player from './Player';
import CardComponent from './Card';
import ActionButtons from './ActionButtons';
import PotChips from './PotChips';
import { getChipColor } from './Chip';

interface PokerTableProps {
    gameState: GameState;
    playerStats: Record<string, PlayerStats>;
    isThinking: boolean;
    onRequestExit: () => void;
    getPlayerCardVisibility: (player: PlayerType) => boolean;
}

// Arrange players evenly in a circle, starting from the bottom.
const getPlayerPositions = (numPlayers: number) => {
    const positions = [];
    const radiusX = 420; 
    const radiusY = 260; // Pulled players in vertically to prevent overlap
    
    const startAngle = Math.PI / 2; // Bottom center
    const angleStep = (2 * Math.PI) / numPlayers;

    for (let i = 0; i < numPlayers; i++) {
        const angle = startAngle + i * angleStep;
        
        const x = radiusX * Math.cos(angle);
        const y = radiusY * Math.sin(angle);
        
        positions.push({
            top: `calc(50% + ${y}px)`,
            left: `calc(50% + ${x}px)`,
            transform: `translate(-50%, -50%)`,
        });
    }
    return positions;
};


const PokerTable: React.FC<PokerTableProps> = ({ gameState, playerStats, isThinking, onRequestExit, getPlayerCardVisibility }) => {
    const { players, communityCards, pot, currentPlayerIndex, dealerIndex, smallBlindIndex, bigBlindIndex, gamePhase } = gameState;
    
    const currentPlayer = players[currentPlayerIndex];
    const playerPositions = getPlayerPositions(players.length);

    const getPlayerAngles = (numPlayers: number): number[] => {
        const angles = [];
        const startAngle = Math.PI / 2;
        const angleStep = (2 * Math.PI) / numPlayers;
        for (let i = 0; i < numPlayers; i++) {
            angles.push(startAngle + i * angleStep);
        }
        return angles;
    };
    
    const playerAngles = getPlayerAngles(players.length);
    
    const getBetPosition = (angle: number) => {
        const betRadiusX = 260; 
        const betRadiusY = 160; 
        const x = betRadiusX * Math.cos(angle);
        const y = betRadiusY * Math.sin(angle);
        
        return {
            top: `calc(50% + ${y}px)`,
            left: `calc(50% + ${x}px)`,
            transform: `translate(-50%, -50%)`,
        };
    };

    return (
        <div className="w-[1000px] h-[720px] relative">
            <button 
                onClick={onRequestExit}
                className="absolute top-4 left-4 z-50 flex items-center space-x-2 px-3 py-2 bg-[#1A1A1A]/80 border-2 border-[#5A5A5A] rounded-lg text-[#CCCCCC] hover:bg-[#2D2D2D] hover:border-[#808080] transition-all duration-200 backdrop-blur-sm"
                aria-label="Exit Game"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>Exit</span>
            </button>
            
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[900px] h-[600px] bg-[#1C1C1C] rounded-full relative border-8 border-[#2D2D2D] shadow-2xl shadow-black/50 flex items-center justify-center">
                    <div className="w-[800px] h-[500px] bg-[#0F5F0F] rounded-full border-4 border-[#B8860B]"></div>
                </div>
            </div>

            {/* Players */}
            {players.map((player, index) => {
                const stats = playerStats[player.id];
                return (
                     <Player
                        key={player.id}
                        player={player}
                        stats={stats}
                        showCards={getPlayerCardVisibility(player)}
                        isCurrent={index === currentPlayerIndex}
                        isDealer={index === dealerIndex}
                        isSmallBlind={index === smallBlindIndex}
                        isBigBlind={index === bigBlindIndex}
                        position={playerPositions[index]}
                    />
                );
            })}

            {/* Player Bets */}
            {players.map((player, index) => {
                if (player.bet <= 0 || player.isFolded) {
                    return null;
                }
                const betPosition = getBetPosition(playerAngles[index]);
                const chipColorClasses = getChipColor(player.bet);

                return (
                     <div key={`bet-${player.id}`} style={betPosition} className="absolute z-30">
                        <div className="bg-black/60 backdrop-blur-sm rounded-full flex items-center space-x-2 px-3 py-1.5 shadow-md border border-black/40">
                            <div className={`w-5 h-5 rounded-full border-2 shadow-inner relative flex-shrink-0 ${chipColorClasses}`}>
                                <div className="absolute inset-0.5 border border-white/40 rounded-full"></div>
                            </div>
                            <p className="text-sm font-mono font-bold text-white">${player.bet}</p>
                        </div>
                    </div>
                );
            })}
            
            {/* Community Cards & Pot */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center space-y-3 z-10">
                {/* Community Cards */}
                <div className="flex space-x-2 h-28 items-center">
                    {communityCards.map((card, index) => (
                        <CardComponent key={index} card={card} />
                    ))}
                </div>

                {/* Pot Display */}
                {pot > 0 && (
                    <div className="bg-gradient-to-b from-black/50 to-black/80 border-2 border-[#D4AF37]/30 rounded-xl px-6 py-2 text-center shadow-lg shadow-black/50 backdrop-blur-sm flex items-center space-x-4">
                        <PotChips amount={pot} />
                        <div className='text-left'>
                                <p className="text-sm font-bold text-[#D4AF37]/80 tracking-widest uppercase">Pot</p>
                                <p className="text-3xl font-mono font-bold text-[#F7E7CE]">${pot}</p>
                        </div>
                    </div>
                )}
                
                {/* Turn Indicator */}
                 {currentPlayer && gamePhase !== GamePhase.SHOWDOWN && (
                    <div className="text-center bg-black/40 px-4 py-2 rounded-lg backdrop-blur-sm">
                        <p className="text-lg font-semibold text-white animate-pulse">
                            {isThinking && currentPlayer.isAI ? 'Gemini is thinking...' : `${currentPlayer.name}'s turn`}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PokerTable;
