import express from 'express';
import session from 'express-session';
import { rateLimit } from 'express-rate-limit';
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getDatabase } from './database.js';

const deriveKey = promisify(scrypt);
const lifetime = 12 * 60 * 60 * 1000;
const safeEqual = (a, b) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

class SQLiteSessionStore extends session.Store {
  constructor(db) { super(); this.db = db; }
  get(id, callback) {
    try {
      const row = this.db.prepare('SELECT payload FROM auth_sessions WHERE id=? AND expires_at>?').get(id, Date.now());
      callback(null, row ? JSON.parse(row.payload) : null);
    } catch (error) { callback(error); }
  }
  set(id, value, callback) {
    try {
      this.db.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').run(Date.now());
      this.db.prepare('INSERT OR REPLACE INTO auth_sessions VALUES (?, ?, ?)')
        .run(id, new Date(value.cookie.expires).getTime(), JSON.stringify(value));
      callback?.();
    } catch (error) { callback?.(error); }
  }
  destroy(id, callback) {
    try { this.db.prepare('DELETE FROM auth_sessions WHERE id=?').run(id); callback?.(); }
    catch (error) { callback?.(error); }
  }
  // Sessions have a fixed lifetime rather than sliding expiry on each request.
  touch(_id, _value, callback) { callback?.(); }
}

