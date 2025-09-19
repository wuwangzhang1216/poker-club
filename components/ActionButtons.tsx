import React, { useState, useEffect } from 'react';
import { GameState, ActionType, Player } from '../types';

interface ActionButtonsProps {
    player: Player;
    gameState: GameState;
    onAction: (action: ActionType, amount: number) => void;
    disabled: boolean;
    turnTimeRemaining?: number | null;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ player, gameState, onAction, disabled, turnTimeRemaining }) => {
    const { currentBet, minRaise, bigBlind, pot, players } = gameState;
    const callAmount = Math.min(player.chips, currentBet - player.bet);
    const canCheck = currentBet === player.bet;
    const isCallAllIn = callAmount > 0 && callAmount >= player.chips;

    // --- Revised Raise Logic ---
    const playerTotalStack = player.chips + player.bet;

    // Find the largest total stack (chips + current bet) among active opponents.
    // This determines the "effective stack" for the player's maximum bet.
    const largestOpponentStack = Math.max(
        0,
        ...players
            .filter(p => p.id !== player.id && !p.isFolded)
            .map(p => p.chips + p.bet)
    );

    // The max bet is limited by the player's own stack or the largest opponent stack.
    // If there are no opponents left, this ensures the max is the player's own stack.
    const maxRaiseTotal = largestOpponentStack > 0 
        ? Math.min(playerTotalStack, largestOpponentStack) 
        : playerTotalStack;

    // The "true" minimum raise amount according to poker rules.
    const ruleMinRaiseTotal = currentBet + minRaise;
    
    // Determine if the player's stack is large enough for a standard minimum raise.
    const canMakeStandardRaise = maxRaiseTotal >= ruleMinRaiseTotal;
    
    // The effective minimum raise for the UI is the standard amount, or the player's all-in if they are short-stacked.
    const effectiveMinRaise = canMakeStandardRaise ? ruleMinRaiseTotal : maxRaiseTotal;

    const [raiseAmount, setRaiseAmount] = useState(effectiveMinRaise);
    const isRaiseAllIn = raiseAmount >= maxRaiseTotal;

    useEffect(() => {
        // When the game state changes, reset the slider to the new effective minimum raise.
        setRaiseAmount(effectiveMinRaise);
    }, [effectiveMinRaise]);

    const handleRaise = () => {
        const actionType = currentBet > 0 ? ActionType.RAISE : ActionType.BET;
        onAction(actionType, raiseAmount);
    };

    // Corrected logic for disabling bet/raise controls.
    // Disable if: game is disabled, player has no chips, or their all-in is just a call (or less).
    const isBetRaiseDisabled = disabled || player.chips === 0 || maxRaiseTotal <= currentBet;

    const handleQuickBet = (fraction: number) => {
        const effectivePot = pot + players.reduce((acc, p) => acc + p.bet, 0);
        let targetAmount = Math.round(effectivePot * fraction);
        
        if (currentBet === 0) {
            targetAmount = Math.max(targetAmount, bigBlind);
        }

        // Clamp the quick-bet amount between the minimum possible raise and the player's max.
        const clampedAmount = Math.max(effectiveMinRaise, Math.min(maxRaiseTotal, targetAmount));
        
        // Round to the nearest half-blind.
        const step = gameState.bigBlind / 2;
        const finalAmount = Math.round(clampedAmount / step) * step;
        
        // Final clamp to ensure we don't exceed the player's stack.
        const finalClampedAmount = Math.min(maxRaiseTotal, finalAmount);
        
        setRaiseAmount(finalClampedAmount);
    };

    const containerClasses = `
        flex flex-col space-y-1 sm:space-y-3 p-1 sm:p-2 bg-[#1A1A1A] border-2 
        rounded-2xl sm:rounded-lg shadow-2xl shadow-black/50 w-[90%] sm:w-full 
        sm:max-w-md transition-all duration-300
        ${!disabled ? 'breathing-border border-[#FFD700]' : 'border-[#2D2D2D]'}
    `;

    const showTimer = typeof turnTimeRemaining === 'number';

    return (
        <div className={containerClasses}>
            {showTimer && (
                <div className="text-center text-xs sm:text-sm font-semibold text-[#FFD700] tracking-wide">
                    Act within {Math.max(0, turnTimeRemaining ?? 0)}s
                </div>
            )}
             {/* --- DESKTOP LAYOUT --- */}
            <div className="hidden sm:flex sm:flex-col sm:space-y-3">
                <div className="flex space-x-2">
                    <button onClick={() => onAction(ActionType.FOLD, 0)} disabled={disabled} className="action-button secondary flex-1">Fold</button>
                    {canCheck ? (
                        <button onClick={() => onAction(ActionType.CHECK, 0)} disabled={disabled} className="action-button secondary flex-1">Check</button>
                    ) : (
                        <button onClick={() => onAction(ActionType.CALL, callAmount)} disabled={disabled || callAmount <= 0} className="action-button primary flex-1">
                            {isCallAllIn ? `All-in ($${callAmount})` : `Call $${callAmount}`}
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
                        {isRaiseAllIn ? `All-in ($${raiseAmount})` : `${currentBet > 0 ? 'Raise to' : 'Bet'} $${raiseAmount}`}
                    </button>
                    <div className="flex items-center space-x-3 pt-1">
                        <span className="text-[#999999] text-sm font-mono">${effectiveMinRaise}</span>
                        <input
                            type="range"
                            min={effectiveMinRaise}
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
            </div>
            
            {/* --- MOBILE LAYOUT --- */}
            <div className="flex flex-col space-y-1 sm:hidden">
                <div className="flex items-stretch space-x-2">
                    <div className="flex-grow flex flex-col space-y-1">
                        <button onClick={() => onAction(ActionType.FOLD, 0)} disabled={disabled} className="action-button secondary flex-1">Fold</button>
                         {canCheck ? (
                            <button onClick={() => onAction(ActionType.CHECK, 0)} disabled={disabled} className="action-button secondary flex-1">Check</button>
                        ) : (
                            <button onClick={() => onAction(ActionType.CALL, callAmount)} disabled={disabled || callAmount <= 0} className="action-button primary flex-1">
                                {isCallAllIn 
                                    ? <>All-in<span className="block text-[10px]">${callAmount}</span></>
                                    : <>Call<span className="block text-[10px]">${callAmount}</span></>
                                }
                            </button>
                        )}
                    </div>
                     <button onClick={handleRaise} disabled={isBetRaiseDisabled} className="action-button primary w-2/5 flex flex-col justify-center items-center">
                         {isRaiseAllIn ? 'All-in' : (currentBet > 0 ? 'Raise' : 'Bet')}
                        <span className="text-[11px] font-semibold">${raiseAmount}</span>
                    </button>
                </div>
                <div className="flex items-center space-x-2 pt-0.5">
                    <span className="text-[#999999] text-xs font-mono">${effectiveMinRaise}</span>
                    <input
                        type="range"
                        min={effectiveMinRaise}
                        max={maxRaiseTotal}
                        step={gameState.bigBlind / 2}
                        value={raiseAmount}
                        onChange={(e) => setRaiseAmount(Number(e.target.value))}
                        disabled={isBetRaiseDisabled}
                        className="w-full h-2 bg-[#2D2D2D] rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
                    />
                    <span className="text-[#999999] text-xs font-mono">${maxRaiseTotal}</span>
                </div>
            </div>

             <style>{`
                .action-button {
                    padding: 2px 5px;
                    border-radius: 4px;
                    font-weight: 600; /* semibold */
                    font-size: 0.7rem;
                    line-height: 1.2;
                    color: white;
                    transition: all 0.2s ease-in-out;
                    border: 2px solid transparent;
                    text-align: center;
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
                 @media (min-width: 640px) {
                    .action-button {
                         padding: 10px 16px;
                         font-size: 1rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default ActionButtons;
