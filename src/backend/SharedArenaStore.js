import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { SharedGameServer } from './SharedGameServer.js';

const SESSION_GRACE_MS = 30000;
const COMMIT = `
  local current = redis.call('GET', KEYS[1])
  local version = current and cjson.decode(current).version or -1
  if version ~= tonumber(ARGV[1]) then return 0 end
  redis.call('SET', KEYS[1], ARGV[2], 'EX', 86400)
  return 1
`;

export function sessionHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

export class SharedArenaStore {
  constructor(redis, key = `bomberman:v1:${process.env.VERCEL_ENV || 'development'}:arena`) {
    this.redis = redis;
    this.key = key;
  }

  static fromEnv() {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error('Shared arena storage is not configured');
    return new SharedArenaStore(new Redis({
      url, token, retry: false, signal: () => AbortSignal.timeout(5000),
    }));
  }

  async update(action = null, presence = []) {
    // Optimistic concurrency fences BOTH state changes and their published events.
    // A stale instance retries from the winning snapshot, never overwriting it.
    for (let attempt = 0; attempt < 8; attempt++) {
      const saved = await this.redis.get(this.key);
      const now = Date.now();
      const room = saved || { version: -1, sequence: 0, sessions: {}, events: [], engine: null };
      const before = JSON.stringify(room);
      const game = new SharedGameServer(room.engine, now);
      for (const { hash, connectionId } of presence) {
        const session = room.sessions[hash];
        if (session?.connectionId === connectionId && now - session.lastSeen >= 5000)
          session.lastSeen = now;
      }
      // Expire abandoned sessions before advancing the round, respecting reconnect grace.
      for (const [hash, session] of Object.entries(room.sessions)) {
        if (now - session.lastSeen > SESSION_GRACE_MS) {
          const player = game.gameState.players[session.playerId];
          game.removePlayer(session.playerId);
          delete room.sessions[hash];
          if (player) game.broadcastEvent('player_left', {
            playerId: player.id, nickname: player.nickname,
            playerCount: Object.keys(game.gameState.players).length,
          });
        }
      }
      // With nobody left to see results, an abandoned round must not block new joins.
      if (!Object.keys(game.gameState.players).length &&
          (game.gameState.gameStarted || game.gameState.gameEnded)) {
        game.deadlines = { waiting: null, countdown: null, reset: null };
        game.resetGame();
      }
      game.advance();
      if (game.didReset) room.sessions = {};
      const reply = action ? this.applyAction(room, game, action, now) : null;
      for (const message of game.messages) room.events.push({ sequence: ++room.sequence, message });
      room.events = room.events.slice(-128);
      room.engine = game.snapshot();
      if (saved && before === JSON.stringify(room)) return { room, reply };
      const expected = room.version;
      room.version++;
      if (await this.redis.eval(COMMIT, [this.key], [expected, JSON.stringify(room)]))
        return { room, reply };
    }
    throw new Error('Shared arena is busy; retry the action');
  }

  applyAction(room, game, action, now) {
    const { message, connectionId, hash } = action;
    if (message.type === 'resume') {
      const token = message.sessionToken;
      const session = typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)
        ? room.sessions[sessionHash(token)] : null;
      if (!session || !game.gameState.players[session.playerId])
        return { type: 'resume_error', message: 'Your previous session has ended' };
      session.connectionId = connectionId;
      session.lastSeen = now;
      return {
        type: 'resume_success', sessionToken: token, playerId: session.playerId,
        player: game.gameState.players[session.playerId], gameState: game.gameState,
      };
    }
    if (message.type === 'join') {
      if (hash && room.sessions[hash])
        return { type: 'join_error', message: 'You have already joined' };
      const result = game.addPlayer(action.playerId, message.nickname);
      if (!result.success) return { type: 'join_error', message: result.error };
      room.sessions[sessionHash(action.token)] = {
        playerId: action.playerId, connectionId, lastSeen: now, lastChat: 0,
        windowStart: now, messageCount: 0,
      };
      game.broadcastEvent('player_joined', {
        playerId: action.playerId, nickname: result.player.nickname,
        playerCount: Object.keys(game.gameState.players).length,
      });
      return {
        type: 'join_success', sessionToken: action.token, playerId: action.playerId,
        player: result.player, gameState: game.gameState,
      };
    }
    const session = room.sessions[hash];
    const player = session && game.gameState.players[session.playerId];
    if (!player || session.connectionId !== connectionId)
      return { type: 'error', message: 'Join the lobby first' };
    session.lastSeen = now;
    if (now - session.windowStart >= 1000) {
      session.windowStart = now;
      session.messageCount = 0;
    }
    if (++session.messageCount > 40) return { type: 'error', message: 'Too many messages' };
    switch (message.type) {
      case 'move':
        if (!['up', 'down', 'left', 'right'].includes(message.direction))
          return { type: 'error', message: 'Invalid direction' };
        return {
          type: 'move_result', direction: message.direction,
          success: game.movePlayer(player.id, message.direction),
        };
      case 'bomb': {
        const success = game.placeBomb(player.id);
        return { type: 'bomb_result', success,
          playerBombState: { maxBombs: player.maxBombs, currentBombs: player.currentBombs } };
      }
      case 'chat': {
        const text = message.message;
        if (typeof text !== 'string' || !text.trim() || text.trim().length > 100 ||
            /[\u0000-\u001f\u007f]/u.test(text))
          return { type: 'error', message: 'Chat messages must contain 1 to 100 characters' };
        if (now - session.lastChat < 500)
          return { type: 'error', message: 'Please wait before sending another message' };
        session.lastChat = now;
        game.messages.push({ type: 'chat_message', playerId: player.id,
          nickname: player.nickname, message: text.trim(), timestamp: now });
        return null;
      }
      default:
        return { type: 'error', message: 'Unknown message type' };
    }
  }
}

export function createAction(message, connectionId, hash) {
  return { message, connectionId, hash, playerId: randomUUID(), token: randomBytes(32).toString('hex') };
}
