
import { Suit, Rank, BlindLevel } from './types';

export const SUITS: Suit[] = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES];
export const RANKS: Rank[] = [Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN, Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE];

export const RANK_VALUES: { [key in Rank]: number } = {
    [Rank.TWO]: 2,
    [Rank.THREE]: 3,
    [Rank.FOUR]: 4,
    [Rank.FIVE]: 5,
    [Rank.SIX]: 6,
    [Rank.SEVEN]: 7,
    [Rank.EIGHT]: 8,
    [Rank.NINE]: 9,
    [Rank.TEN]: 10,
    [Rank.JACK]: 11,
    [Rank.QUEEN]: 12,
    [Rank.KING]: 13,
    [Rank.ACE]: 14,
};

export const TOURNAMENT_DEFAULT_STARTING_CHIPS = 10000;
export const TOURNAMENT_DEFAULT_AI_COUNT = 7;
export const TOURNAMENT_TURN_TIME_LIMIT_SECONDS = 20;
export const TOURNAMENT_BLIND_LEVEL_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export const TOURNAMENT_BLIND_SCHEDULE: BlindLevel[] = [
    { smallBlind: 10, bigBlind: 20 },
    { smallBlind: 15, bigBlind: 30 },
    { smallBlind: 25, bigBlind: 50 },
    { smallBlind: 50, bigBlind: 100 },
    { smallBlind: 75, bigBlind: 150 },
    { smallBlind: 100, bigBlind: 200 },
    { smallBlind: 150, bigBlind: 300 },
    { smallBlind: 200, bigBlind: 400 },
    { smallBlind: 300, bigBlind: 600 },
    { smallBlind: 400, bigBlind: 800 },
    { smallBlind: 500, bigBlind: 1000 },
];
