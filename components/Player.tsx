import React from 'react';
import CardComponent from './Card';
import { Player as PlayerType, ActionType, PlayerStats } from '../types';

type PlayerDisplayVariant = 'default' | 'compact';

interface PlayerProps {
    player: PlayerType;
    stats?: PlayerStats;
    isCurrent: boolean;
    isDealer: boolean;
    isSmallBlind: boolean;
    isBigBlind: boolean;
    showCards: boolean;
    isWinner: boolean;
    variant?: PlayerDisplayVariant;
}

const Player: React.FC<PlayerProps> = ({
    player,
    stats,
    isCurrent,
    isDealer,
    isSmallBlind,
    isBigBlind,
    showCards,
    isWinner,
    variant = 'default',
}) => {
    const isCompact = variant === 'compact';

    const containerWidth = isCompact ? 'w-28 sm:w-32' : 'w-36 sm:w-44';
    const cardHeight = isCompact ? 'h-12 sm:h-16' : 'h-14 sm:h-20';
    const nameTextClasses = isCompact ? 'text-xs sm:text-sm' : 'text-sm sm:text-lg';
    const stackTextClasses = isCompact ? 'text-xs sm:text-sm' : 'text-sm sm:text-lg';
    const paddingClasses = isCompact ? 'p-1.5 sm:p-2' : 'p-1 sm:p-2';
    const actionOffset = isCompact ? '-top-5' : '-top-6';
    const winMeterHeight = isCompact ? 'h-2 sm:h-3' : 'h-2.5 sm:h-3.5';
    const winMeterText = isCompact ? 'text-[10px] sm:text-xs' : 'text-[11px] sm:text-xs';
    const statsSpacing = isCompact ? 'mt-1' : 'mt-1 sm:mt-2';

    const actionText = player.action ? (
        <div className={`absolute ${actionOffset} px-2 py-0.5 text-xs sm:text-sm rounded-md shadow-lg z-20 ${
            player.action === ActionType.FOLD ? 'bg-gray-600' : 
            player.action === ActionType.CHECK || player.action === ActionType.CALL ? 'bg-blue-600' : 'bg-green-600'
        }`}>
            {player.action}
        </div>
    ) : null;
    
    const thinkingIndicator = isCurrent && player.isAI && (
         <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37]"></div>
        </div>
    );

    const blindIndicator = (text: string) => (
        <div className="absolute -top-2 -right-2 w-4 h-4 sm:w-5 sm:h-5 bg-[#2D2D2D] border-2 border-[#5A5A5A] rounded-full flex items-center justify-center text-white font-bold text-[10px] sm:text-xs z-20">
            {text}
        </div>
    );

    return (
        <div className={`${containerWidth} z-20`}>
             <div className={`relative ${paddingClasses} rounded-lg border-2 transition-all duration-300 ${
                    player.isFolded ? 'opacity-40' : ''} 
                    ${isCurrent ? 'breathing-border border-[#FFD700]' : 'border-[#2D2D2D]'} 
                    ${isWinner ? 'animate-winner-glow' : ''}
                    bg-[#242424]`}>
                
                {thinkingIndicator}
                {actionText}
                
                <div className="text-center">
                    <p className={`font-bold truncate ${nameTextClasses} text-white`}>{player.name}</p>
                    <p className={`${stackTextClasses} font-mono text-[#F7E7CE]`}>${player.chips}</p>
                </div>

                <div className={`flex justify-center items-center ${cardHeight} my-1 space-x-1`}>
                    {player.hand.map((card, index) => (
                        <CardComponent key={index} card={card} facedown={!showCards} small />
                    ))}
                     {player.hand.length === 0 && (
                        <div className="w-full h-full flex items-center justify-center">
                             <div className="w-10 h-14" />
                             <div className="w-10 h-14" />
                        </div>
                    )}
                </div>

                {stats && !player.isFolded && (
                    <div className={`${statsSpacing} text-center space-y-1`}>
                        <p className={`text-[11px] sm:text-xs font-semibold text-neutral-400 uppercase tracking-wider ${isCompact ? 'leading-4' : ''}`}>{stats.handName}</p>
                        <div className={`w-full bg-neutral-600 rounded-full ${winMeterHeight} relative overflow-hidden border border-black/20`}>
                            <div 
                                className="bg-gradient-to-r from-yellow-500 to-amber-400 h-full rounded-full transition-all duration-500 ease-out" 
                                style={{ width: `${stats.winProbability}%` }}
                            ></div>
                            <span className={`absolute inset-0 flex items-center justify-center font-bold text-white text-shadow-sm ${winMeterText}`}>
                                {Math.round(stats.winProbability)}% Win
                            </span>
                        </div>
                    </div>
                )}

                {isDealer && blindIndicator('D')}
                {isSmallBlind && blindIndicator('SB')}
                {isBigBlind && blindIndicator('BB')}
            </div>
            <style>{`
                .text-shadow-sm {
                    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
                }
                @keyframes winner-glow {
                    0% { box-shadow: 0 0 8px 3px rgba(212, 175, 55, 0.4); transform: scale(1); }
                    50% { box-shadow: 0 0 24px 10px rgba(255, 215, 0, 0.9); transform: scale(1.05); }
                    100% { box-shadow: 0 0 8px 3px rgba(212, 175, 55, 0.4); transform: scale(1); }
                }
                .animate-winner-glow {
                    animation: winner-glow 1.5s ease-in-out;
                }
            `}</style>
        </div>
    );
};

export default Player;
