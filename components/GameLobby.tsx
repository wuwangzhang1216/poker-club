import React, { useState, useMemo } from 'react';
import { LobbyConfig, PlayerConfig } from '../types';

interface GameLobbyProps {
    lobbyConfig: LobbyConfig;
    onStartGame: () => void;
    onBackToSetup: () => void;
    onUpdateLobby: (updatedLobby: LobbyConfig) => void;
    currentUserId: string | null;
    onSetCurrentUser: (id: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const JoinForm: React.FC<{ onJoin: (name: string, chips: number) => void }> = ({ onJoin }) => {
    const [name, setName] = useState('');
    const [chips, setChips] = useState(1000);
    
    const handleJoin = () => {
        if(name.trim()) {
            onJoin(name, chips);
        }
    }

    return (
        <div className="bg-[#2D2D2D] p-4 rounded-md mt-4 space-y-3 text-center">
            <h3 className="text-xl font-semibold text-white">You've been invited!</h3>
            <p className="text-neutral-400">Enter your details to take a seat at the table.</p>
            <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0">
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-grow p-2 bg-[#1A1A1A] border border-neutral-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    placeholder="Enter your name"
                />
                <input
                    type="number"
                    value={chips}
                    step="100"
                    onChange={(e) => setChips(parseInt(e.target.value, 10) || 1000)}
                    className="sm:w-32 p-2 bg-[#1A1A1A] border border-neutral-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
            </div>
            <button onClick={handleJoin} className="w-full py-2 action-button primary">Take Seat</button>
        </div>
    );
};


const GameLobby: React.FC<GameLobbyProps> = ({ lobbyConfig, onStartGame, onBackToSetup, onUpdateLobby, currentUserId, onSetCurrentUser }) => {
    const { players, smallBlind, bigBlind } = lobbyConfig;
    const [copyButtonText, setCopyButtonText] = useState('Copy');

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            setCopyButtonText('Copied!');
            setTimeout(() => setCopyButtonText('Copy'), 2000);
        });
    };
    
    const isCurrentUserInLobby = useMemo(() => 
        players.some(p => p.id === currentUserId),
        [players, currentUserId]
    );

    const isHost = useMemo(() => 
        players.find(p => p.id === currentUserId)?.isHost ?? false,
        [players, currentUserId]
    );

    const handleJoinLobby = (name: string, chips: number) => {
        const newPlayer: PlayerConfig = {
            id: generateId(),
            name,
            chips,
            isAI: false,
        };
        const updatedLobby = { ...lobbyConfig, players: [...lobbyConfig.players, newPlayer] };
        onUpdateLobby(updatedLobby);
        onSetCurrentUser(newPlayer.id);
    };

    const handleAddAI = () => {
        const aiCount = players.filter(p => p.isAI).length + 1;
        const newAI: PlayerConfig = {
            id: generateId(),
            name: `Gemini Agent ${aiCount}`,
            chips: 1000,
            isAI: true,
        };
        onUpdateLobby({ ...lobbyConfig, players: [...lobbyConfig.players, newAI] });
    };

    const handleRemovePlayer = (id: string) => {
        onUpdateLobby({ ...lobbyConfig, players: players.filter(p => p.id !== id) });
    };


    return (
        <div className="flex items-center justify-center min-h-screen bg-[#0A0A0A] py-8">
            <div className="p-8 bg-[#1C1C1C] border-2 border-neutral-800 rounded-lg shadow-2xl text-white w-full max-w-2xl space-y-6 shadow-black/50">
                <h1 className="text-4xl font-bold text-center text-[#D4AF37]">Game Lobby</h1>
                
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

                <div className="space-y-3">
                     <h2 className="text-2xl font-semibold text-neutral-300 border-b-2 border-neutral-700 pb-2">Players in Lobby ({players.length}/8)</h2>
                     <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                        {players.map((player) => (
                            <div key={player.id} className="flex items-center space-x-3 bg-[#2D2D2D] p-3 rounded-md">
                               <span className={`px-3 py-1 rounded-md font-semibold text-sm ${player.isHost ? 'bg-amber-600/80' : (player.isAI ? 'bg-sky-700/80' : 'bg-green-600/80')}`}>
                                    {player.isHost ? 'Host' : (player.isAI ? 'AI' : 'Player')}
                                </span>
                               <span className="flex-grow font-semibold text-white text-lg">{player.name}</span>
                               <span className="font-mono text-lg text-[#F7E7CE]">${player.chips}</span>
                               {isHost && !player.isHost && (
                                   <button onClick={() => handleRemovePlayer(player.id)} className="px-2 py-1 bg-red-800/80 rounded-md hover:bg-red-700">
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                   </button>
                               )}
                            </div>
                        ))}
                     </div>
                     {!isCurrentUserInLobby && <JoinForm onJoin={handleJoinLobby} />}
                     {isHost && players.length < 8 && <button onClick={handleAddAI} className="w-full py-2 mt-2 action-button secondary">Add AI Player</button>}
                </div>

                <div className="flex justify-between items-center bg-[#2D2D2D] p-3 rounded-md">
                    <h3 className="text-lg font-semibold text-neutral-300">Blinds</h3>
                    <p className="font-mono text-lg text-white">
                        <span className="text-neutral-400">SB:</span> ${smallBlind} / <span className="text-neutral-400">BB:</span> ${bigBlind}
                    </p>
                </div>
                
                <div className="flex space-x-4 pt-4">
                    <button onClick={onBackToSetup} className="w-full py-3 text-xl action-button secondary">Exit Lobby</button>
                    {isHost ? (
                        <button onClick={onStartGame} disabled={players.length < 2} className="w-full py-3 text-xl action-button primary disabled:opacity-50">Start Game</button>
                    ) : (
                         <div className="w-full py-3 text-xl text-center font-semibold text-neutral-400">Waiting for host...</div>
                    )}
                </div>

                 <style>{`
                    .action-button { padding: 10px 16px; border-radius: 6px; font-weight: 600; color: white; transition: all 0.2s ease-in-out; border: 2px solid transparent; cursor: pointer; }
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
