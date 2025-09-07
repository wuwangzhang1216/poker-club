// Fix: Corrected import path for types and constants. This ensures the modules can be found once implemented.
import { Card, Player, Suit, Rank, HandRank, HandEvaluation } from '../types';
import { SUITS, RANKS, RANK_VALUES } from '../constants';

export const createDeck = (): Card[] => {
    return SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank })));
};

export const shuffleDeck = (deck: Card[]): Card[] => {
    const newDeck = [...deck];
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
};

export const dealCards = (players: Player[], deck: Card[], numCards: number): void => {
    for (let i = 0; i < numCards; i++) {
        for (const player of players) {
            if (!player.isFolded) {
                const card = deck.pop();
                if (card) {
                    player.hand.push(card);
                }
            }
        }
    }
};

const toTitleCase = (str: string): string => {
    return str.toLowerCase().replace(/\b(\w)/g, s => s.toUpperCase());
};

export const getHandName = (evaluation: HandEvaluation): string => {
    return toTitleCase(HandRank[evaluation.rank].replace(/_/g, ' '));
}

// Hand Evaluation Logic
const getCardValue = (card: Card): number => RANK_VALUES[card.rank];

const sortCards = (cards: Card[]): Card[] => {
    return cards.sort((a, b) => getCardValue(b) - getCardValue(a));
};

export const findBestHand = (allCards: Card[]): HandEvaluation => {
    const combinations: Card[][] = [];
    const k = 5;
    const n = allCards.length;

    function combine(start: number, currentCombo: Card[]) {
        if (currentCombo.length === k) {
            combinations.push([...currentCombo]);
            return;
        }
        if (start === n) return;
        for (let i = start; i < n; i++) {
            currentCombo.push(allCards[i]);
            combine(i + 1, currentCombo);
            currentCombo.pop();
        }
    }
    if (n < k) {
        return evaluateHand(allCards);
    }
    combine(0, []);

    let bestEval: HandEvaluation | null = null;
    for (const combo of combinations) {
        const currentEval = evaluateHand(combo);
        if (!bestEval || compareHands(currentEval, bestEval) > 0) {
            bestEval = currentEval;
        }
    }
    return bestEval!;
};

export const compareHands = (evalA: HandEvaluation, evalB: HandEvaluation): number => {
    if (evalA.rank !== evalB.rank) {
        return evalA.rank - evalB.rank;
    }
    for (let i = 0; i < evalA.values.length; i++) {
        if (evalA.values[i] !== evalB.values[i]) {
            return evalA.values[i] - evalB.values[i];
        }
    }
    return 0;
};

const evaluateHand = (hand: Card[]): HandEvaluation => {
    const sortedHand = sortCards(hand);
    const ranks = sortedHand.map(c => getCardValue(c));
    const suits = sortedHand.map(c => c.suit);
    
    const rankCounts: { [key: number]: number } = ranks.reduce((acc, rank) => {
        acc[rank] = (acc[rank] || 0) + 1;
        return acc;
    }, {} as { [key: number]: number });
    
    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    const uniqueRanks = Object.keys(rankCounts).map(Number).sort((a, b) => b - a);
    
    const isFiveCardHand = hand.length === 5;
    const isFlush = isFiveCardHand && new Set(suits).size === 1;
    
    const uniqueRanksForStraight = Array.from(new Set(ranks)).sort((a, b) => b - a);
    
    let isStraight = false;
    let straightHighCardValue = 0;

    if (isFiveCardHand && uniqueRanksForStraight.length === 5) {
        const isAceLow = uniqueRanksForStraight.toString() === '14,5,4,3,2';
        if (isAceLow) {
            isStraight = true;
            straightHighCardValue = 5; // Ace-low straight is a 5-high straight
        } else if (uniqueRanksForStraight[0] - uniqueRanksForStraight[4] === 4) {
            isStraight = true;
            straightHighCardValue = uniqueRanksForStraight[0];
        }
    }
    
    const getStraightValues = () => {
        if (straightHighCardValue === 5) return [5,4,3,2,1];
        return Array.from({length: 5}, (_, i) => straightHighCardValue - i);
    };

    if (isStraight && isFlush) {
        const values = getStraightValues();
        // Fix: Corrected property access on RANK_VALUES from dot notation to bracket notation.
        if (straightHighCardValue === RANK_VALUES[Rank.ACE]) return { rank: HandRank.ROYAL_FLUSH, values, handCards: sortedHand };
        return { rank: HandRank.STRAIGHT_FLUSH, values, handCards: sortedHand };
    }
    if (counts[0] === 4) {
        const fourRank = uniqueRanks.find(r => rankCounts[r] === 4)!;
        const kicker = uniqueRanks.find(r => rankCounts[r] === 1) ?? 0;
        return { rank: HandRank.FOUR_OF_A_KIND, values: [fourRank, kicker], handCards: sortedHand };
    }
    if (isFiveCardHand && counts[0] === 3 && counts[1] === 2) {
        const threeRank = uniqueRanks.find(r => rankCounts[r] === 3)!;
        const twoRank = uniqueRanks.find(r => rankCounts[r] === 2)!;
        return { rank: HandRank.FULL_HOUSE, values: [threeRank, twoRank], handCards: sortedHand };
    }
    if (isFlush) {
        return { rank: HandRank.FLUSH, values: ranks, handCards: sortedHand };
    }
    if (isStraight) {
        return { rank: HandRank.STRAIGHT, values: getStraightValues(), handCards: sortedHand };
    }
    if (counts[0] === 3) {
        const threeRank = uniqueRanks.find(r => rankCounts[r] === 3)!;
        const kickers = uniqueRanks.filter(r => rankCounts[r] === 1).sort((a, b) => b - a);
        return { rank: HandRank.THREE_OF_A_KIND, values: [threeRank, ...kickers], handCards: sortedHand };
    }
    if (counts[0] === 2 && counts[1] === 2) {
        const pairRanks = uniqueRanks.filter(r => rankCounts[r] === 2).sort((a, b) => b - a);
        const kicker = uniqueRanks.find(r => rankCounts[r] === 1) ?? 0;
        return { rank: HandRank.TWO_PAIR, values: [...pairRanks, kicker], handCards: sortedHand };
    }
    if (counts[0] === 2) {
        const pairRank = uniqueRanks.find(r => rankCounts[r] === 2)!;
        const kickers = uniqueRanks.filter(r => rankCounts[r] === 1).sort((a, b) => b - a);
        return { rank: HandRank.ONE_PAIR, values: [pairRank, ...kickers], handCards: sortedHand };
    }
    return { rank: HandRank.HIGH_CARD, values: ranks, handCards: sortedHand };
};

