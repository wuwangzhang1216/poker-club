import { GoogleGenAI, Type } from "@google/genai";
import { GameState, Player, ActionType, Card, AIDifficulty } from '../types';
import * as pokerLogic from './pokerLogic';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// A simple function to format cards for the prompt
const formatCards = (cards: Card[]): string => {
    if (!cards || cards.length === 0) return 'None';
    return cards.map(c => `${c.rank}${c.suit}`).join(', ');
};

const getDifficultyPersona = (difficulty?: AIDifficulty): string => {
    switch (difficulty) {
        case AIDifficulty.EASY:
            return "You are a cautious and straightforward poker player. You are a beginner and tend to fold weaker hands and don't bluff often. You prefer to play only very strong hands.";
        case AIDifficulty.HARD:
            return "You are an expert, unpredictable poker player (Loose-Aggressive). You play a wide range of hands aggressively, including bluffs and semi-bluffs, to put maximum pressure on your opponents. You are a master of psychological warfare at the poker table and are not afraid to make big moves to steal pots.";
        case AIDifficulty.MEDIUM:
        default:
            return "You are a balanced and skilled poker player (Tight-Aggressive). You play a narrow range of strong starting hands, but you play them aggressively. You understand pot odds, hand equity, and can make calculated bluffs and semi-bluffs when the situation is right.";
    }
};

const getTemperatureForDifficulty = (difficulty?: AIDifficulty): number => {
    switch(difficulty) {
        case AIDifficulty.EASY:
            return 0.4; // More predictable, less creative
        case AIDifficulty.HARD:
            return 1.0; // More creative, aggressive, unpredictable
        case AIDifficulty.MEDIUM:
        default:
            return 0.8;
    }
};

export const getAIPlayerAction = async (gameState: GameState, aiPlayer: Player): Promise<{ action: ActionType, amount: number }> => {
    const { players, communityCards, pot, currentBet, smallBlind, bigBlind, gamePhase } = gameState;
    const callAmount = Math.max(0, currentBet - aiPlayer.bet);
    const minRaise = gameState.minRaise;
    const minRaiseAmount = currentBet + minRaise;
    const maxRaiseAmount = aiPlayer.chips + aiPlayer.bet;
    const canCheck = callAmount === 0;

    const actionHistory = players
        .filter(p => p.hasActed)
        .map(p => `${p.name} ${p.action}${p.action === ActionType.RAISE || p.action === ActionType.BET ? ` to ${p.bet}`:''}`)
        .join(', ');

    const persona = getDifficultyPersona(aiPlayer.difficulty);
    const temperature = getTemperatureForDifficulty(aiPlayer.difficulty);

    const prompt = `
You are a Texas Hold'em poker AI. ${persona} Your goal is to win chips by making smart, logical decisions based on your persona.
Analyze the provided game state and determine your best move.

**Current Game State:**
- **Game Phase:** ${gamePhase}
- **Your Hand:** ${formatCards(aiPlayer.hand)}
- **Community Cards:** ${formatCards(communityCards)}
- **Total Pot:** $${pot}
- **Your Chips:** $${aiPlayer.chips}
- **Current Bet to Call:** $${callAmount} (You have already bet $${aiPlayer.bet} this round)
- **Players Remaining in Hand:** ${players.filter(p => !p.isFolded).length}
- **Actions This Round:** ${actionHistory || 'None yet.'}

**Your Task:**
Choose one of the following actions. Respond ONLY with a valid JSON object matching the specified schema.

**Possible Actions & Rules:**
1.  **FOLD:** Forfeit the hand. Use this if your hand is weak or the bet is too high.
2.  **CHECK:** Bet nothing. Only possible if the amount to call is $0.
3.  **CALL:** Match the current bet of $${currentBet}. This will cost you $${callAmount}.
4.  **BET:** Make the first bet in a round. The minimum bet is $${bigBlind}.
5.  **RAISE:** Increase the current bet. The minimum total raise amount is $${minRaiseAmount}. Your maximum raise is all-in ($${maxRaiseAmount}).

When you BET or RAISE, the 'amount' you provide must be the TOTAL new bet size, not the additional amount you are adding.

**Analysis:**
- How strong is your hand now? What is its potential?
- What might your opponents have based on their actions?
- Is it worth the risk to continue? Should you be aggressive or cautious?

Based on your analysis, provide your action.
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        action: { type: Type.STRING, enum: Object.values(ActionType) },
                        amount: { type: Type.NUMBER, description: 'The total amount for a bet or raise. 0 for other actions.' }
                    },
                    required: ['action', 'amount']
                },
                temperature: temperature,
                topP: 1,
            }
        });

        const jsonStr = response.text.trim();
        const result = JSON.parse(jsonStr);

        // --- Post-decision validation ---
        const validatedAction = pokerLogic.validateAction(gameState, aiPlayer.id, result.action, result.amount);
        
        return {
            action: validatedAction.action as ActionType,
            amount: validatedAction.amount
        };

    } catch (error) {
        console.error("Gemini API call failed:", error);
        // Fallback to a safe action if the API fails
        const fallbackAction = canCheck ? ActionType.CHECK : ActionType.FOLD;
        return { action: fallbackAction, amount: 0 };
    }
};