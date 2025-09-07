# main.py
import os
import json
import random
import asyncio
from typing import Dict, List, Optional, Set
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, String, Integer, Boolean, Float, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.pool import NullPool
import asyncpg
from enum import Enum
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database configuration
DATABASE_URL = "postgresql://u190pppp2utt1:p41fdd941a1e7734bdaea53230f9981fa4a2701ecd4f20e86c6f82a420a0d6e19@c5cnr847jq0fj3.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d50onjk6e089td"

# Create SQLAlchemy engine with connection pooling disabled for serverless
engine = create_engine(DATABASE_URL, poolclass=NullPool)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Initialize Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Enums matching frontend
class Suit(str, Enum):
    HEARTS = "♥"
    DIAMONDS = "♦"
    CLUBS = "♣"
    SPADES = "♠"

class Rank(str, Enum):
    TWO = "2"
    THREE = "3"
    FOUR = "4"
    FIVE = "5"
    SIX = "6"
    SEVEN = "7"
    EIGHT = "8"
    NINE = "9"
    TEN = "T"
    JACK = "J"
    QUEEN = "Q"
    KING = "K"
    ACE = "A"

class GamePhase(str, Enum):
    SETUP = "SETUP"
    PRE_FLOP = "PRE_FLOP"
    FLOP = "FLOP"
    TURN = "TURN"
    RIVER = "RIVER"
    SHOWDOWN = "SHOWDOWN"

class ActionType(str, Enum):
    FOLD = "FOLD"
    CHECK = "CHECK"
    CALL = "CALL"
    BET = "BET"
    RAISE = "RAISE"

# Database Models
class LobbyModel(Base):
    __tablename__ = "lobbies"
    
    id = Column(String, primary_key=True)
    small_blind = Column(Integer, default=10)
    big_blind = Column(Integer, default=20)
    game_started = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    players = relationship("PlayerModel", back_populates="lobby", cascade="all, delete-orphan")
    game_state = relationship("GameStateModel", back_populates="lobby", uselist=False, cascade="all, delete-orphan")

class PlayerModel(Base):
    __tablename__ = "players"
    
    id = Column(String, primary_key=True)
    lobby_id = Column(String, ForeignKey("lobbies.id"))
    name = Column(String, nullable=False)
    chips = Column(Integer, default=1000)
    is_ai = Column(Boolean, default=False)
    is_host = Column(Boolean, default=False)
    connection_id = Column(String, nullable=True)  # WebSocket connection ID
    
    # Current hand state
    hand = Column(Text, default="[]")  # JSON string of cards
    is_folded = Column(Boolean, default=False)
    bet = Column(Integer, default=0)
    total_bet = Column(Integer, default=0)
    action = Column(String, nullable=True)
    has_acted = Column(Boolean, default=False)
    
    lobby = relationship("LobbyModel", back_populates="players")

class GameStateModel(Base):
    __tablename__ = "game_states"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    lobby_id = Column(String, ForeignKey("lobbies.id"), unique=True)
    deck = Column(Text, default="[]")  # JSON string
    community_cards = Column(Text, default="[]")  # JSON string
    pot = Column(Integer, default=0)
    current_player_index = Column(Integer, default=0)
    dealer_index = Column(Integer, default=-1)
    small_blind_index = Column(Integer, default=-1)
    big_blind_index = Column(Integer, default=-1)
    game_phase = Column(String, default=GamePhase.SETUP.value)
    current_bet = Column(Integer, default=0)
    min_raise = Column(Integer, default=0)
    last_raiser_index = Column(Integer, default=-1)
    
    lobby = relationship("LobbyModel", back_populates="game_state")

# Create tables
Base.metadata.create_all(bind=engine)

# Pydantic Models
class Card(BaseModel):
    suit: Suit
    rank: Rank

class PlayerConfig(BaseModel):
    id: str
    name: str
    chips: int
    isAI: bool
    isHost: Optional[bool] = False

class CreateLobbyRequest(BaseModel):
    hostConfig: PlayerConfig
    smallBlind: int = 10
    bigBlind: int = 20

class JoinLobbyRequest(BaseModel):
    lobbyId: str
    playerConfig: PlayerConfig

class PlayerActionRequest(BaseModel):
    lobbyId: str
    playerId: str
    action: ActionType
    amount: int = 0