// --- Win Probability Calculation ---

// Helper function to find winner(s) for a given board and set of players
const findRoundWinners = (board: Card[], players: Player[]): { player: Player; eval: HandEvaluation }[] => {
    if (players.length === 0) return [];

    const playerEvals = players.map(player => {
        const allCards = [...player.hand, ...board];
        const handEval = findBestHand(allCards);
        return { player, eval: handEval };
    });
    
    playerEvals.sort((a, b) => compareHands(b.eval, a.eval));
    
    const winningEval = playerEvals[0].eval;
    return playerEvals.filter(pe => compareHands(pe.eval, winningEval) === 0);
};

const SIMULATION_COUNT_PREFLOP = 2000;

export const calculateWinProbabilities = (
    activePlayers: Player[],
    communityCards: Card[],
    fullDeck: Card[]
): Record<string, { winProbability: number; handName: string }> => {
    
    if (activePlayers.length <= 1) {
        const stats: Record<string, { winProbability: number; handName: string }> = {};
        if (activePlayers.length === 1) {
            const handEval = findBestHand([...activePlayers[0].hand, ...communityCards]);
            stats[activePlayers[0].id] = { winProbability: 100, handName: getHandName(handEval) };
        }
        return stats;
    }

    const results: Record<string, { wins: number; handName: string }> = {};
    activePlayers.forEach(p => {
        const handEval = findBestHand([...p.hand, ...communityCards]);
        results[p.id] = { wins: 0, handName: getHandName(handEval) };
    });

    const knownCards = new Set([
        ...communityCards.map(c => `${c.rank}${c.suit}`),
        ...activePlayers.flatMap(p => p.hand).map(c => `${c.rank}${c.suit}`),
    ]);
    const remainingDeck = fullDeck.filter(c => !knownCards.has(`${c.rank}${c.suit}`));

    let totalOutcomes = 0;

    // --- Pre-flop: Use Monte Carlo Simulation due to high number of combinations ---
    if (communityCards.length === 0) {
        totalOutcomes = SIMULATION_COUNT_PREFLOP;
        for (let i = 0; i < totalOutcomes; i++) {
            const shuffledDeck = shuffleDeck([...remainingDeck]);
            const simulatedBoard = shuffledDeck.slice(0, 5);
            const winners = findRoundWinners(simulatedBoard, activePlayers);
            winners.forEach(winner => {
                if (results[winner.player.id]) {
                    results[winner.player.id].wins += 1 / winners.length;
                }
            });
        }
    } 
    // --- Flop: Use Exhaustive Enumeration for Turn & River ---
    else if (communityCards.length === 3) {
        if (remainingDeck.length >= 2) {
            for (let i = 0; i < remainingDeck.length; i++) {
                for (let j = i + 1; j < remainingDeck.length; j++) {
                    totalOutcomes++;
                    const finalBoard = [...communityCards, remainingDeck[i], remainingDeck[j]];
                    const winners = findRoundWinners(finalBoard, activePlayers);
                    winners.forEach(winner => {
                        if (results[winner.player.id]) {
                            results[winner.player.id].wins += 1 / winners.length;
                        }
                    });
                }
            }
        }
    }
    // --- Turn: Use Exhaustive Enumeration for River ---
    else if (communityCards.length === 4) {
        if (remainingDeck.length >= 1) {
            totalOutcomes = remainingDeck.length;
            for (const lastCard of remainingDeck) {
                const finalBoard = [...communityCards, lastCard];
                const winners = findRoundWinners(finalBoard, activePlayers);
                winners.forEach(winner => {
                    if (results[winner.player.id]) {
                        results[winner.player.id].wins += 1 / winners.length;
                    }
                });
            }
        }
    }

    // Fallback for River or an exhausted deck (no more cards to deal)
    if (totalOutcomes === 0) {
        totalOutcomes = 1;
        const winners = findRoundWinners(communityCards, activePlayers);
        winners.forEach(winner => {
            if (results[winner.player.id]) {
                results[winner.player.id].wins += 1 / winners.length;
            }
        });
    }

    const finalProbabilities: Record<string, { winProbability: number; handName: string }> = {};
    activePlayers.forEach(p => {
        finalProbabilities[p.id] = {
            winProbability: totalOutcomes > 0 ? (results[p.id].wins / totalOutcomes) * 100 : 100 / activePlayers.length,
            handName: results[p.id].handName
        };
    });
    
    return finalProbabilities;
};
