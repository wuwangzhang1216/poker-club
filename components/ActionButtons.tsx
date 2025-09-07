import React, { useState, useEffect } from 'react';
import { GameState, ActionType, Player } from '../types';

interface ActionButtonsProps {
    player: Player;
    gameState: GameState;
    onAction: (action: ActionType, amount: number) => void;
    disabled: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ player, gameState, onAction, disabled }) => {
    const { currentBet, minRaise, bigBlind, pot, players } = gameState;
    const callAmount = Math.min(player.chips, currentBet - player.bet);
    const canCheck = currentBet === player.bet;

    const minRaiseTotal = Math.min(player.chips + player.bet, currentBet + minRaise);
    const maxRaiseTotal = player.chips + player.bet;

    const [raiseAmount, setRaiseAmount] = useState(minRaiseTotal);

    useEffect(() => {
        setRaiseAmount(minRaiseTotal);
    }, [minRaiseTotal]);

    const handleRaise = () => {
        const actionType = currentBet > 0 ? ActionType.RAISE : ActionType.BET;
        onAction(actionType, raiseAmount);
    };

    const isBetRaiseDisabled = disabled || maxRaiseTotal <= minRaiseTotal || player.chips === 0;

    const handleQuickBet = (fraction: number) => {
        // Effective pot is the main pot plus all bets in the current round
        const effectivePot = pot + players.reduce((acc, p) => acc + p.bet, 0);

        // Calculate the desired bet/raise amount
        let targetAmount = Math.round(effectivePot * fraction);
        
        // If there is no current bet, the minimum bet is the big blind.
        if (currentBet === 0) {
            targetAmount = Math.max(targetAmount, bigBlind);
        }

        // Clamp the value between the legal min and max raise amounts.
        const clampedAmount = Math.max(minRaiseTotal, Math.min(maxRaiseTotal, targetAmount));
        
        // Round the final amount to the nearest step to match the slider
        const step = gameState.bigBlind / 2;
        const finalAmount = Math.round(clampedAmount / step) * step;
        
        // Final check to make sure rounding didn't push it over the max
        const finalClampedAmount = Math.min(maxRaiseTotal, finalAmount);
        
        setRaiseAmount(finalClampedAmount);
    };

    return (
        <div className="flex flex-col space-y-3 p-4 bg-[#1A1A1A] border-2 border-[#2D2D2D] rounded-lg shadow-2xl shadow-black/50 w-80">
            <div className="flex space-x-2">
                <button onClick={() => onAction(ActionType.FOLD, 0)} disabled={disabled} className="action-button secondary flex-1">Fold</button>
                {canCheck ? (
                    <button onClick={() => onAction(ActionType.CHECK, 0)} disabled={disabled} className="action-button secondary flex-1">Check</button>
                ) : (
                    <button onClick={() => onAction(ActionType.CALL, callAmount)} disabled={disabled || callAmount <= 0} className="action-button primary flex-1">
                        Call ${callAmount}
                    </button>
                )}
            </div>
            <div className="flex space-x-2">
                <button onClick={() => handleQuickBet(0.25)} disabled={isBetRaiseDisabled} className="action-button secondary flex-1 text-sm py-1.5">1/4 Pot</button>
                <button onClick={() => handleQuickBet(0.33)} disabled={isBetRaiseDisabled} className="action-button secondary flex-1 text-sm py-1.5">1/3 Pot</button>
                <button onClick={() => handleQuickBet(0.5)} disabled={isBetRaiseDisabled} className="action-button secondary flex-1 text-sm py-1.5">1/2 Pot</button>
            </div>
            <div className="flex flex-col space-y-2">
                 <button onClick={handleRaise} disabled={isBetRaiseDisabled} className="action-button primary w-full">
                    {currentBet > 0 ? 'Raise to' : 'Bet'} ${raiseAmount}
                </button>
                <div className="flex items-center space-x-3 pt-1">
                     <span className="text-[#999999] text-sm font-mono">${minRaiseTotal}</span>
                     <input
                        type="range"
                        min={minRaiseTotal}
                        max={maxRaiseTotal}
                        step={gameState.bigBlind / 2}
                        value={raiseAmount}
                        onChange={(e) => setRaiseAmount(Number(e.target.value))}
                        disabled={isBetRaiseDisabled}
                        className="w-full h-2 bg-[#2D2D2D] rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
                    />
                     <span className="text-[#999999] text-sm font-mono">${maxRaiseTotal}</span>
                </div>
            </div>
             <style>{`
                .action-button {
                    padding: 10px 16px;
                    border-radius: 6px;
                    font-weight: 600; /* semibold */
                    font-size: 1rem;
                    color: white;
                    transition: all 0.2s ease-in-out;
                    border: 2px solid transparent;
                }
                .action-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    box-shadow: none;
                }
                
                .action-button.primary {
                    background-image: linear-gradient(to bottom right, #D4AF37, #B8860B);
                    border-color: #D4AF37;
                    box-shadow: 0 0 8px 0px rgba(212, 175, 55, 0.4);
                }
                .action-button.primary:not(:disabled):hover {
                    box-shadow: 0 0 12px 2px rgba(255, 215, 0, 0.6);
                    transform: translateY(-1px);
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

export default ActionButtons;