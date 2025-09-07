<<<<<<< HEAD
# gemini_ai.py - Add this file to your backend

import json
import asyncio
from typing import Dict, Any, Optional
import google.generativeai as genai
from enum import Enum

class ActionType(str, Enum):
    FOLD = "FOLD"
    CHECK = "CHECK"
    CALL = "CALL"
    BET = "BET"
    RAISE = "RAISE"

# Initialize Gemini
def init_gemini(api_key: str):
    genai.configure(api_key=api_key)

def simplify_card(card: Dict[str, str]) -> str:
    """Convert card to simple notation"""
    return f"{card['rank']}{card['suit'][0]}"

def get_ai_prompt(game_state: Dict[str, Any], ai_player: Dict[str, Any]) -> str:
    """Generate prompt for Gemini AI"""
    
    # Calculate call amount
    call_amount = game_state['current_bet'] - ai_player['bet']
    min_raise = game_state['current_bet'] + game_state['min_raise']
    max_raise = ai_player['chips'] + ai_player['bet']  # All-in
    
    # Build player summary
    player_summary = []
    for i, p in enumerate(game_state['players']):
        player_info = {
            "name": "YOU" if p['id'] == ai_player['id'] else p['name'],
            "chips": p['chips'],
            "bet": p['bet'],
            "isFolded": p['is_folded'],
            "isDealer": i == game_state['dealer_index']
        }
        player_summary.append(player_info)
    
    context = {
        "rules": "You are a world-class Texas Hold'em poker AI. Your goal is to maximize chip count. "
                "Provide your action as a JSON object. Only choose from the legal actions. "
                "Be smart, strategic, and sometimes unpredictable.",
        "yourHand": [simplify_card(c) for c in ai_player['hand']],
        "yourChips": ai_player['chips'],
        "communityCards": [simplify_card(c) for c in game_state['community_cards']],
        "pot": game_state['pot'],
        "currentBetToCall": call_amount,
        "gamePhase": game_state['game_phase'],
        "players": player_summary,
        "legalActions": {
            "canFold": True,
            "canCheck": call_amount == 0,
            "canCall": call_amount > 0 and ai_player['chips'] > 0,
            "canBetOrRaise": ai_player['chips'] > call_amount,
            "minRaise": min_raise if call_amount > 0 else game_state['big_blind'],
            "maxRaise": max_raise
        }
    }
    
    return f"""Analyze the poker game state and decide on your next move. 
Your response must be in JSON format with these fields:
- action: One of FOLD, CHECK, CALL, BET, or RAISE
- amount: The total amount for BET or RAISE, 0 for other actions
- reasoning: Brief explanation of your decision

Game state: {json.dumps(context, indent=2)}"""

async def get_gemini_action(
    game_state: Dict[str, Any], 
    ai_player: Dict[str, Any],
    api_key: str
) -> tuple[ActionType, int]:
    """Get AI action from Gemini"""
    
    try:
        # Initialize model
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Generate prompt
        prompt = get_ai_prompt(game_state, ai_player)
        
        # Configure generation
        generation_config = genai.GenerationConfig(
            temperature=0.9,
            candidate_count=1,
            max_output_tokens=500,
        )
        
        # Get response
        response = model.generate_content(
            prompt,
            generation_config=generation_config
        )
        
        # Parse JSON response
        response_text = response.text.strip()
        
        # Extract JSON from response (handle markdown code blocks)
        if "```json" in response_text:
            start = response_text.find("```json") + 7
            end = response_text.find("```", start)
            response_text = response_text[start:end].strip()
        elif "```" in response_text:
            start = response_text.find("```") + 3
            end = response_text.find("```", start)
            response_text = response_text[start:end].strip()
        
        ai_decision = json.loads(response_text)
        
        # Validate action
        action = ActionType(ai_decision['action'])
        amount = int(ai_decision.get('amount', 0))
        
        # Ensure amount is within valid range
        if action in [ActionType.BET, ActionType.RAISE]:
            call_amount = game_state['current_bet'] - ai_player['bet']
            min_raise = game_state['current_bet'] + game_state['min_raise']
            max_raise = ai_player['chips'] + ai_player['bet']
            amount = max(min_raise, min(max_raise, amount))
        
        print(f"AI Decision: {action.value} ${amount} - {ai_decision.get('reasoning', '')}")
        
        return action, amount
        
    except Exception as e:
        print(f"Error getting Gemini AI action: {e}")
        # Fallback to simple logic
        return get_fallback_action(game_state, ai_player)

