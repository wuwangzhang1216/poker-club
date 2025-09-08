import { ActionType, LobbyConfig, PlayerConfig } from './types';

// Assumes the backend API is served from the same origin under /api
const API_BASE_URL = 'http://localhost:8000/api';

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
        console.error('API Error:', JSON.stringify(errorData, null, 2));

        let errorMessage = `HTTP error! status: ${response.status}`;
        if (errorData.detail) {
            // FastAPI validation errors are often in an array of objects
            if (Array.isArray(errorData.detail)) {
                errorMessage = errorData.detail.map((err: any) => `${err.loc.join(' -> ')}: ${err.msg}`).join(', ');
            } else {
                errorMessage = String(errorData.detail);
            }
        } else if (errorData.message) {
            errorMessage = errorData.message;
        }

        throw new Error(errorMessage);
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
    return apiRequest<LobbyConfig>('/lobby/create', {
        method: 'POST',
        body: JSON.stringify({
            hostConfig: hostConfig,
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