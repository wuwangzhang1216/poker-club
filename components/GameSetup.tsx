import React, { useState } from 'react';
import { PlayerConfig } from '../types';

interface GameSetupProps {
    onCreateLobby: (hostConfig: PlayerConfig, smallBlind: number, bigBlind: number) => void;
}
const generateId = () => Math.random().toString(36).substring(2, 9);

const GameSetup: React.FC<GameSetupProps> = ({ onCreateLobby }) => {
    const [hostName, setHostName] = useState('Player 1');
    const [chips, setChips] = useState(1000);
    const [smallBlind, setSmallBlind] = useState(10);
    const [bigBlind, setBigBlind] = useState(20);

    const handleCreate = () => {
        if (hostName.trim() && chips > 0 && smallBlind > 0 && bigBlind > smallBlind) {
            const hostConfig: PlayerConfig = {
                id: generateId(),
                name: hostName,
                chips: chips,
                isAI: false,
                isHost: true
            };
            onCreateLobby(hostConfig, smallBlind, bigBlind);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-[#0A0A0A] py-8">
            <div className="p-8 bg-[#1C1C1C] border-2 border-neutral-800 rounded-lg shadow-2xl text-white w-full max-w-lg space-y-8 shadow-black/50">
                <h1 className="text-4xl font-bold text-center text-[#D4AF37]">Create a New Game</h1>
                
                {/* Host Player Settings */}
                <div className="space-y-4">
                     <h2 className="text-2xl font-semibold text-neutral-300 border-b-2 border-neutral-700 pb-2">Your Details</h2>
                    <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
                        <div className="space-y-2 flex-grow">
                             <label htmlFor="hostName" className="block text-lg text-neutral-300">Your Name</label>
                             <input
                                id="hostName"
                                type="text"
                                value={hostName}
                                onChange={(e) => setHostName(e.target.value)}
                                className="w-full p-2 bg-[#1A1A1A] border border-neutral-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                                placeholder="Enter your name"
                            />
                        </div>
                         <div className="space-y-2 w-full sm:w-40">
                            <label htmlFor="chips" className="block text-lg text-neutral-300">Starting Chips</label>
                            <input
                                id="chips"
                                type="number"
                                value={chips}
                                step="100"
                                min="100"
                                onChange={(e) => setChips(parseInt(e.target.value, 10) || 1000)}
                                className="w-full p-2 bg-[#1A1A1A] border border-neutral-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                            />
                        </div>
                    </div>
                </div>

                {/* Blinds Settings */}
                 <div className="space-y-4">
                     <h2 className="text-2xl font-semibold text-neutral-300 border-b-2 border-neutral-700 pb-2">Blinds</h2>
                    <div className="flex space-x-4">
                        <div className="space-y-2 w-1/2">
                            <label htmlFor="smallBlind" className="block text-lg text-neutral-300">Small Blind: <span className="font-bold text-[#F7E7CE]">${smallBlind}</span></label>
                            <input id="smallBlind" type="range" min="5" max="100" step="5" value={smallBlind} onChange={(e) => setSmallBlind(Math.min(parseInt(e.target.value, 10), bigBlind - 5))} className="w-full h-2 bg-[#2D2D2D] rounded-lg appearance-none cursor-pointer accent-[#D4AF37]" />
                        </div>
                        <div className="space-y-2 w-1/2">
                            <label htmlFor="bigBlind" className="block text-lg text-neutral-300">Big Blind: <span className="font-bold text-[#F7E7CE]">${bigBlind}</span></label>
                            <input id="bigBlind" type="range" min="10" max="200" step="10" value={bigBlind} onChange={(e) => setBigBlind(Math.max(parseInt(e.target.value, 10), smallBlind + 5))} className="w-full h-2 bg-[#2D2D2D] rounded-lg appearance-none cursor-pointer accent-[#D4AF37]" />
                        </div>
                    </div>
                </div>

                <button onClick={handleCreate} className="w-full py-3 mt-4 text-xl action-button primary">Create Game Lobby</button>
                 <style>{`
                    .action-button { padding: 10px 16px; border-radius: 6px; font-weight: 600; color: white; transition: all 0.2s ease-in-out; border: 2px solid transparent; }
                    .action-button:disabled { cursor: not-allowed; }
                    .action-button.primary { background-image: linear-gradient(to bottom right, #D4AF37, #B8860B); border-color: #D4AF37; box-shadow: 0 0 8px 0px rgba(212, 175, 55, 0.4); }
                    .action-button.primary:not(:disabled):hover { box-shadow: 0 0 12px 2px rgba(255, 215, 0, 0.6); transform: translateY(-1px); }
                `}</style>
            </div>
        </div>
    );
};

export default GameSetup;
