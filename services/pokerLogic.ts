import { Card, GameState, Player, Suit, Rank, GamePhase, ActionType, PlayerConfig, HandRank, HandEvaluation, PlayerStats, AIDifficulty } from '../types';
import { SUITS, RANKS, RANK_VALUES } from '../constants';

const AI_NAMES = ["Gemini Pro", "Flash", "Orion", "Nova", "HAL", "Skynet", "Deep Blue", "Watson"];

// --- Deck Management ---

export const createDeck = (): Card[] => {
    return SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank })));
};

export const shuffleDeck = <T>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

// --- Hand Evaluation Helpers ---

const getCombinations = <T>(array: T[], k: number): T[][] => {
    const result: T[][] = [];
    const backtrack = (combination: T[], start: number) => {
        if (combination.length === k) {
            result.push([...combination]);
            return;
        }
        for (let i = start; i < array.length; i++) {
            combination.push(array[i]);
            backtrack(combination, i + 1);
            combination.pop();
        }
    };
    backtrack([], 0);
    return result;
};

const getCardValue = (card: Card): number => RANK_VALUES[card.rank];

const sortCards = (cards: Card[]): Card[] => {
    return [...cards].sort((a, b) => getCardValue(b) - getCardValue(a));
};

// --- Core Hand Evaluation ---

export const evaluateHand = (allCards: Card[]): HandEvaluation => {
    let bestHand: HandEvaluation = { rank: HandRank.HIGH_CARD, values: [], handCards: [] };

    if (allCards.length < 5) {
        const sorted = sortCards(allCards);
        return {
            rank: HandRank.HIGH_CARD,
            values: sorted.map(getCardValue),
            handCards: sorted,
        };
    }

    const cardCombinations = getCombinations(allCards, 5);

    for (const hand of cardCombinations) {
        const sortedHand = sortCards(hand);
        const values = sortedHand.map(getCardValue);
        const suits = sortedHand.map(c => c.suit);

        const isFlush = suits.every(s => s === suits[0]);
        
        const rankCounts: { [key: number]: number } = {};
        for(const val of values) {
            rankCounts[val] = (rankCounts[val] || 0) + 1;
        }

        const counts = Object.values(rankCounts).sort((a, b) => b - a);
        const isFourOfAKind = counts[0] === 4;
        const isThreeOfAKind = counts[0] === 3;
        const isPair = counts[0] === 2;
        const isTwoPair = isPair && counts.length > 1 && counts[1] === 2;
        const isFullHouse = isThreeOfAKind && isPair;

        const uniqueValues = sortCards([...new Map(sortedHand.map(c => [c.rank, c])).values()]).map(getCardValue);
        let isStraight = false;
        let straightHighCard = 0;
        if(uniqueValues.length >= 5) {
            for(let i=0; i <= uniqueValues.length - 5; i++) {
                if(uniqueValues[i] - uniqueValues[i+4] === 4) {
                    isStraight = true;
                    straightHighCard = uniqueValues[i];
                    break;
                }
            }
            // Check for Ace-low straight A,2,3,4,5
            const aceLowCheck = [14, 5, 4, 3, 2];
            if(aceLowCheck.every(v => uniqueValues.includes(v))) {
                isStraight = true;
                straightHighCard = 5;
            }
        }
        
        let currentRank: HandRank | null = null;
        let currentValues: number[] = [];

        if (isStraight && isFlush) {
            currentRank = straightHighCard === RANK_VALUES[Rank.ACE] ? HandRank.ROYAL_FLUSH : HandRank.STRAIGHT_FLUSH;
            currentValues = [straightHighCard];
        } else if (isFourOfAKind) {
            currentRank = HandRank.FOUR_OF_A_KIND;
            const fourValue = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 4)!);
            const kicker = Math.max(...values.filter(v => v !== fourValue));
            currentValues = [fourValue, kicker];
        } else if (isFullHouse) {
            currentRank = HandRank.FULL_HOUSE;
            const threeValue = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 3)!);
            const pairValue = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 2)!);
            currentValues = [threeValue, pairValue];
        } else if (isFlush) {
            currentRank = HandRank.FLUSH;
            currentValues = values;
        } else if (isStraight) {
            currentRank = HandRank.STRAIGHT;
            currentValues = [straightHighCard];
        } else if (isThreeOfAKind) {
            currentRank = HandRank.THREE_OF_A_KIND;
            const threeValue = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 3)!);
            const kickers = values.filter(v => v !== threeValue).sort((a, b) => b - a).slice(0, 2);
            currentValues = [threeValue, ...kickers];
        } else if (isTwoPair) {
            currentRank = HandRank.TWO_PAIR;
            const pairValues = Object.keys(rankCounts).filter(k => rankCounts[k] === 2).map(Number).sort((a, b) => b - a);
            const kicker = Math.max(...values.filter(v => !pairValues.includes(v)));
            currentValues = [...pairValues, kicker];
        } else if (isPair) {
            currentRank = HandRank.ONE_PAIR;
            const pairValue = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 2)!);
            const kickers = values.filter(v => v !== pairValue).sort((a, b) => b - a).slice(0, 3);
            currentValues = [pairValue, ...kickers];
        } else {
            currentRank = HandRank.HIGH_CARD;
            currentValues = values;
        }

        const currentHand: HandEvaluation = { rank: currentRank, values: currentValues, handCards: sortedHand };
        if (compareHands(currentHand, bestHand) > 0) {
            bestHand = { ...currentHand };
        }
    }

    return bestHand;
};

