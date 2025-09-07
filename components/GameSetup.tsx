import React, { useState } from 'react';

export interface PlayerConfig {
    id: number;
    name: string;
    chips: number;
    isAI: boolean;
}

interface GameSetupProps {
    onCreateLobby: (playerConfigs: PlayerConfig[], smallBlind: number, bigBlind: number) => void;
}

const GameSetup: React.FC<GameSetupProps> = ({ onCreateLobby }) => {
    const [players, setPlayers] = useState<PlayerConfig[]>([
        { id: 1, name: 'Human', chips: 1000, isAI: false },
        { id: 2, name: 'Gemini 1', chips: 1000, isAI: true },
        { id: 3, name: 'Gemini 2', chips: 1000, isAI: true },
        { id: 4, name: 'Gemini 3', chips: 1000, isAI: true },
    ]);
    const [smallBlind, setSmallBlind] = useState(10);
    const [bigBlind, setBigBlind] = useState(20);

    const updatePlayer = (id: number, field: keyof PlayerConfig, value: string | number | boolean) => {
        setPlayers(players.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const addPlayer = () => {
        if (players.length < 8) {
            const newId = Date.now();
            const aiCount = players.filter(p => p.isAI).length + 1;
            setPlayers([...players, { id: newId, name: `Gemini ${aiCount}`, chips: 1000, isAI: true }]);
        }
    };
    
    const removePlayer = (id: number) => {
        if (players.length > 2) {
            setPlayers(players.filter(p => p.id !== id));
        }
    };

    const handleCreate = () => {
        if (players.length >= 2 && smallBlind > 0 && bigBlind > smallBlind) {
            onCreateLobby(players, smallBlind, bigBlind);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-[#0A0A0A] py-8">
            <div className="p-8 bg-[#1C1C1C] border-2 border-neutral-800 rounded-lg shadow-2xl text-white w-full max-w-2xl space-y-6 shadow-black/50">
                <h1 className="text-4xl font-bold text-center text-[#D4AF37]">Game Setup</h1>
                
                {/* Players List */}
                <div className="space-y-3">
                     <h2 className="text-2xl font-semibold text-neutral-300 border-b-2 border-neutral-700 pb-2">Players</h2>
                     <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                        {players.map((player, index) => (
                            <div key={player.id} className="flex items-center space-x-3 bg-[#2D2D2D] p-2 rounded-md">
                               <span className="text-lg font-bold text-neutral-400 w-6 text-center">{index + 1}</span>
                               <input
                                    type="text"
                                    value={player.name}
                                    onChange={(e) => updatePlayer(player.id, 'name', e.target.value)}
                                    className="flex-grow p-2 bg-[#1A1A1A] border border-neutral-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                                    placeholder="Player Name"
                                />
                                <input
                                    type="number"
                                    value={player.chips}
                                    onChange={(e) => updatePlayer(player.id, 'chips', parseInt(e.target.value) || 0)}
                                    className="w-28 p-2 bg-[#1A1A1A] border border-neutral-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                                />
                                <button onClick={() => updatePlayer(player.id, 'isAI', !player.isAI)} className={`px-4 py-2 rounded-md font-semibold ${player.isAI ? 'bg-sky-700' : 'bg-amber-600'}`}>
                                    {player.isAI ? 'AI' : 'Human'}
                                </button>
                                <button onClick={() => removePlayer(player.id)} disabled={players.length <= 2} className="px-3 py-2 bg-red-800 rounded-md hover:bg-red-700 disabled:bg-neutral-600 disabled:opacity-50">
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        ))}
                     </div>
                     <button onClick={addPlayer} disabled={players.length >= 8} className="w-full py-2 action-button secondary disabled:opacity-50">Add Player</button>
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

                <button onClick={handleCreate} className="w-full py-3 mt-4 text-xl action-button primary">Create Lobby</button>
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

export default GameSetup;