def get_fallback_action(game_state: Dict[str, Any], ai_player: Dict[str, Any]) -> tuple[ActionType, int]:
    """Fallback AI logic if Gemini fails"""
    import random
    
    call_amount = game_state['current_bet'] - ai_player['bet']
    
    # Simple strategy based on position and stack size
    stack_to_pot_ratio = ai_player['chips'] / max(1, game_state['pot'])
    
    if call_amount == 0:  # Can check
        if random.random() < 0.3:
            return ActionType.CHECK, 0
        else:
            # Sometimes bet
            bet_amount = min(
                ai_player['chips'], 
                int(game_state['pot'] * 0.5)  # Half pot bet
            )
            return ActionType.BET, bet_amount
    else:  # Need to call or fold
        pot_odds = call_amount / (game_state['pot'] + call_amount)
        
        # Fold if pot odds are bad
        if pot_odds > 0.5 and stack_to_pot_ratio < 2:
            return ActionType.FOLD, 0
        
        # Call or raise based on aggression
        if random.random() < 0.7:
            return ActionType.CALL, 0
        else:
            raise_amount = min(
                ai_player['chips'] + ai_player['bet'],
                game_state['current_bet'] + game_state['min_raise'] * 2
            )
            return ActionType.RAISE, raise_amount

# Update the main.py check_and_trigger_ai_action function to use this:
"""
async def check_and_trigger_ai_action(game_state: GameStateModel, db: Session):
    '''Check if current player is AI and trigger action'''
    players = db.query(PlayerModel).filter(PlayerModel.lobby_id == game_state.lobby_id).all()
    current_player = players[game_state.current_player_index]
    
    if current_player.is_ai and not current_player.is_folded:
        # Simulate AI thinking time
        await asyncio.sleep(1.5)
        
        # Prepare game state for AI
        game_state_dict = {
            'players': [
                {
                    'id': p.id,
                    'name': p.name,
                    'chips': p.chips,
                    'bet': p.bet,
                    'is_folded': p.is_folded,
                    'hand': json.loads(p.hand)
                } for p in players
            ],
            'community_cards': json.loads(game_state.community_cards),
            'pot': game_state.pot,
            'current_bet': game_state.current_bet,
            'min_raise': game_state.min_raise,
            'game_phase': game_state.game_phase,
            'dealer_index': game_state.dealer_index,
            'big_blind': db.query(LobbyModel).filter(
                LobbyModel.id == game_state.lobby_id
            ).first().big_blind
        }
        
        ai_player_dict = {
            'id': current_player.id,
            'name': current_player.name,
            'chips': current_player.chips,
            'bet': current_player.bet,
            'hand': json.loads(current_player.hand)
        }
        
        # Get AI action from Gemini
        if GEMINI_API_KEY:
            action, amount = await get_gemini_action(
                game_state_dict, 
                ai_player_dict,
                GEMINI_API_KEY
            )
        else:
            action, amount = get_fallback_action(game_state_dict, ai_player_dict)
        
        # Process AI action
        await process_player_action(game_state, current_player, action, amount, db)
        await check_betting_round(game_state, db)
        await broadcast_game_state(game_state.lobby_id, db)
"""

# Advanced AI Strategies Configuration
AI_PERSONALITIES = {
    "aggressive": {
        "temperature": 1.2,
        "base_aggression": 0.7,
        "bluff_frequency": 0.3,
        "fold_threshold": 0.2
    },
    "conservative": {
        "temperature": 0.5,
        "base_aggression": 0.3,
        "bluff_frequency": 0.1,
        "fold_threshold": 0.4
    },
    "balanced": {
        "temperature": 0.9,
        "base_aggression": 0.5,
        "bluff_frequency": 0.2,
        "fold_threshold": 0.3
    },
    "chaotic": {
        "temperature": 1.5,
        "base_aggression": 0.6,
        "bluff_frequency": 0.4,
        "fold_threshold": 0.15
    }
}

def get_ai_prompt_with_personality(
    game_state: Dict[str, Any], 
    ai_player: Dict[str, Any],
    personality: str = "balanced"
) -> str:
    """Generate prompt with specific AI personality"""
    
    personality_traits = AI_PERSONALITIES.get(personality, AI_PERSONALITIES["balanced"])
    
    base_prompt = get_ai_prompt(game_state, ai_player)
    
    personality_instructions = f"""
Your playing style should be {personality}:
- Aggression level: {personality_traits['base_aggression']}
- Bluff frequency: {personality_traits['bluff_frequency']}
- Fold threshold: {personality_traits['fold_threshold']}

Adjust your decisions based on:
1. Stack size relative to blinds
2. Position at the table
3. Opponent betting patterns
4. Pot odds and implied odds
5. Your table image
"""
    
    return base_prompt + "\n\n" + personality_instructions

