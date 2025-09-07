import { ActionType, LobbyConfig, PlayerConfig } from './types';

// Assumes the backend API is served from the same origin under /api
const API_BASE_URL = '/api';

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
        console.error('API Error:', errorData);
        throw new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);
    }
    return response.json() as Promise<T>;
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    };
    return fetch(url, config).then(handleResponse<T>);
}

export const createLobby = (hostConfig: PlayerConfig, smallBlind: number, bigBlind: number) => {
    return apiRequest<{ lobby_id: string; host: PlayerConfig }>('/lobby/create', {
        method: 'POST',
        body: JSON.stringify({
            host_name: hostConfig.name,
            host_chips: hostConfig.chips,
            small_blind: smallBlind,
            big_blind: bigBlind,
        }),
    });
};

export const joinLobby = (lobbyId: string, name: string, chips: number) => {
    return apiRequest<{ player: PlayerConfig }>(`/lobby/join`, {
        method: 'POST',
        body: JSON.stringify({
            lobby_id: lobbyId,
            player_name: name,
            player_chips: chips,
        }),
    });
};

export const getLobby = (lobbyId: string) => {
    return apiRequest<LobbyConfig>(`/lobby/${lobbyId}`);
};

export const startGame = (lobbyId: string) => {
    return apiRequest(`/lobby/${lobbyId}/start`, {
        method: 'POST',
    });
};

export const addAiPlayer = (lobbyId: string) => {
    // Note: The backend API spec didn't explicitly list this, but is required by the UI.
    // Assuming a POST to /api/lobby/{lobby_id}/add_ai
    return apiRequest(`/lobby/${lobbyId}/add_ai`, {
        method: 'POST',
    });
};

export const removePlayer = (lobbyId: string, playerId: string) => {
    // Note: The backend API spec didn't explicitly list this, but is required by the UI.
    // Assuming a POST to /api/lobby/{lobby_id}/remove_player
    return apiRequest(`/lobby/${lobbyId}/remove_player`, {
        method: 'POST',
        body: JSON.stringify({ player_id: playerId }),
    });
};

export const sendPlayerAction = (lobbyId: string, playerId: string, action: ActionType, amount: number) => {
     return apiRequest('/game/action', {
        method: 'POST',
        body: JSON.stringify({
            lobby_id: lobbyId,
            player_id: playerId,
            action: action.toUpperCase(),
            amount: amount,
        }),
    });
};