export function createAuthentication(io, allowedOrigins) {
  const db = getDatabase();
  const production = process.env.NODE_ENV === 'production';
  const cookieName = process.env.VEYRA_TENANT_ID ? 'veyra.' + process.env.VEYRA_TENANT_ID + '.sid' : 'veyra.sid';
  if (production && (!process.env.AUTH_SESSION_SECRET || process.env.AUTH_SESSION_SECRET.length < 32 || !process.env.FRONTEND_URL)) {
    throw new Error('Production requires FRONTEND_URL and AUTH_SESSION_SECRET (at least 32 characters)');
  }
  db.prepare('INSERT OR IGNORE INTO metadata VALUES (?, ?)').run('cookie-secret', randomBytes(32).toString('hex'));
  const middleware = session({
    name: cookieName,
    secret: process.env.AUTH_SESSION_SECRET || db.prepare('SELECT value FROM metadata WHERE key=?').get('cookie-secret').value,
    store: new SQLiteSessionStore(db), resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'strict', secure: production, maxAge: lifetime },
  });
  const getUser = (id) => db.prepare("SELECT id, email, role, workspace_id FROM users WHERE id=? AND role IN ('admin', 'operator')").get(id || '');
  const status = (req) => ({
    user: getUser(req.session?.userId) || null,
    workspace: db.prepare('SELECT * FROM workspace WHERE id=?').get('default'),
    setup_required: !db.prepare('SELECT 1 FROM users LIMIT 1').get(),
    setup_token_required: production,
  });
  const servicePaths = new Set(['/voice/webhook', '/voice/vapi-llm', '/transcript/chunk', '/transcript/signal']);
  const isService = (req) => servicePaths.has(req.path) && process.env.VOICE_SERVICE_TOKEN?.length >= 32
    && safeEqual(req.get('authorization') || '', `Bearer ${process.env.VOICE_SERVICE_TOKEN}`);
  const originGuard = (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || isService(req)) return next();
    if (!allowedOrigins.includes(req.get('origin'))) return res.status(403).json({ error: 'Request origin is not allowed' });
    next();
  };
  const requireAuth = (req, res, next) => {
    if (getUser(req.session?.userId) || isService(req)) return next();
    res.status(401).json({ error: 'Sign in to your workspace' });
  };
  const requireAdmin = (req, res, next) => {
    const user = getUser(req.session?.userId);
    if (!user) return res.status(401).json({ error: 'Sign in to your workspace' });
    if (user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required' });
    next();
  };
  const audit = (actor, action, target) => db.prepare('INSERT INTO team_events (actor_id, action, target_id, created_at) VALUES (?, ?, ?, ?)').run(actor, action, target, Date.now());
  const hashToken = token => createHash('sha256').update(token).digest('hex');
  const teamRouter = express.Router();
  teamRouter.use(requireAdmin);
  teamRouter.get('/', (_req, res) => res.json({
    users: db.prepare("SELECT id, email, role FROM users WHERE workspace_id='default' ORDER BY email").all(),
    invites: db.prepare('SELECT id, email, role, expires_at FROM team_invites WHERE accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ? ORDER BY expires_at DESC').all(Date.now()),
  }));
  teamRouter.post('/invites', (req, res) => {
    const { email, role } = req.body;
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !['admin', 'operator'].includes(role)) {
      return res.status(400).json({ error: 'Enter a valid email and role' });
    }
    const normalized = email.trim().toLowerCase();
    if (db.prepare('SELECT 1 FROM users WHERE email=?').get(normalized)) return res.status(409).json({ error: 'An account already exists for this email' });
    if (db.prepare('SELECT 1 FROM team_invites WHERE email=? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>?').get(normalized, Date.now())) {
      return res.status(409).json({ error: 'An invitation is already pending for this email' });
    }
    const id = randomUUID(), token = randomBytes(32).toString('hex'), expiresAt = Date.now() + 48 * 60 * 60 * 1000;
    db.prepare('INSERT INTO team_invites (id,email,role,token_hash,expires_at,created_by) VALUES (?,?,?,?,?,?)')
      .run(id, normalized, role, hashToken(token), expiresAt, req.session.userId);
    audit(req.session.userId, 'invite.created', id);
    res.status(201).json({ id, token, expires_at: expiresAt });
  });
  teamRouter.post('/invites/:id/revoke', (req, res) => {
    const changed = db.prepare('UPDATE team_invites SET revoked_at=? WHERE id=? AND accepted_at IS NULL AND revoked_at IS NULL').run(Date.now(), req.params.id);
    if (!changed.changes) return res.status(404).json({ error: 'Pending invitation not found' });
    audit(req.session.userId, 'invite.revoked', req.params.id);
    res.json({ ok: true });
  });
  teamRouter.patch('/users/:id', (req, res) => {
    const { role } = req.body;
    if (!['admin', 'operator', 'disabled'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const user = db.prepare("SELECT id, role FROM users WHERE id=? AND workspace_id='default'").get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Account not found' });
    if (user.role === 'admin' && role !== 'admin' && db.prepare("SELECT COUNT(*) AS total FROM users WHERE role='admin'").get().total <= 1) {
      return res.status(409).json({ error: 'The workspace must retain an administrator' });
    }
    if (user.role !== role) {
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('UPDATE users SET role=? WHERE id=?').run(role, user.id);
        db.prepare("DELETE FROM auth_sessions WHERE json_extract(payload, '$.userId')=?").run(user.id);
        // Outstanding invitations must not outlive their creator's admin authority.
        if (role !== 'admin') db.prepare('UPDATE team_invites SET revoked_at=? WHERE created_by=? AND accepted_at IS NULL AND revoked_at IS NULL').run(Date.now(), user.id);
        audit(req.session.userId, 'member.' + role, user.id);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      io.in('user:' + user.id).disconnectSockets(true);
    }
    res.json({ ok: true });
  });
  const router = express.Router();
  router.get('/session', (req, res) => { res.set('Cache-Control', 'no-store'); res.json(status(req)); });
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' } });
  async function signIn(req, user) {
    const previous = req.sessionID;
    await new Promise((resolve, reject) => req.session.regenerate((err) => err ? reject(err) : resolve()));
    io.in(`auth:${previous}`).disconnectSockets(true);
    req.session.userId = user.id;
    await new Promise((resolve, reject) => req.session.save((err) => err ? reject(err) : resolve()));
  }
  router.post('/accept-invite', limiter, async (req, res) => {
    const { token, password } = req.body;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || typeof password !== 'string' || password.length < 12 || password.length > 256) {
      return res.status(400).json({ error: 'Enter an invitation token and a password of 12-256 characters' });
    }
    const salt = randomBytes(16).toString('hex');
    const key = await deriveKey(password, salt, 64);
    const id = randomUUID();
    db.exec('BEGIN IMMEDIATE');
    try {
      const invite = db.prepare('SELECT * FROM team_invites WHERE token_hash=? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>?').get(hashToken(token), Date.now());
      if (!invite || getUser(invite.created_by)?.role !== 'admin' || db.prepare('SELECT 1 FROM users WHERE email=?').get(invite.email)) {
        db.exec('ROLLBACK');
        return res.status(400).json({ error: 'Invitation is expired, revoked, or already used' });
      }
      db.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run(id, invite.email, salt + ':' + key.toString('hex'), 'default', invite.role);
      db.prepare('UPDATE team_invites SET accepted_at=? WHERE id=?').run(Date.now(), invite.id);
      audit(id, 'invite.accepted', invite.id);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    await signIn(req, { id });
    res.status(201).json(status(req));
  });
  router.post('/setup', limiter, async (req, res) => {
    if (db.prepare('SELECT 1 FROM users LIMIT 1').get()) return res.status(409).json({ error: 'Workspace is already configured' });
    const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    if (production ? !process.env.WORKSPACE_SETUP_TOKEN || !safeEqual(req.get('x-setup-token') || '', process.env.WORKSPACE_SETUP_TOKEN) : !loopback) {
      return res.status(403).json({ error: 'Workspace setup is not authorized' });
    }
    const { email, password, workspace } = req.body;
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
      || typeof password !== 'string' || password.length < 12 || password.length > 256
      || typeof workspace !== 'string' || !workspace.trim() || workspace.length > 100) {
      return res.status(400).json({ error: 'Enter a valid email, workspace name, and a password of 12-256 characters' });
    }
    const salt = randomBytes(16).toString('hex');
    const key = await deriveKey(password, salt, 64);
    const id = randomUUID();
    // Recheck after hashing: two concurrent setup requests must not create two owners.
    db.exec('BEGIN IMMEDIATE');
    try {
      if (db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
        db.exec('ROLLBACK');
        return res.status(409).json({ error: 'Workspace is already configured' });
      }
      db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)').run(id, email.trim().toLowerCase(), `${salt}:${key.toString('hex')}`, 'default', 'admin');
      db.prepare('UPDATE workspace SET name=? WHERE id=?').run(workspace.trim(), 'default');
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    await signIn(req, { id });
    res.status(201).json(status(req));
  });
  router.post('/login', limiter, async (req, res) => {
    const { email, password } = req.body;
    if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string' || password.length > 256) {
      return res.status(400).json({ error: 'Enter an email and password' });
    }
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(email.trim().toLowerCase());
    const [salt, expected] = (user?.password_hash || `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
    const actual = await deriveKey(password, salt, 64);
    if (!safeEqual(actual.toString('hex'), expected) || !user || !getUser(user.id)) return res.status(401).json({ error: 'Invalid email or password' });
    await signIn(req, user);
    res.json(status(req));
  });
  router.post('/logout', async (req, res) => {
    const id = req.sessionID;
    await new Promise((resolve, reject) => req.session.destroy((err) => err ? reject(err) : resolve()));
    io.in(`auth:${id}`).disconnectSockets(true);
    res.clearCookie(cookieName, { httpOnly: true, sameSite: 'strict', secure: production });
    res.json({ ok: true });
  });
  io.engine.use(middleware);
  io.use((socket, next) => {
    if (!getUser(socket.request.session?.userId)) return next(new Error('Authentication required'));
    if (socket.handshake.headers.origin && !allowedOrigins.includes(socket.handshake.headers.origin)) return next(new Error('Origin not allowed'));
    next();
  });
  io.on('connection', (socket) => {
    socket.join('user:' + socket.request.session.userId);
    socket.use((_packet, next) => {
      if (!getUser(socket.request.session.userId) || !db.prepare('SELECT 1 FROM auth_sessions WHERE id=? AND expires_at>?').get(socket.request.sessionID, Date.now())) {
        socket.disconnect(true);
        return;
      }
      next();
    });
    socket.join(`auth:${socket.request.sessionID}`);
    const stored = db.prepare('SELECT expires_at FROM auth_sessions WHERE id=?').get(socket.request.sessionID);
    const remaining = (stored?.expires_at || 0) - Date.now();
    const expiry = setTimeout(() => socket.disconnect(true), Math.max(0, remaining));
    expiry.unref();
    socket.on('disconnect', () => clearTimeout(expiry));
  });
  return { middleware, router, originGuard, requireAuth, requireAdmin, teamRouter };
}