class LobbyResponse(BaseModel):
    id: str
    players: List[PlayerConfig]
    smallBlind: int
    bigBlind: int
    gameStarted: bool

# WebSocket Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.player_connections: Dict[str, str] = {}  # player_id -> connection_id
        
    async def connect(self, websocket: WebSocket, connection_id: str):
        await websocket.accept()
        self.active_connections[connection_id] = websocket
        
    def disconnect(self, connection_id: str):
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        # Remove player connection mapping
        player_id = next((pid for pid, cid in self.player_connections.items() if cid == connection_id), None)
        if player_id:
            del self.player_connections[player_id]
            
    async def send_to_player(self, player_id: str, message: dict):
        connection_id = self.player_connections.get(player_id)
        if connection_id and connection_id in self.active_connections:
            await self.active_connections[connection_id].send_json(message)
            
    async def broadcast_to_lobby(self, lobby_id: str, message: dict, db: Session):
        players = db.query(PlayerModel).filter(PlayerModel.lobby_id == lobby_id).all()
        for player in players:
            if player.connection_id and player.connection_id in self.active_connections:
                await self.active_connections[player.connection_id].send_json(message)

manager = ConnectionManager()

# Poker Logic Functions
def create_deck():
    """Create a standard 52-card deck"""
    deck = []
    for suit in Suit:
        for rank in Rank:
            deck.append({"suit": suit.value, "rank": rank.value})
    return deck

def shuffle_deck(deck):
    """Shuffle the deck"""
    shuffled = deck.copy()
    random.shuffle(shuffled)
    return shuffled

def deal_cards(players, deck, num_cards):
    """Deal cards to players"""
    for _ in range(num_cards):
        for player in players:
            if not player.is_folded and deck:
                card = deck.pop()
                hand = json.loads(player.hand)
                hand.append(card)
                player.hand = json.dumps(hand)
    return deck

# FastAPI App
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting up poker server...")
    yield
    # Shutdown
    print("Shutting down poker server...")

app = FastAPI(lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# REST Endpoints
@app.post("/api/lobby/create", response_model=LobbyResponse)
async def create_lobby(request: CreateLobbyRequest, db: Session = Depends(get_db)):
    """Create a new game lobby"""
    lobby_id = ''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=7))
    
    # Create lobby
    lobby = LobbyModel(
        id=lobby_id,
        small_blind=request.smallBlind,
        big_blind=request.bigBlind,
        game_started=False
    )
    db.add(lobby)
    
    # Create host player
    host = PlayerModel(
        id=request.hostConfig.id,
        lobby_id=lobby_id,
        name=request.hostConfig.name,
        chips=request.hostConfig.chips,
        is_ai=request.hostConfig.isAI,
        is_host=True
    )
    db.add(host)
    
    # Add initial AI players
    for i in range(1, 3):
        ai_player = PlayerModel(
            id=''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=7)),
            lobby_id=lobby_id,
            name=f"Gemini Agent {i}",
            chips=1000,
            is_ai=True,
            is_host=False
        )
        db.add(ai_player)
    
    db.commit()
    db.refresh(lobby)
    
    # Return lobby configuration
    players = db.query(PlayerModel).filter(PlayerModel.lobby_id == lobby_id).all()
    return LobbyResponse(
        id=lobby_id,
        players=[PlayerConfig(
            id=p.id,
            name=p.name,
            chips=p.chips,
            isAI=p.is_ai,
            isHost=p.is_host
        ) for p in players],
        smallBlind=lobby.small_blind,
        bigBlind=lobby.big_blind,
        gameStarted=lobby.game_started
    )

@app.post("/api/lobby/join")
async def join_lobby(request: JoinLobbyRequest, db: Session = Depends(get_db)):
    """Join an existing lobby"""
    lobby = db.query(LobbyModel).filter(LobbyModel.id == request.lobbyId).first()
    if not lobby:
        raise HTTPException(status_code=404, detail="Lobby not found")
    
    # Check if lobby is full
    player_count = db.query(PlayerModel).filter(PlayerModel.lobby_id == request.lobbyId).count()
    if player_count >= 8:
        raise HTTPException(status_code=400, detail="Lobby is full")
    
    # Add player to lobby
    player = PlayerModel(
        id=request.playerConfig.id,
        lobby_id=request.lobbyId,
        name=request.playerConfig.name,
        chips=request.playerConfig.chips,
        is_ai=request.playerConfig.isAI,
        is_host=False
    )
    db.add(player)
    db.commit()
    
    # Broadcast update to all players in lobby
    await broadcast_lobby_update(request.lobbyId, db)
    
    return {"success": True}