// --- Winner Determination ---

export const compareHands = (handA: HandEvaluation, handB: HandEvaluation): number => {
    if (handA.rank > handB.rank) return 1;
    if (handA.rank < handB.rank) return -1;
    
    for (let i = 0; i < handA.values.length; i++) {
        if (handA.values[i] > handB.values[i]) return 1;
        if (handA.values[i] < handB.values[i]) return -1;
    }
    return 0; // Tie
};

export const determineWinner = (gameState: GameState): { winners: Player[], winningHandName: string } => {
    const activePlayers = gameState.players.filter(p => !p.isFolded);
    if (activePlayers.length === 1) {
        return { winners: activePlayers, winningHandName: 'the last one standing' };
    }

    let bestHands: { player: Player, evaluation: HandEvaluation }[] = [];

    for (const player of activePlayers) {
        const allCards = [...player.hand, ...gameState.communityCards];
        const evaluation = evaluateHand(allCards);
        
        if (bestHands.length === 0 || compareHands(evaluation, bestHands[0].evaluation) > 0) {
            bestHands = [{ player, evaluation }];
        } else if (compareHands(evaluation, bestHands[0].evaluation) === 0) {
            bestHands.push({ player, evaluation });
        }
    }

    const winners = bestHands.map(h => h.player);
    const winningHandName = HandRank[bestHands[0].evaluation.rank].replace(/_/g, ' ').toLowerCase();

    return { winners, winningHandName };
};


// --- Game Initialization ---

export const initializeGame = (playerConfig: PlayerConfig, aiCount: number, smallBlind: number, bigBlind: number, aiDifficulty: AIDifficulty): GameState => {
    const shuffledAiNames = shuffleDeck(AI_NAMES);
    const players: Player[] = [
        {
            ...playerConfig,
            hand: [],
            isFolded: false,
            bet: 0,
            totalBet: 0,
            action: null,
            hasActed: false,
        }
    ];

    for (let i = 0; i < aiCount; i++) {
        players.push({
            id: `ai_${i + 1}_${Date.now()}`,
            name: shuffledAiNames[i],
            chips: playerConfig.chips,
            hand: [],
            isAI: true,
            isFolded: false,
            bet: 0,
            totalBet: 0,
            action: null,
            hasActed: false,
            difficulty: aiDifficulty,
        });
    }

    const dealerIndex = Math.floor(Math.random() * players.length);

    const gameState: GameState = {
        players,
        deck: [],
        communityCards: [],
        pot: 0,
        currentPlayerIndex: 0,
        dealerIndex,
        smallBlind,
        bigBlind,
        smallBlindIndex: 0,
        bigBlindIndex: 0,
        gamePhase: GamePhase.SETUP,
        currentBet: 0,
        minRaise: bigBlind,
        lastRaiserIndex: -1,
    };

    return startNewHand(gameState);
};

// --- Hand Lifecycle ---

