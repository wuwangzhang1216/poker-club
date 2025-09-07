export enum Suit {
    HEARTS = '♥',
    DIAMONDS = '♦',
    CLUBS = '♣',
    SPADES = '♠',
}

export enum Rank {
    TWO = '2',
    THREE = '3',
    FOUR = '4',
    FIVE = '5',
    SIX = '6',
    SEVEN = '7',
    EIGHT = '8',
    NINE = '9',
    TEN = 'T',
    JACK = 'J',
    QUEEN = 'Q',
    KING = 'K',
    ACE = 'A',
}

export interface Card {
    suit: Suit;
    rank: Rank;
}

export enum ActionType {
    FOLD = 'FOLD',
    CHECK = 'CHECK',
    CALL = 'CALL',
    BET = 'BET',
    RAISE = 'RAISE',
}

export interface PlayerConfig {
    id: string;
    name: string;
    chips: number;
    isAI: boolean;
    isHost?: boolean;
}

export interface LobbyConfig {
    players: PlayerConfig[];
    smallBlind: number;
    bigBlind: number;
    gameState?: GameState | null;
}


export interface Player {
    id:string;
    name: string;
    chips: number;
    hand: Card[];
    isAI: boolean;
    isFolded: boolean;
    bet: number; // Current bet in this round
    totalBet: number; // Total bet in the hand
    action: ActionType | null;
    hasActed: boolean; // Has the player acted in the current betting round?
    isHost?: boolean;
}

export enum GamePhase {
    SETUP = 'SETUP',
    PRE_FLOP = 'PRE_FLOP',
    FLOP = 'FLOP',
    TURN = 'TURN',
    RIVER = 'RIVER',
    SHOWDOWN = 'SHOWDOWN',
}

export interface GameState {
    players: Player[];
    deck: Card[];
    communityCards: Card[];
    pot: number;
    currentPlayerIndex: number;
    dealerIndex: number;
    smallBlind: number;
    bigBlind: number;
    smallBlindIndex: number;
    bigBlindIndex: number;
    gamePhase: GamePhase;
    currentBet: number; // The highest bet in the current round
    minRaise: number;
    lastRaiserIndex: number; // Index of the player who last bet or raised
}

export enum HandRank {
    HIGH_CARD,
    ONE_PAIR,
    TWO_PAIR,
    THREE_OF_A_KIND,
    STRAIGHT,
    FLUSH,
    FULL_HOUSE,
    FOUR_OF_A_KIND,
    STRAIGHT_FLUSH,
    ROYAL_FLUSH,
}

export interface HandEvaluation {
    rank: HandRank;
    values: number[]; // High cards/pairs that determine winner in a tie
    handCards: Card[];
}

export interface PlayerStats {
    winProbability: number;
    handName: string;
}