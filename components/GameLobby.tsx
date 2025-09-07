import React, { useState } from 'react';
import { PlayerConfig } from './GameSetup';

interface GameLobbyProps {
    lobbyConfig: {
        players: PlayerConfig[];
        smallBlind: number;
        bigBlind: number;
    };
    onStartGame: () => void;
    onBackToSetup: () => void;
}

const GameLobby: React.FC<GameLobbyProps> = ({ lobbyConfig, onStartGame, onBackToSetup }) => {
    const { players, smallBlind, bigBlind } = lobbyConfig;
    const [copyButtonText, setCopyButtonText] = useState('Copy');

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            setCopyButtonText('Copied!');
            setTimeout(() => setCopyButtonText('Copy'), 2000);
        });
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-[#0A0A0A] py-8">
            <div className="p-8 bg-[#1C1C1C] border-2 border-neutral-800 rounded-lg shadow-2xl text-white w-full max-w-2xl space-y-6 shadow-black/50">
                <h1 className="text-4xl font-bold text-center text-[#D4AF37]">Game Lobby</h1>
                
                {/* Share Link */}
                <div className="space-y-3">
                    <h2 className="text-xl font-semibold text-neutral-300">Share Game Link to Invite Friends</h2>
                    <div className="flex space-x-2">
                        <input
                            type="text"
                            readOnly
                            value={window.location.href}
                            className="flex-grow p-2 bg-[#1A1A1A] border border-neutral-700 rounded-md text-neutral-400 font-mono"
                        />
                        <button onClick={handleCopyLink} className="px-4 py-2 action-button secondary w-24">{copyButtonText}</button>
                    </div>
                </div>

                {/* Players List */}
                <div className="space-y-3">
                     <h2 className="text-2xl font-semibold text-neutral-300 border-b-2 border-neutral-700 pb-2">Players in Lobby</h2>
                     <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                        {players.map((player, index) => (
                            <div key={player.id} className="flex items-center space-x-3 bg-[#2D2D2D] p-3 rounded-md">
                               <span className="text-lg font-bold text-neutral-400 w-6 text-center">{index + 1}</span>
                               <span className="flex-grow font-semibold text-white text-lg">{player.name}</span>
                               <span className="font-mono text-lg text-[#F7E7CE]">${player.chips}</span>
                               <span className={`px-3 py-1 rounded-md font-semibold text-sm ${player.isAI ? 'bg-sky-700/80' : 'bg-amber-600/80'}`}>
                                    {player.isAI ? 'AI' : 'Human'}
                                </span>
                            </div>
                        ))}
                     </div>
                </div>

                {/* Game Info */}
                <div className="flex justify-between items-center bg-[#2D2D2D] p-3 rounded-md">
                    <h3 className="text-lg font-semibold text-neutral-300">Blinds</h3>
                    <p className="font-mono text-lg text-white">
                        <span className="text-neutral-400">SB:</span> ${smallBlind} / <span className="text-neutral-400">BB:</span> ${bigBlind}
                    </p>
                </div>
                
                {/* Action Buttons */}
                <div className="flex space-x-4 pt-4">
                    <button onClick={onBackToSetup} className="w-full py-3 text-xl action-button secondary">Back to Setup</button>
                    <button onClick={onStartGame} className="w-full py-3 text-xl action-button primary">Start Game</button>
                </div>

                 <style>{`
                    .action-button { padding: 10px 16px; border-radius: 6px; font-weight: 600; color: white; transition: all 0.2s ease-in-out; border: 2px solid transparent; }
                    .action-button:disabled { cursor: not-allowed; }
                    .action-button.primary { background-image: linear-gradient(to bottom right, #D4AF37, #B8860B); border-color: #D4AF37; box-shadow: 0 0 8px 0px rgba(212, 175, 55, 0.4); }
                    .action-button.primary:not(:disabled):hover { box-shadow: 0 0 12px 2px rgba(255, 215, 0, 0.6); transform: translateY(-1px); }
                    .action-button.secondary { background-color: #2D2D2D; border-color: #5A5A5A; color: #CCCCCC; }
                    .action-button.secondary:not(:disabled):hover { background-color: #3f3f3f; border-color: #808080; }
                `}</style>
            </div>
        </div>
    );
};

export default GameLobby;