export const startNewHand = (gameState: GameState): GameState => {
    let freshDeck = createDeck();
    freshDeck = shuffleDeck(freshDeck);

    // Filter out players with no chips
    const activePlayers = gameState.players.filter(p => p.chips > 0);

    // Reset players for the new hand
    const players = activePlayers.map(p => ({
        ...p,
        hand: [],
        isFolded: false,
        bet: 0,
        totalBet: 0,
        action: null,
        hasActed: false,
    }));
    
    // Rotate dealer button
    const dealerIndex = (gameState.dealerIndex + 1) % players.length;
    
    // Determine blinds based on dealer position
    const smallBlindIndex = (dealerIndex + 1) % players.length;
    const bigBlindIndex = (dealerIndex + 2) % players.length;

    // Post blinds
    const sbAmount = Math.min(gameState.smallBlind, players[smallBlindIndex].chips);
    players[smallBlindIndex].chips -= sbAmount;
    players[smallBlindIndex].bet = sbAmount;
    
    const bbAmount = Math.min(gameState.bigBlind, players[bigBlindIndex].chips);
    players[bigBlindIndex].chips -= bbAmount;
    players[bigBlindIndex].bet = bbAmount;

    // Deal cards
    for (let i = 0; i < 2; i++) {
        for (const player of players) {
            if(player.chips > 0 || player.bet > 0) { // Only deal to players in the hand
                player.hand.push(freshDeck.pop()!);
            }
        }
    }

    // Set initial turn
    const currentPlayerIndex = (bigBlindIndex + 1) % players.length;

    return {
        ...gameState,
        players,
        deck: freshDeck,
        communityCards: [],
        pot: sbAmount + bbAmount,
        dealerIndex,
        smallBlindIndex,
        bigBlindIndex,
        gamePhase: GamePhase.PRE_FLOP,
        currentPlayerIndex,
        currentBet: bbAmount,
        minRaise: gameState.bigBlind,
        lastRaiserIndex: bigBlindIndex
    };
};

export const endHand = (gameState: GameState): GameState => {
    // Fix: Add explicit type to `workingState` to fix type inference issues after JSON.parse.
    const workingState: GameState = JSON.parse(JSON.stringify(gameState));

    // Finalize current round's bets into each player's totalBet for accurate pot calculation
    workingState.players.forEach((p: Player) => {
        p.totalBet += p.bet;
        p.bet = 0;
    });

    const nonFoldedPlayers = workingState.players.filter((p: Player) => !p.isFolded);

    if (nonFoldedPlayers.length === 1) {
        // Simple case: everyone else folded
        const winnerIndex = workingState.players.findIndex((p: Player) => p.id === nonFoldedPlayers[0].id);
        if (winnerIndex !== -1) {
            workingState.players[winnerIndex].chips += workingState.pot;
        }
    } else {
        // Showdown: Calculate and distribute main pot and any side pots
        const contributions = nonFoldedPlayers
            .map(p => ({ id: p.id, totalBet: p.totalBet }))
            .sort((a, b) => a.totalBet - b.totalBet);

        // Fix: Sort unique bet levels to process side pots correctly and fix type inference.
        const uniqueBetLevels = [...new Set(contributions.map(c => c.totalBet))].sort((a, b) => a - b);
        let lastBetThreshold = 0;

        for (const betLevel of uniqueBetLevels) {
            const potContributors = contributions.filter(c => c.totalBet >= betLevel);
            const potAmount = potContributors.length * (betLevel - lastBetThreshold);

            if (potAmount > 0) {
                const eligiblePlayerIds = new Set(potContributors.map(c => c.id));
                const eligiblePlayers = workingState.players.filter((p: Player) => eligiblePlayerIds.has(p.id));

                // Create a temporary game state to determine winners for this specific pot
                const tempGameState: GameState = { ...workingState, players: eligiblePlayers };
                const { winners } = determineWinner(tempGameState);

                if (winners.length > 0) {
                    const share = Math.floor(potAmount / winners.length);
                    const remainder = potAmount % winners.length;
                    winners.forEach((winner, i) => {
                        const winnerIndex = workingState.players.findIndex((p: Player) => p.id === winner.id);
                        if (winnerIndex !== -1) {
                            workingState.players[winnerIndex].chips += share + (i === 0 ? remainder : 0);
                        }
                    });
                }
            }
            lastBetThreshold = betLevel;
        }
    }

    return {
        ...workingState,
        pot: 0, // Pot has been distributed
        gamePhase: GamePhase.SETUP,
    };
};

// --- Player Actions ---

