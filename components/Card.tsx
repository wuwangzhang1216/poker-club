import React from 'react';
import { Card, Suit } from '../types';

interface CardProps {
    card: Card;
    facedown?: boolean;
    small?: boolean;
}

const SuitIcon: React.FC<{ suit: Suit }> = ({ suit }) => {
    const color = suit === Suit.HEARTS || suit === Suit.DIAMONDS ? 'text-[#FF3333]' : 'text-[#1A1A1A]';
    return <span className={color}>{suit}</span>;
}

const CardComponent: React.FC<CardProps> = ({ card, facedown = false, small = false }) => {
    if (facedown) {
        const sizeClasses = small 
            ? 'w-10 h-14'
            : 'w-12 h-16 sm:w-16 sm:h-24 md:w-20 md:h-28';
        const svgSizeClasses = small ? 'w-5 h-5' : 'w-8 h-8 sm:w-12 sm:h-12';

        return (
            <div className={`${sizeClasses} bg-[#1A1A1A] border border-black/50 rounded-md flex items-center justify-center shadow-lg p-1`}>
                <div className="w-full h-full border border-[#B8860B]/50 rounded-sm flex items-center justify-center">
                    <svg className={`text-[#B8860B] opacity-70 ${svgSizeClasses}`} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.0001 2L9.2291 5.33333L12.0001 8.66667L14.771 5.33333L12.0001 2Z" />
                        <path d="M5.33325 9.2291L1.99992 12.0001L5.33325 14.771L8.66659 12.0001L5.33325 9.2291Z" />
                        <path d="M18.6668 9.2291L15.3334 12.0001L18.6668 14.771L22.0001 12.0001L18.6668 9.2291Z" />
                        <path d="M12.0001 15.3334L9.2291 18.6667L12.0001 22L14.771 18.6667L12.0001 15.3334Z" />
                    </svg>
                </div>
            </div>
        );
    }

    const sizeClasses = small 
        ? 'w-10 h-14 rounded-md text-base p-0.5' 
        : 'w-12 h-16 text-lg p-1 sm:w-16 sm:h-24 sm:text-2xl md:w-20 md:h-28 rounded-lg md:text-4xl md:p-2';

    return (
        <>
        <div className={`relative bg-[#FAFAFA] text-black ${sizeClasses} font-bold flex flex-col justify-start shadow-lg border border-gray-400 animate-flip-in`}>
            <div className="flex flex-col items-start leading-none">
                <span>{card.rank}</span>
                <SuitIcon suit={card.suit} />
            </div>
        </div>
        <style>{`
            @keyframes flip-in {
                0% {
                    transform: rotateY(90deg) scale(0.9);
                    opacity: 0;
                }
                100% {
                    transform: rotateY(0deg) scale(1);
                    opacity: 1;
                }
            }
            .animate-flip-in {
                animation: flip-in 0.4s ease-out forwards;
            }
        `}</style>
        </>
    );
};

export default CardComponent;