@app.post("/api/lobby/{lobby_id}/start")
async def start_game(lobby_id: str, db: Session = Depends(get_db)):
    """Start the game"""
    lobby = db.query(LobbyModel).filter(LobbyModel.id == lobby_id).first()
    if not lobby:
        raise HTTPException(status_code=404, detail="Lobby not found")
    
    if lobby.game_started:
        raise HTTPException(status_code=400, detail="Game already started")
    
    players = db.query(PlayerModel).filter(PlayerModel.lobby_id == lobby_id).all()
    if len(players) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 players to start")
    
    # Mark game as started
    lobby.game_started = True
    
    # Initialize game state
    game_state = GameStateModel(
        lobby_id=lobby_id,
        deck=json.dumps([]),
        community_cards=json.dumps([]),
        pot=0,
        current_player_index=0,
        dealer_index=-1,
        game_phase=GamePhase.SETUP.value
    )
    db.add(game_state)
    db.commit()
    
    # Start new hand
    await start_new_hand(lobby_id, db)
    
    return {"success": True}

@app.post("/api/game/action")
async def player_action(request: PlayerActionRequest, db: Session = Depends(get_db)):
    """Handle player action"""
    game_state = db.query(GameStateModel).filter(GameStateModel.lobby_id == request.lobbyId).first()
    if not game_state:
        raise HTTPException(status_code=404, detail="Game not found")
    
    players = db.query(PlayerModel).filter(PlayerModel.lobby_id == request.lobbyId).order_by(PlayerModel.id).all()
    current_player = players[game_state.current_player_index]
    
    if current_player.id != request.playerId:
        raise HTTPException(status_code=400, detail="Not your turn")
    
    # Process action
    await process_player_action(game_state, current_player, request.action, request.amount, db)
    
    # Check if betting round is complete
    await check_betting_round(game_state, db)
    
    # Broadcast game state update
    await broadcast_game_state(request.lobbyId, db)
    
    return {"success": True}

@app.get("/api/lobby/{lobby_id}")
async def get_lobby(lobby_id: str, db: Session = Depends(get_db)):
    """Get lobby information"""
    lobby = db.query(LobbyModel).filter(LobbyModel.id == lobby_id).first()
    if not lobby:
        raise HTTPException(status_code=404, detail="Lobby not found")
    
    players = db.query(PlayerModel).filter(PlayerModel.lobby_id == lobby_id).all()
    
    return LobbyResponse(
        id=lobby_id,
        players=[PlayerConfig(
            id=p.id,
            name=p.name,
            chips=p.chips,
            isAI=p.is_ai,
            isHost=p.is_host
        ) for p in players],
        smallBlind=lobby.small_blind,
        bigBlind=lobby.big_blind,
        gameStarted=lobby.game_started
    )