export const handlePlayerAction = (
    state: GameState,
    playerId: string,
    action: ActionType,
    amount: number = 0
): GameState => {
    const playerIndex = state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1 || playerIndex !== state.currentPlayerIndex) {
        return state; // Not this player's turn
    }
    
    let newState = JSON.parse(JSON.stringify(state)); // Deep copy
    let player = newState.players[playerIndex];

    player.hasActed = true;
    player.action = action;

    switch (action) {
        case ActionType.FOLD:
            player.isFolded = true;
            break;
        case ActionType.CHECK:
            // Valid only if player.bet equals currentBet
            break;
        case ActionType.CALL:
            const callAmount = Math.min(player.chips, newState.currentBet - player.bet);
            player.chips -= callAmount;
            player.bet += callAmount;
            newState.pot += callAmount;
            break;
        case ActionType.BET:
        case ActionType.RAISE:
            const totalBetAmount = amount;
            const additionalBet = totalBetAmount - player.bet;
            
            player.chips -= additionalBet;
            newState.pot += additionalBet;
            newState.minRaise = totalBetAmount - newState.currentBet;
            newState.currentBet = totalBetAmount;
            player.bet = totalBetAmount;
            newState.lastRaiserIndex = playerIndex;
            
            // Mark other active players as needing to act again
            newState.players.forEach((p: Player, i: number) => {
                if(i !== playerIndex && !p.isFolded && p.chips > 0) {
                    p.hasActed = false;
                }
            });
            break;
    }

    return advanceTurn(newState);
};

// --- Game Flow ---

const advanceTurn = (state: GameState): GameState => {
    const nonFoldedPlayers = state.players.filter(p => !p.isFolded);
    
    // If only one player is left, they win. Let the main game loop handle it.
    if (nonFoldedPlayers.length <= 1) {
        return state;
    }
    
    // Players still in the hand who can bet (i.e., not all-in).
    const bettingPlayers = nonFoldedPlayers.filter(p => p.chips > 0);
    
    // A player who raised needs to be skipped in the turn order until it comes back around.
    const roundIsOver = bettingPlayers.every(p => {
        return p.hasActed && p.bet === state.currentBet;
    });

    if (roundIsOver) {
        // The betting round is over. Move to the next phase.
        return dealCommunityCards(state);
    }
    
    let nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    // Find the next player who is not folded and not all-in (has chips > 0).
    while(state.players[nextPlayerIndex].isFolded || state.players[nextPlayerIndex].chips === 0) {
        // Break if we loop all the way around, which can happen in all-in scenarios.
        if (nextPlayerIndex === state.currentPlayerIndex) {
             // This case indicates the betting round is over due to all-ins.
             return dealCommunityCards(state);
        }
        nextPlayerIndex = (nextPlayerIndex + 1) % state.players.length;
    }

    state.currentPlayerIndex = nextPlayerIndex;
    return state;
};

const dealCommunityCards = (state: GameState): GameState => {
    // Collect bets into the pot and reset for the new round
    state.players.forEach(p => { 
        p.totalBet += p.bet;
        p.bet = 0;
        p.hasActed = false;
        p.action = null;
    });
    
    state.currentBet = 0;
    state.minRaise = state.bigBlind;
    state.lastRaiserIndex = -1;
    
    let nextPlayerIndex = (state.dealerIndex + 1) % state.players.length;
    while(state.players[nextPlayerIndex].isFolded || state.players[nextPlayerIndex].chips === 0) {
        if(nextPlayerIndex === state.dealerIndex) break; // Everyone is folded/all-in
        nextPlayerIndex = (nextPlayerIndex + 1) % state.players.length;
    }
    state.currentPlayerIndex = nextPlayerIndex;


    switch (state.gamePhase) {
        case GamePhase.PRE_FLOP:
            state.gamePhase = GamePhase.FLOP;
            state.deck.pop(); // Burn card
            state.communityCards.push(state.deck.pop()!, state.deck.pop()!, state.deck.pop()!);
            break;
        case GamePhase.FLOP:
            state.gamePhase = GamePhase.TURN;
            state.deck.pop(); // Burn card
            state.communityCards.push(state.deck.pop()!);
            break;
        case GamePhase.TURN:
            state.gamePhase = GamePhase.RIVER;
            state.deck.pop(); // Burn card
            state.communityCards.push(state.deck.pop()!);
            break;
        case GamePhase.RIVER:
            state.gamePhase = GamePhase.SHOWDOWN;
            return state; // No more turns after showdown
    }

    // Check if we need to automatically deal remaining cards due to all-ins
    const activePlayers = state.players.filter(p => !p.isFolded);
    const playersNotAllIn = activePlayers.filter(p => p.chips > 0);

    if (playersNotAllIn.length < 2 && state.gamePhase !== GamePhase.SHOWDOWN) {
        // Use a while loop to run out the board instead of recursion to prevent freezing
        let currentState = state;
        while (currentState.gamePhase !== GamePhase.RIVER && currentState.gamePhase !== GamePhase.SHOWDOWN) {
            currentState = dealCommunityCards(currentState);
        }
        // After all cards are dealt, move to showdown
        currentState.gamePhase = GamePhase.SHOWDOWN;
        return currentState;
    }


    return state;
};

