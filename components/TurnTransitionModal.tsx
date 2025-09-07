import React from 'react';

interface TurnTransitionModalProps {
  playerName: string;
  onConfirm: () => void;
}

const TurnTransitionModal: React.FC<TurnTransitionModalProps> = ({ playerName, onConfirm }) => {
  return (
    <div className="absolute inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[100]">
      <div className="bg-[#1A1A1A] border-4 border-transparent rounded-xl p-10 text-center shadow-2xl animate-fade-in-down shadow-black/70 w-full max-w-lg"
           style={{ borderImage: 'linear-gradient(to bottom right, #FFD700, #B8860B) 1' }}>
        <h2 className="text-3xl font-bold text-white mb-2">
          Passing turn to
        </h2>
        <p className="text-5xl font-bold text-[#FFD700] mb-6">{playerName}</p>
        <p className="text-lg text-[#CCCCCC] mb-8">
          Confirm when you are ready to see your cards and take your action.
        </p>
        <button
            onClick={onConfirm}
            className="w-full py-3 text-xl action-button primary"
        >
            Start My Turn
        </button>
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
        .action-button {
            padding: 10px 16px; border-radius: 6px; font-weight: 600; font-size: 1rem; color: white;
            transition: all 0.2s ease-in-out; border: 2px solid transparent; cursor: pointer;
        }
        .action-button.primary {
            background-image: linear-gradient(to bottom right, #D4AF37, #B8860B);
            border-color: #D4AF37; box-shadow: 0 0 8px 0px rgba(212, 175, 55, 0.4);
        }
        .action-button.primary:not(:disabled):hover {
            box-shadow: 0 0 12px 2px rgba(255, 215, 0, 0.6); transform: translateY(-1px);
        }
       `}</style>
    </div>
  );
};

export default TurnTransitionModal;