# WebSocket endpoint
@app.websocket("/ws/{lobby_id}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, lobby_id: str, player_id: str, db: Session = Depends(get_db)):
    connection_id = f"{lobby_id}_{player_id}_{random.randint(1000, 9999)}"
    await manager.connect(websocket, connection_id)
    
    # Update player connection
    player = db.query(PlayerModel).filter(PlayerModel.id == player_id).first()
    if player:
        player.connection_id = connection_id
        manager.player_connections[player_id] = connection_id
        db.commit()
    
    try:
        # Send initial state
        await send_game_state_to_player(player_id, lobby_id, db)
        
        while True:
            data = await websocket.receive_json()
            # Handle WebSocket messages if needed
            
    except WebSocketDisconnect:
        manager.disconnect(connection_id)
        if player:
            player.connection_id = None
            db.commit()

# Game Logic Functions
async def start_new_hand(lobby_id: str, db: Session):
    """Start a new hand"""
    game_state = db.query(GameStateModel).filter(GameStateModel.lobby_id == lobby_id).first()
    players = db.query(PlayerModel).filter(PlayerModel.lobby_id == lobby_id).all()
    
    # Filter out players with no chips
    active_players = [p for p in players if p.chips > 0]
    
    if len(active_players) < 2:
        # Game over
        await broadcast_game_over(lobby_id, active_players[0] if active_players else None, db)
        return
    
    # Reset player states
    for player in active_players:
        player.hand = json.dumps([])
        player.is_folded = False
        player.bet = 0
        player.total_bet = 0
        player.action = None
        player.has_acted = False
    
    # Create and shuffle deck
    deck = shuffle_deck(create_deck())
    
    # Update dealer position
    game_state.dealer_index = (game_state.dealer_index + 1) % len(active_players)
    
    # Set blind positions
    game_state.small_blind_index = (game_state.dealer_index + 1) % len(active_players)
    game_state.big_blind_index = (game_state.small_blind_index + 1) % len(active_players)
    
    # Post blinds
    lobby = db.query(LobbyModel).filter(LobbyModel.id == lobby_id).first()
    small_blind_player = active_players[game_state.small_blind_index]
    big_blind_player = active_players[game_state.big_blind_index]
    
    small_blind_amount = min(lobby.small_blind, small_blind_player.chips)
    small_blind_player.chips -= small_blind_amount
    small_blind_player.bet = small_blind_amount
    small_blind_player.total_bet = small_blind_amount
    
    big_blind_amount = min(lobby.big_blind, big_blind_player.chips)
    big_blind_player.chips -= big_blind_amount
    big_blind_player.bet = big_blind_amount
    big_blind_player.total_bet = big_blind_amount
    
    game_state.pot = small_blind_amount + big_blind_amount
    game_state.current_bet = lobby.big_blind
    game_state.min_raise = lobby.big_blind
    
    # Deal cards
    deck = deal_cards(active_players, deck, 2)
    
    # Set first player to act
    game_state.current_player_index = (game_state.big_blind_index + 1) % len(active_players)
    game_state.last_raiser_index = game_state.big_blind_index
    game_state.game_phase = GamePhase.PRE_FLOP.value
    
    # Save deck state
    game_state.deck = json.dumps(deck)
    game_state.community_cards = json.dumps([])
    
    db.commit()
    
    # Broadcast update
    await broadcast_game_state(lobby_id, db)
    
    # Trigger AI action if current player is AI
    await check_and_trigger_ai_action(game_state, db)

async def process_player_action(game_state: GameStateModel, player: PlayerModel, action: ActionType, amount: int, db: Session):
    """Process a player's action"""
    player.has_acted = True
    player.action = action.value
    
    if action == ActionType.FOLD:
        player.is_folded = True
    elif action == ActionType.CHECK:
        pass  # No bet change
    elif action == ActionType.CALL:
        call_amount = min(player.chips, game_state.current_bet - player.bet)
        player.chips -= call_amount
        player.bet += call_amount
        player.total_bet += call_amount
        game_state.pot += call_amount
    elif action in [ActionType.BET, ActionType.RAISE]:
        total_bet_amount = min(player.chips + player.bet, amount)
        amount_to_put_in = total_bet_amount - player.bet
        raise_amount = total_bet_amount - game_state.current_bet
        
        player.chips -= amount_to_put_in
        player.bet = total_bet_amount
        player.total_bet += amount_to_put_in
        game_state.pot += amount_to_put_in
        game_state.current_bet = total_bet_amount
        
        # Check if it's a full raise
        if raise_amount >= game_state.min_raise and player.chips > 0:
            game_state.min_raise = raise_amount
            game_state.last_raiser_index = game_state.current_player_index
            # Reset has_acted for other players
            players = db.query(PlayerModel).filter(
                PlayerModel.lobby_id == player.lobby_id,
                PlayerModel.id != player.id,
                PlayerModel.is_folded == False,
                PlayerModel.chips > 0
            ).all()
            for p in players:
                p.has_acted = False
    
    db.commit()

async def check_betting_round(game_state: GameStateModel, db: Session):
    """Check if betting round is complete and advance game"""
    players = db.query(PlayerModel).filter(PlayerModel.lobby_id == game_state.lobby_id).all()
    active_players = [p for p in players if not p.is_folded]
    
    # Check if only one player left
    if len(active_players) <= 1:
        await handle_showdown(game_state, db)
        return
    
    # Check if all players have acted and bets are settled
    highest_bet = max(p.bet for p in active_players)
    all_acted = all(p.has_acted or p.chips == 0 for p in active_players)
    all_bets_settled = all(p.bet == highest_bet or p.chips == 0 for p in active_players)
    
    if all_acted and all_bets_settled:
        await advance_game_phase(game_state, db)
    else:
        # Move to next player
        next_index = (game_state.current_player_index + 1) % len(players)
        while players[next_index].is_folded or players[next_index].chips == 0:
            next_index = (next_index + 1) % len(players)
        game_state.current_player_index = next_index
        db.commit()
        
        # Check if next player is AI
        await check_and_trigger_ai_action(game_state, db)

async def advance_game_phase(game_state: GameStateModel, db: Session):
    """Advance to next game phase"""
    players = db.query(PlayerModel).filter(PlayerModel.lobby_id == game_state.lobby_id).all()
    
    # Reset player states for new round
    for player in players:
        player.bet = 0
        player.action = None
        player.has_acted = player.is_folded or player.chips == 0
    
    deck = json.loads(game_state.deck)
    community_cards = json.loads(game_state.community_cards)
    
    if game_state.game_phase == GamePhase.PRE_FLOP.value:
        # Deal flop
        if len(deck) >= 4:
            deck.pop()  # Burn card
            community_cards.extend([deck.pop(), deck.pop(), deck.pop()])
        game_state.game_phase = GamePhase.FLOP.value
    elif game_state.game_phase == GamePhase.FLOP.value:
        # Deal turn
        if len(deck) >= 2:
            deck.pop()  # Burn card
            community_cards.append(deck.pop())
        game_state.game_phase = GamePhase.TURN.value
    elif game_state.game_phase == GamePhase.TURN.value:
        # Deal river
        if len(deck) >= 2:
            deck.pop()  # Burn card
            community_cards.append(deck.pop())
        game_state.game_phase = GamePhase.RIVER.value
    elif game_state.game_phase == GamePhase.RIVER.value:
        # Showdown
        await handle_showdown(game_state, db)
        return
    
    # Update game state
    game_state.deck = json.dumps(deck)
    game_state.community_cards = json.dumps(community_cards)
    game_state.current_bet = 0
    game_state.min_raise = db.query(LobbyModel).filter(LobbyModel.id == game_state.lobby_id).first().big_blind
    
    # Set first player to act
    first_to_act = (game_state.dealer_index + 1) % len(players)
    while players[first_to_act].is_folded or players[first_to_act].chips == 0:
        first_to_act = (first_to_act + 1) % len(players)
    game_state.current_player_index = first_to_act
    game_state.last_raiser_index = first_to_act
    
    db.commit()
    
    # Broadcast update
    await broadcast_game_state(game_state.lobby_id, db)
    
    # Check if current player is AI
    await check_and_trigger_ai_action(game_state, db)

async def handle_showdown(game_state: GameStateModel, db: Session):
    """Handle showdown and determine winner"""
    players = db.query(PlayerModel).filter(PlayerModel.lobby_id == game_state.lobby_id).all()
    active_players = [p for p in players if not p.is_folded]
    
    game_state.game_phase = GamePhase.SHOWDOWN.value
    
    # For simplicity, randomly select winner (in production, implement hand evaluation)
    # This is where you'd integrate the poker hand evaluation logic
    if active_players:
        winner = random.choice(active_players)
        winner.chips += game_state.pot
        game_state.pot = 0
        
        # Broadcast winner
        await manager.broadcast_to_lobby(game_state.lobby_id, {
            "type": "winner",
            "winners": [{"id": winner.id, "name": winner.name}],
            "hand": "the best hand"  # Replace with actual hand evaluation
        }, db)
    
    db.commit()
    
    # Start new hand after delay
    await asyncio.sleep(5)
    await start_new_hand(game_state.lobby_id, db)

async def check_and_trigger_ai_action(game_state: GameStateModel, db: Session):
    """Check if current player is AI and trigger action"""
    players = db.query(PlayerModel).filter(PlayerModel.lobby_id == game_state.lobby_id).all()
    current_player = players[game_state.current_player_index]
    
    if current_player.is_ai and not current_player.is_folded:
        # Simulate AI thinking time
        await asyncio.sleep(1.5)
        
        # Get AI action (simplified - in production, call Gemini API)
        action, amount = get_simple_ai_action(game_state, current_player)
        
        # Process AI action
        await process_player_action(game_state, current_player, action, amount, db)
        await check_betting_round(game_state, db)
        await broadcast_game_state(game_state.lobby_id, db)

def get_simple_ai_action(game_state: GameStateModel, player: PlayerModel):
    """Simple AI logic (replace with Gemini API call)"""
    call_amount = game_state.current_bet - player.bet
    
    # Simple random strategy
    rand = random.random()
    
    if call_amount == 0:  # Can check
        if rand < 0.3:
            return ActionType.CHECK, 0
        else:
            # Bet
            bet_amount = min(player.chips, game_state.current_bet + game_state.min_raise)
            return ActionType.BET, bet_amount
    else:  # Need to call or raise
        if rand < 0.2:
            return ActionType.FOLD, 0
        elif rand < 0.7:
            return ActionType.CALL, call_amount
        else:
            # Raise
            raise_amount = min(player.chips, game_state.current_bet + game_state.min_raise * 2)
            return ActionType.RAISE, raise_amount

# Broadcast functions
async def broadcast_lobby_update(lobby_id: str, db: Session):
    """Broadcast lobby update to all players"""
    lobby = db.query(LobbyModel).filter(LobbyModel.id == lobby_id).first()
    players = db.query(PlayerModel).filter(PlayerModel.lobby_id == lobby_id).all()
    
    message = {
        "type": "lobby_update",
        "lobby": {
            "id": lobby_id,
            "players": [
                {
                    "id": p.id,
                    "name": p.name,
                    "chips": p.chips,
                    "isAI": p.is_ai,
                    "isHost": p.is_host
                } for p in players
            ],
            "smallBlind": lobby.small_blind,
            "bigBlind": lobby.big_blind,
            "gameStarted": lobby.game_started
        }
    }
    
    await manager.broadcast_to_lobby(lobby_id, message, db)

async def broadcast_game_state(lobby_id: str, db: Session):
    """Broadcast game state to all players"""
    game_state = db.query(GameStateModel).filter(GameStateModel.lobby_id == lobby_id).first()
    players = db.query(PlayerModel).filter(PlayerModel.lobby_id == lobby_id).all()
    
    message = {
        "type": "game_update",
        "gameState": {
            "players": [
                {
                    "id": p.id,
                    "name": p.name,
                    "chips": p.chips,
                    "hand": json.loads(p.hand),
                    "isAI": p.is_ai,
                    "isFolded": p.is_folded,
                    "bet": p.bet,
                    "totalBet": p.total_bet,
                    "action": p.action,
                    "hasActed": p.has_acted
                } for p in players
            ],
            "communityCards": json.loads(game_state.community_cards),
            "pot": game_state.pot,
            "currentPlayerIndex": game_state.current_player_index,
            "dealerIndex": game_state.dealer_index,
            "smallBlindIndex": game_state.small_blind_index,
            "bigBlindIndex": game_state.big_blind_index,
            "gamePhase": game_state.game_phase,
            "currentBet": game_state.current_bet,
            "minRaise": game_state.min_raise
        }
    }
    
    await manager.broadcast_to_lobby(lobby_id, message, db)

async def send_game_state_to_player(player_id: str, lobby_id: str, db: Session):
    """Send game state to specific player"""
    game_state = db.query(GameStateModel).filter(GameStateModel.lobby_id == lobby_id).first()
    if not game_state:
        return
    
    players = db.query(PlayerModel).filter(PlayerModel.lobby_id == lobby_id).all()
    
    message = {
        "type": "game_state",
        "gameState": {
            "players": [
                {
                    "id": p.id,
                    "name": p.name,
                    "chips": p.chips,
                    "hand": json.loads(p.hand) if p.id == player_id or game_state.game_phase == GamePhase.SHOWDOWN.value else [],
                    "isAI": p.is_ai,
                    "isFolded": p.is_folded,
                    "bet": p.bet,
                    "totalBet": p.total_bet,
                    "action": p.action,
                    "hasActed": p.has_acted
                } for p in players
            ],
            "communityCards": json.loads(game_state.community_cards),
            "pot": game_state.pot,
            "currentPlayerIndex": game_state.current_player_index,
            "dealerIndex": game_state.dealer_index,
            "gamePhase": game_state.game_phase,
            "currentBet": game_state.current_bet,
            "minRaise": game_state.min_raise
        }
    }
    
    await manager.send_to_player(player_id, message)

async def broadcast_game_over(lobby_id: str, winner: Optional[PlayerModel], db: Session):
    """Broadcast game over"""
    message = {
        "type": "game_over",
        "winner": {
            "id": winner.id,
            "name": winner.name
        } if winner else None
    }
    
    await manager.broadcast_to_lobby(lobby_id, message, db)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)