# Hand Strength Evaluation Helper
def estimate_hand_strength(hand: list, community_cards: list) -> float:
    """
    Estimate hand strength (0-1) for AI decision making
    This is a simplified version - implement full hand evaluation for production
    """
    # Convert cards to values for basic evaluation
    card_values = {'2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, 
                   '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14}
    
    hand_values = [card_values.get(card[0], 0) for card in hand]
    community_values = [card_values.get(card[0], 0) for card in community_cards]
    
    all_values = hand_values + community_values
    
    # Check for pairs, trips, etc.
    value_counts = {}
    for v in all_values:
        value_counts[v] = value_counts.get(v, 0) + 1
    
    max_count = max(value_counts.values()) if value_counts else 0
    
    # Basic strength calculation
    if max_count >= 4:
        return 0.95  # Four of a kind
    elif max_count == 3:
        return 0.7  # Three of a kind
    elif max_count == 2:
        pairs = sum(1 for count in value_counts.values() if count == 2)
        if pairs >= 2:
            return 0.5  # Two pair
        return 0.3  # One pair
    else:
        # High card
        high_card = max(hand_values) if hand_values else 0
        return high_card / 20.0  # Normalize to 0-1
    
# Rate Limiting for API Calls
class RateLimiter:
    def __init__(self, max_calls: int = 10, time_window: int = 60):
        self.max_calls = max_calls
        self.time_window = time_window
        self.calls = []
    
    async def wait_if_needed(self):
        """Wait if rate limit would be exceeded"""
        import time
        now = time.time()
        
        # Remove old calls outside time window
        self.calls = [t for t in self.calls if now - t < self.time_window]
        
        if len(self.calls) >= self.max_calls:
            # Wait until oldest call expires
            wait_time = self.time_window - (now - self.calls[0]) + 1
            await asyncio.sleep(wait_time)
        
        self.calls.append(now)

# Global rate limiter for Gemini API
=======
# gemini_ai.py - Add this file to your backend

import json
import asyncio
from typing import Dict, Any, Optional
import google.generativeai as genai
from enum import Enum

class ActionType(str, Enum):
    FOLD = "FOLD"
    CHECK = "CHECK"
    CALL = "CALL"
    BET = "BET"
    RAISE = "RAISE"

# Initialize Gemini
def init_gemini(api_key: str):
    genai.configure(api_key=api_key)

def simplify_card(card: Dict[str, str]) -> str:
    """Convert card to simple notation"""
    return f"{card['rank']}{card['suit'][0]}"

def get_ai_prompt(game_state: Dict[str, Any], ai_player: Dict[str, Any]) -> str:
    """Generate prompt for Gemini AI"""
    
    # Calculate call amount
    call_amount = game_state['current_bet'] - ai_player['bet']
    min_raise = game_state['current_bet'] + game_state['min_raise']
    max_raise = ai_player['chips'] + ai_player['bet']  # All-in
    
    # Build player summary
    player_summary = []
    for i, p in enumerate(game_state['players']):
        player_info = {
            "name": "YOU" if p['id'] == ai_player['id'] else p['name'],
            "chips": p['chips'],
            "bet": p['bet'],
            "isFolded": p['is_folded'],
            "isDealer": i == game_state['dealer_index']
        }
        player_summary.append(player_info)
    
    context = {
        "rules": "You are a world-class Texas Hold'em poker AI. Your goal is to maximize chip count. "
                "Provide your action as a JSON object. Only choose from the legal actions. "
                "Be smart, strategic, and sometimes unpredictable.",
        "yourHand": [simplify_card(c) for c in ai_player['hand']],
        "yourChips": ai_player['chips'],
        "communityCards": [simplify_card(c) for c in game_state['community_cards']],
        "pot": game_state['pot'],
        "currentBetToCall": call_amount,
        "gamePhase": game_state['game_phase'],
        "players": player_summary,
        "legalActions": {
            "canFold": True,
            "canCheck": call_amount == 0,
            "canCall": call_amount > 0 and ai_player['chips'] > 0,
            "canBetOrRaise": ai_player['chips'] > call_amount,
            "minRaise": min_raise if call_amount > 0 else game_state['big_blind'],
            "maxRaise": max_raise
        }
    }
    
    return f"""Analyze the poker game state and decide on your next move. 
Your response must be in JSON format with these fields:
- action: One of FOLD, CHECK, CALL, BET, or RAISE
- amount: The total amount for BET or RAISE, 0 for other actions
- reasoning: Brief explanation of your decision

Game state: {json.dumps(context, indent=2)}"""

async def get_gemini_action(
    game_state: Dict[str, Any], 
    ai_player: Dict[str, Any],
    api_key: str
) -> tuple[ActionType, int]:
    """Get AI action from Gemini"""
    
    try:
        # Initialize model
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Generate prompt
        prompt = get_ai_prompt(game_state, ai_player)
        
        # Configure generation
        generation_config = genai.GenerationConfig(
            temperature=0.9,
            candidate_count=1,
            max_output_tokens=500,
        )
        
        # Get response
        response = model.generate_content(
            prompt,
            generation_config=generation_config
        )
        
        # Parse JSON response
        response_text = response.text.strip()
        
        # Extract JSON from response (handle markdown code blocks)
        if "```json" in response_text:
            start = response_text.find("```json") + 7
            end = response_text.find("```", start)
            response_text = response_text[start:end].strip()
        elif "```" in response_text:
            start = response_text.find("```") + 3
            end = response_text.find("```", start)
            response_text = response_text[start:end].strip()
        
        ai_decision = json.loads(response_text)
        
        # Validate action
        action = ActionType(ai_decision['action'])
        amount = int(ai_decision.get('amount', 0))
        
        # Ensure amount is within valid range
        if action in [ActionType.BET, ActionType.RAISE]:
            call_amount = game_state['current_bet'] - ai_player['bet']
            min_raise = game_state['current_bet'] + game_state['min_raise']
            max_raise = ai_player['chips'] + ai_player['bet']
            amount = max(min_raise, min(max_raise, amount))
        
        print(f"AI Decision: {action.value} ${amount} - {ai_decision.get('reasoning', '')}")
        
        return action, amount
        
    except Exception as e:
        print(f"Error getting Gemini AI action: {e}")
        # Fallback to simple logic
        return get_fallback_action(game_state, ai_player)

def get_fallback_action(game_state: Dict[str, Any], ai_player: Dict[str, Any]) -> tuple[ActionType, int]:
    """Fallback AI logic if Gemini fails"""
    import random
    
    call_amount = game_state['current_bet'] - ai_player['bet']
    
    # Simple strategy based on position and stack size
    stack_to_pot_ratio = ai_player['chips'] / max(1, game_state['pot'])
    
    if call_amount == 0:  # Can check
        if random.random() < 0.3:
            return ActionType.CHECK, 0
        else:
            # Sometimes bet
            bet_amount = min(
                ai_player['chips'], 
                int(game_state['pot'] * 0.5)  # Half pot bet
            )
            return ActionType.BET, bet_amount
    else:  # Need to call or fold
        pot_odds = call_amount / (game_state['pot'] + call_amount)
        
        # Fold if pot odds are bad
        if pot_odds > 0.5 and stack_to_pot_ratio < 2:
            return ActionType.FOLD, 0
        
        # Call or raise based on aggression
        if random.random() < 0.7:
            return ActionType.CALL, 0
        else:
            raise_amount = min(
                ai_player['chips'] + ai_player['bet'],
                game_state['current_bet'] + game_state['min_raise'] * 2
            )
            return ActionType.RAISE, raise_amount

# Update the main.py check_and_trigger_ai_action function to use this:
"""
async def check_and_trigger_ai_action(game_state: GameStateModel, db: Session):
    '''Check if current player is AI and trigger action'''
    players = db.query(PlayerModel).filter(PlayerModel.lobby_id == game_state.lobby_id).all()
    current_player = players[game_state.current_player_index]
    
    if current_player.is_ai and not current_player.is_folded:
        # Simulate AI thinking time
        await asyncio.sleep(1.5)
        
        # Prepare game state for AI
        game_state_dict = {
            'players': [
                {
                    'id': p.id,
                    'name': p.name,
                    'chips': p.chips,
                    'bet': p.bet,
                    'is_folded': p.is_folded,
                    'hand': json.loads(p.hand)
                } for p in players
            ],
            'community_cards': json.loads(game_state.community_cards),
            'pot': game_state.pot,
            'current_bet': game_state.current_bet,
            'min_raise': game_state.min_raise,
            'game_phase': game_state.game_phase,
            'dealer_index': game_state.dealer_index,
            'big_blind': db.query(LobbyModel).filter(
                LobbyModel.id == game_state.lobby_id
            ).first().big_blind
        }
        
        ai_player_dict = {
            'id': current_player.id,
            'name': current_player.name,
            'chips': current_player.chips,
            'bet': current_player.bet,
            'hand': json.loads(current_player.hand)
        }
        
        # Get AI action from Gemini
        if GEMINI_API_KEY:
            action, amount = await get_gemini_action(
                game_state_dict, 
                ai_player_dict,
                GEMINI_API_KEY
            )
        else:
            action, amount = get_fallback_action(game_state_dict, ai_player_dict)
        
        # Process AI action
        await process_player_action(game_state, current_player, action, amount, db)
        await check_betting_round(game_state, db)
        await broadcast_game_state(game_state.lobby_id, db)
"""

# Advanced AI Strategies Configuration
AI_PERSONALITIES = {
    "aggressive": {
        "temperature": 1.2,
        "base_aggression": 0.7,
        "bluff_frequency": 0.3,
        "fold_threshold": 0.2
    },
    "conservative": {
        "temperature": 0.5,
        "base_aggression": 0.3,
        "bluff_frequency": 0.1,
        "fold_threshold": 0.4
    },
    "balanced": {
        "temperature": 0.9,
        "base_aggression": 0.5,
        "bluff_frequency": 0.2,
        "fold_threshold": 0.3
    },
    "chaotic": {
        "temperature": 1.5,
        "base_aggression": 0.6,
        "bluff_frequency": 0.4,
        "fold_threshold": 0.15
    }
}

def get_ai_prompt_with_personality(
    game_state: Dict[str, Any], 
    ai_player: Dict[str, Any],
    personality: str = "balanced"
) -> str:
    """Generate prompt with specific AI personality"""
    
    personality_traits = AI_PERSONALITIES.get(personality, AI_PERSONALITIES["balanced"])
    
    base_prompt = get_ai_prompt(game_state, ai_player)
    
    personality_instructions = f"""
Your playing style should be {personality}:
- Aggression level: {personality_traits['base_aggression']}
- Bluff frequency: {personality_traits['bluff_frequency']}
- Fold threshold: {personality_traits['fold_threshold']}

Adjust your decisions based on:
1. Stack size relative to blinds
2. Position at the table
3. Opponent betting patterns
4. Pot odds and implied odds
5. Your table image
"""
    
    return base_prompt + "\n\n" + personality_instructions

# Hand Strength Evaluation Helper
def estimate_hand_strength(hand: list, community_cards: list) -> float:
    """
    Estimate hand strength (0-1) for AI decision making
    This is a simplified version - implement full hand evaluation for production
    """
    # Convert cards to values for basic evaluation
    card_values = {'2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, 
                   '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14}
    
    hand_values = [card_values.get(card[0], 0) for card in hand]
    community_values = [card_values.get(card[0], 0) for card in community_cards]
    
    all_values = hand_values + community_values
    
    # Check for pairs, trips, etc.
    value_counts = {}
    for v in all_values:
        value_counts[v] = value_counts.get(v, 0) + 1
    
    max_count = max(value_counts.values()) if value_counts else 0
    
    # Basic strength calculation
    if max_count >= 4:
        return 0.95  # Four of a kind
    elif max_count == 3:
        return 0.7  # Three of a kind
    elif max_count == 2:
        pairs = sum(1 for count in value_counts.values() if count == 2)
        if pairs >= 2:
            return 0.5  # Two pair
        return 0.3  # One pair
    else:
        # High card
        high_card = max(hand_values) if hand_values else 0
        return high_card / 20.0  # Normalize to 0-1
    
# Rate Limiting for API Calls
class RateLimiter:
    def __init__(self, max_calls: int = 10, time_window: int = 60):
        self.max_calls = max_calls
        self.time_window = time_window
        self.calls = []
    
    async def wait_if_needed(self):
        """Wait if rate limit would be exceeded"""
        import time
        now = time.time()
        
        # Remove old calls outside time window
        self.calls = [t for t in self.calls if now - t < self.time_window]
        
        if len(self.calls) >= self.max_calls:
            # Wait until oldest call expires
            wait_time = self.time_window - (now - self.calls[0]) + 1
            await asyncio.sleep(wait_time)
        
        self.calls.append(now)

# Global rate limiter for Gemini API
gemini_rate_limiter = RateLimiter(max_calls=10, time_window=60)