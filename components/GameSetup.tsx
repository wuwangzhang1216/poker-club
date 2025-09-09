import React, { useState, useEffect } from 'react';
import { PlayerConfig, AIDifficulty } from '../types';
import audioService from '../services/audioService';

interface GameSetupProps {
    onStartGame: (playerConfig: PlayerConfig, aiCount: number, smallBlind: number, bigBlind: number, aiDifficulty: AIDifficulty) => void;
}

const generateId = () => `player_${Math.random().toString(36).substring(2, 9)}`;

const GameSetup: React.FC<GameSetupProps> = ({ onStartGame }) => {
    const [playerName, setPlayerName] = useState('Player 1');
    const [chips, setChips] = useState(1000);
    const [smallBlind, setSmallBlind] = useState(10);
    const [bigBlind, setBigBlind] = useState(20);
    const [aiCount, setAiCount] = useState(3);
    const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>(AIDifficulty.MEDIUM);
    const [soundsReady, setSoundsReady] = useState(audioService.areSoundsLoaded());

    useEffect(() => {
        audioService.onSoundsLoaded(() => {
            setSoundsReady(true);
        });
    }, []);


    const handleStart = () => {
        if (playerName.trim() && chips > 0 && smallBlind > 0 && bigBlind > smallBlind) {
            const playerConfig: PlayerConfig = {
                id: generateId(),
                name: playerName,
                chips: chips,
                isAI: false,
            };
            onStartGame(playerConfig, aiCount, smallBlind, bigBlind, aiDifficulty);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-[#0A0A0A] p-4">
            <div className="p-6 sm:p-8 bg-[#1C1C1C] border-2 border-neutral-800 rounded-lg shadow-2xl text-white w-full max-w-lg space-y-6 sm:space-y-8 shadow-black/50">
                <h1 className="text-3xl sm:text-4xl font-bold text-center text-[#D4AF37]">New Poker Game</h1>
                
                <div className="space-y-4">
                     <h2 className="text-xl sm:text-2xl font-semibold text-neutral-300 border-b-2 border-neutral-700 pb-2">Your Details</h2>
                    <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
                        <div className="space-y-2 flex-grow">
                             <label htmlFor="playerName" className="block text-base sm:text-lg text-neutral-300">Your Name</label>
                             <input
                                id="playerName"
                                type="text"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                className="w-full p-2 bg-[#1A1A1A] border border-neutral-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                                placeholder="Enter your name"
                            />
                        </div>
                         <div className="space-y-2 w-full sm:w-40">
                            <label htmlFor="chips" className="block text-base sm:text-lg text-neutral-300">Starting Chips</label>
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
                
                 <div className="space-y-4">
                     <h2 className="text-xl sm:text-2xl font-semibold text-neutral-300 border-b-2 border-neutral-700 pb-2">Game Settings</h2>
                    <div className="space-y-4">
                         <div className="space-y-2">
                            <label htmlFor="aiCount" className="block text-base sm:text-lg text-neutral-300">AI Opponents: <span className="font-bold text-[#F7E7CE]">{aiCount}</span></label>
                            <input id="aiCount" type="range" min="1" max="7" value={aiCount} onChange={(e) => setAiCount(parseInt(e.target.value, 10))} className="w-full h-2 bg-[#2D2D2D] rounded-lg appearance-none cursor-pointer accent-[#D4AF37]" />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-base sm:text-lg text-neutral-300">AI Difficulty</label>
                            <div className="flex rounded-md bg-[#2D2D2D] p-1">
                                {Object.values(AIDifficulty).map((level) => (
                                    <button
                                        key={level}
                                        onClick={() => setAiDifficulty(level)}
                                        className={`flex-1 p-2 rounded text-sm sm:text-base font-semibold transition-colors duration-200 focus:outline-none capitalize ${
                                            aiDifficulty === level
                                                ? 'bg-[#D4AF37] text-black shadow-md'
                                                : 'bg-transparent text-neutral-400 hover:bg-[#3f3f3f]'
                                        }`}
                                    >
                                        {level.toLowerCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex space-x-4">
                            <div className="space-y-2 w-1/2">
                                <label htmlFor="smallBlind" className="block text-base sm:text-lg text-neutral-300">Small Blind: <span className="font-bold text-[#F7E7CE]">${smallBlind}</span></label>
                                <input id="smallBlind" type="range" min="5" max="100" step="5" value={smallBlind} onChange={(e) => setSmallBlind(Math.min(parseInt(e.target.value, 10), bigBlind - 5))} className="w-full h-2 bg-[#2D2D2D] rounded-lg appearance-none cursor-pointer accent-[#D4AF37]" />
                            </div>
                            <div className="space-y-2 w-1/2">
                                <label htmlFor="bigBlind" className="block text-base sm:text-lg text-neutral-300">Big Blind: <span className="font-bold text-[#F7E7CE]">${bigBlind}</span></label>
                                <input id="bigBlind" type="range" min="10" max="200" step="10" value={bigBlind} onChange={(e) => setBigBlind(Math.max(parseInt(e.target.value, 10), smallBlind + 5))} className="w-full h-2 bg-[#2D2D2D] rounded-lg appearance-none cursor-pointer accent-[#D4AF37]" />
                            </div>
                        </div>
                    </div>
                </div>

                <button onClick={handleStart} disabled={!soundsReady} className="w-full py-3 mt-4 text-lg sm:text-xl action-button primary">
                    {soundsReady ? 'Start Game' : 'Loading Sounds...'}
                </button>
                 <style>{`
                    .action-button { padding: 10px 16px; border-radius: 6px; font-weight: 600; color: white; transition: all 0.2s ease-in-out; border: 2px solid transparent; }
                    .action-button:disabled { cursor: not-allowed; opacity: 0.6; }
                    .action-button.primary { background-image: linear-gradient(to bottom right, #D4AF37, #B8860B); border-color: #D4AF37; box-shadow: 0 0 8px 0px rgba(212, 175, 55, 0.4); }
                    .action-button.primary:not(:disabled):hover { box-shadow: 0 0 12px 2px rgba(255, 215, 0, 0.6); transform: translateY(-1px); }
                `}</style>
            </div>
        </div>
    );
};

export default GameSetup;