// --- Statistics ---

export const calculateStats = (player: Player, communityCards: Card[], numOpponents: number): PlayerStats => {
    const allKnownCards = [...player.hand, ...communityCards];
    const evaluation = evaluateHand(allKnownCards);
    const handName = HandRank[evaluation.rank].replace(/_/g, ' ').toLowerCase();

    // --- Monte Carlo Simulation for Win Probability ---
    const SIMULATION_COUNT = 1000;
    let wins = 0;

    for (let i = 0; i < SIMULATION_COUNT; i++) {
        const tempDeck = shuffleDeck(
            createDeck().filter(card => 
                !allKnownCards.some(kc => kc.rank === card.rank && kc.suit === card.suit)
            )
        );
        
        const opponentHands: Card[][] = Array.from({ length: numOpponents - 1 }, () => [tempDeck.pop()!, tempDeck.pop()!]);
        const cardsToDeal = 5 - communityCards.length;
        const simulatedCommunityCards = [...communityCards, ...tempDeck.slice(0, cardsToDeal)];

        const playerFinalHand = evaluateHand([...player.hand, ...simulatedCommunityCards]);

        let playerIsWinner = true;
        let isTie = false;
        for (const oppHand of opponentHands) {
            const oppFinalHand = evaluateHand([...oppHand, ...simulatedCommunityCards]);
            const comparison = compareHands(playerFinalHand, oppFinalHand);
            if (comparison < 0) {
                playerIsWinner = false;
                break;
            } else if (comparison === 0) {
                isTie = true;
            }
        }
        
        if (playerIsWinner) {
            // In a tie, you only win a fraction of the pot. We'll count it as a partial win.
            wins += isTie ? 0.5 : 1; 
        }
    }

    const winProbability = (wins / SIMULATION_COUNT) * 100;

    return { winProbability, handName };
};


// --- Action Validation ---

export const validateAction = (
    state: GameState,
    playerId: string,
    action: ActionType,
    amount: number
): { action: ActionType, amount: number } => {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return { action: ActionType.FOLD, amount: 0 };

    const callAmount = state.currentBet - player.bet;
    const canCheck = callAmount <= 0;

    switch (action) {
        case ActionType.FOLD:
            // Can't fold if checking is an option, unless the AI explicitly chooses to
            return { action, amount: 0 };
        case ActionType.CHECK:
            return canCheck ? { action, amount: 0 } : { action: ActionType.FOLD, amount: 0 };
        case ActionType.CALL:
            if (canCheck) return { action: ActionType.CHECK, amount: 0 };
            return { action, amount: Math.min(callAmount, player.chips) };
        case ActionType.BET:
        case ActionType.RAISE:
            // If going all-in
            if (amount >= player.chips + player.bet) {
                return { action, amount: player.chips + player.bet };
            }
             if (player.chips <= callAmount) { 
                 return { action: ActionType.CALL, amount: player.chips };
            }
            const minRaiseTotal = state.currentBet + state.minRaise;
            const maxRaiseTotal = player.chips + player.bet;
            
            let finalAmount = Math.max(state.currentBet === 0 ? state.bigBlind : minRaiseTotal, amount);
            finalAmount = Math.min(maxRaiseTotal, finalAmount);
            
            if (finalAmount < minRaiseTotal && finalAmount < maxRaiseTotal) {
                 return { action: ActionType.CALL, amount: callAmount };
            }

            return { action, amount: finalAmount };
        default:
            return { action: ActionType.FOLD, amount: 0 };
    }
}