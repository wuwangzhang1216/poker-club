import { GoogleGenAI, Type } from "@google/genai";
import { GameState, Player, ActionType, Card } from '../types';

// Fix: Implement the AI service using Gemini API, following all provided guidelines.
// 1. Initialize GoogleGenAI with a named apiKey parameter from process.env.
// 2. Do not include any UI or logic for key management.
// 3. Use 'gemini-2.5-flash' model.
// 4. Use responseSchema for structured JSON output.

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const simplifyCard = (card: Card) => `${card.rank}${card.suit.charAt(0)}`;

const getJsonPrompt = (gameState: GameState, aiPlayer: Player): string => {
    const activePlayers = gameState.players.filter(p => !p.isFolded);

    const playerSummary = gameState.players.map((p, index) => ({
        name: p.id === aiPlayer.id ? 'YOU' : p.name,
        chips: p.chips,
        bet: p.bet,
        isFolded: p.isFolded,
        isDealer: index === gameState.dealerIndex,
    }));

    const callAmount = gameState.currentBet - aiPlayer.bet;
    const minRaise = gameState.currentBet + gameState.minRaise;
    const maxRaise = aiPlayer.chips + aiPlayer.bet; // All-in

    const context = {
        rules: "You are a world-class Texas Hold'em poker AI. Your goal is to maximize chip count. Provide your action as a JSON object. Only choose from the legal actions. Be smart, strategic, and sometimes unpredictable.",
        yourHand: aiPlayer.hand.map(simplifyCard),
        yourChips: aiPlayer.chips,
        communityCards: gameState.communityCards.map(simplifyCard),
        pot: gameState.pot,
        currentBetToCall: callAmount,
        gamePhase: gameState.gamePhase,
        players: playerSummary,
        legalActions: {
            canFold: true,
            canCheck: callAmount === 0,
            canCall: callAmount > 0 && aiPlayer.chips > 0,
            canBetOrRaise: aiPlayer.chips > callAmount,
            minRaise: callAmount > 0 ? minRaise : gameState.bigBlind,
            maxRaise: maxRaise,
        }
    };
    return `Analyze the poker game state and decide on your next move. Your response must be in JSON format. Here is the game state: ${JSON.stringify(context, null, 2)}`;
};

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        action: {
            type: Type.STRING,
            description: `The chosen action. Must be one of: ${Object.values(ActionType).join(', ')}.`,
            enum: Object.values(ActionType)
        },
        amount: {
            type: Type.NUMBER,
            description: 'The total amount for a BET or RAISE. Should be 0 for FOLD, CHECK. For CALL, this should also be 0 as game logic handles the amount.'
        },
        reasoning: {
            type: Type.STRING,
            description: 'A brief explanation of why you chose this action.'
        }
    },
    required: ["action", "amount", "reasoning"]
};

export interface AIResponse {
    action: ActionType;
    amount: number;
    reasoning?: string;
}

export const getAIAction = async (gameState: GameState, aiPlayer: Player): Promise<AIResponse> => {
    const prompt = getJsonPrompt(gameState, aiPlayer);
    const maxRetries = 3;
    let delay = 2000; // Start with a 2-second delay

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                    temperature: 0.9,
                },
            });
            
            const text = response.text.trim();
            const aiResponse: AIResponse = JSON.parse(text);
            
            if (Object.values(ActionType).includes(aiResponse.action)) {
                 return aiResponse;
            } else {
                console.error("AI returned an invalid action:", aiResponse.action);
                return { action: ActionType.FOLD, amount: 0, reasoning: "Invalid action received from AI, folding safely." };
            }
        } catch (error) {
            const errorMessage = (error as Error).toString();
            console.error(`Attempt ${i + 1} failed:`, errorMessage);

            // Check if it's a rate limit error (status 429)
            if (errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("429")) {
                if (i < maxRetries - 1) {
                    console.log(`Rate limit exceeded. Retrying in ${delay / 1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Exponential backoff
                }
            } else {
                // For other errors (e.g., network, auth), break the loop and fold.
                console.error("Non-retryable error from Gemini, folding safely.");
                return { action: ActionType.FOLD, amount: 0, reasoning: "Non-retryable API error, folding safely." };
            }
        }
    }
    
    // If all retries fail
    console.error("All retries failed to get AI action from Gemini. Folding safely.");
    return { action: ActionType.FOLD, amount: 0, reasoning: "API rate limit exceeded after multiple retries, folding safely." };
};
