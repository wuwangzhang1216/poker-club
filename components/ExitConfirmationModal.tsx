import React from 'react';

interface ExitConfirmationModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const ExitConfirmationModal: React.FC<ExitConfirmationModalProps> = ({ onConfirm, onCancel }) => {
  return (
    <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100]">
      <div className="bg-[#1A1A1A] border-4 border-transparent rounded-xl p-8 text-center shadow-2xl animate-fade-in-down shadow-black/70 w-full max-w-md"
           style={{ borderImage: 'linear-gradient(to bottom right, #FFD700, #B8860B) 1' }}>
        <h2 className="text-3xl font-bold text-white mb-4">
          Quit Game?
        </h2>
        <p className="text-lg text-[#CCCCCC] mb-8">
          Are you sure you want to quit? All current game progress will be lost.
        </p>
        <div className="flex space-x-4">
             <button
                onClick={onCancel}
                className="w-full py-3 text-lg action-button secondary"
            >
                Cancel
            </button>
            <button
                onClick={onConfirm}
                className="w-full py-3 text-lg action-button primary"
            >
                Confirm
            </button>
        </div>
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
            background-image: linear-gradient(to bottom right, #c53030, #9b2c2c);
            border-color: #c53030; box-shadow: 0 0 8px 0px rgba(197, 48, 48, 0.4);
        }
        .action-button.primary:not(:disabled):hover {
            box-shadow: 0 0 12px 2px rgba(229, 62, 62, 0.6); transform: translateY(-1px);
        }
        .action-button.secondary {
            background-color: #2D2D2D;
            border-color: #5A5A5A;
            color: #CCCCCC;
        }
        .action-button.secondary:not(:disabled):hover {
             background-color: #3f3f3f;
             border-color: #808080;
             transform: translateY(-1px);
        }
       `}</style>
    </div>
  );
};

export default ExitConfirmationModal;
