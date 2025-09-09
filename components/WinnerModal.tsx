import React from 'react';
// Fix: Corrected import path for types. This ensures the module can be found once types.ts is implemented.
import { Player } from '../types';

interface WinnerModalProps {
  winners: Player[];
  hand: string;
}

const WinnerModal: React.FC<WinnerModalProps> = ({ winners, hand }) => {
  if (winners.length === 0) return null;

  return (
    <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100] p-4">
      <div className="bg-[#1A1A1A] border-4 border-transparent rounded-xl p-6 sm:p-8 text-center shadow-2xl animate-fade-in-down shadow-black/70"
           style={{ borderImage: 'linear-gradient(to bottom right, #FFD700, #B8860B) 1' }}>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#FFD700] mb-2">
          {winners.length > 1 ? 'Split Pot!' : 'Winner!'}
        </h2>
        <p className="text-lg sm:text-xl text-white mb-4 font-semibold">
          {winners.map(w => w.name).join(', ')}
        </p>
        <p className="text-xl sm:text-2xl text-[#F7E7CE]">
          with a {hand}
        </p>
      </div>
       <style>{`
        @keyframes fade-in-down {
          0% {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-fade-in-down {
          animation: fade-in-down 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default WinnerModal;