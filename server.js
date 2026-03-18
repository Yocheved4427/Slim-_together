// ============================================================
//  אכל טוב – Server
//  npm install  →  node server.js  →  open http://localhost:3000
// ============================================================
'use strict';

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const cors    = require('cors');

const app     = express();
const DB_FILE = path.join(__dirname, 'db.json');
const PORT    = 3000;

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // serves index.html, css/, js/

// ── DB helpers ───────────────────────────────────────────────
function loadDB() {
  if (!fs.existsSync(DB_FILE)) return { users: [], pairTasks: {} };
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch (e) { return { users: [], pairTasks: {} }; }
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ════════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════════

// POST /api/register
app.post('/api/register', (req, res) => {
  const { name, username, password, pairCode } = req.body;
  if (!name || !username || !password || !pairCode)
    return res.status(400).json({ error: 'כל השדות חובה' });
  if (password.length < 4)
    return res.status(400).json({ error: 'הסיסמה חייבת להכיל לפחות 4 תווים' });

  const db = loadDB();
  if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase()))
    return res.status(400).json({ error: 'שם המשתמש כבר תפוס' });

  const user = {
    name,
    username,
    password,
    pairCode: pairCode.trim().toUpperCase(),
    points: 0,
    totalTasks: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastCompletedDate: null,
    completedDates: [],
    earlyCompletions: 0,
    joinDate: todayStr()
  };
  db.users.push(user);
  saveDB(db);
  res.json({ user: sanitize(user) });
});

// POST /api/login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db   = loadDB();
  const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user)                      return res.status(401).json({ error: 'שם משתמש לא קיים' });
  if (user.password !== password) return res.status(401).json({ error: 'סיסמה שגויה' });
  res.json({ user: sanitize(user) });
});

// ════════════════════════════════════════════════════════════
//  USERS
// ════════════════════════════════════════════════════════════

// GET /api/user/:username
app.get('/api/user/:username', (req, res) => {
  const db   = loadDB();
  const user = db.users.find(u => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: 'לא נמצא' });
  res.json({ user: sanitize(user) });
});

// PUT /api/user/:username  – update user data (completion, streak, etc.)
app.put('/api/user/:username', (req, res) => {
  const db  = loadDB();
  const idx = db.users.findIndex(u => u.username === req.params.username);
  if (idx === -1) return res.status(404).json({ error: 'לא נמצא' });
  // Never allow overwriting password via this endpoint
  const { password, ...updates } = req.body;
  db.users[idx] = { ...db.users[idx], ...updates };
  saveDB(db);
  res.json({ user: sanitize(db.users[idx]) });
});

// GET /api/partner/:pairCode/:username  – get the other user in the pair
app.get('/api/partner/:pairCode/:username', (req, res) => {
  const db      = loadDB();
  const partner = db.users.find(
    u => u.pairCode === req.params.pairCode && u.username !== req.params.username
  );
  res.json({ partner: partner ? sanitize(partner) : null });
});

// ════════════════════════════════════════════════════════════
//  COUPLE TASKS
// ════════════════════════════════════════════════════════════

// GET /api/pair-tasks/:pairCode
app.get('/api/pair-tasks/:pairCode', (req, res) => {
  const db = loadDB();
  res.json({ tasks: db.pairTasks[req.params.pairCode] || [] });
});

// PUT /api/pair-tasks/:pairCode
app.put('/api/pair-tasks/:pairCode', (req, res) => {
  const db = loadDB();
  if (!db.pairTasks) db.pairTasks = {};
  db.pairTasks[req.params.pairCode] = req.body.tasks || [];
  saveDB(db);
  res.json({ ok: true });
});

// ── Remove password from user object before sending to client ─
function sanitize(user) {
  const { password, ...safe } = user;
  return safe;
}

// ── Fallback: serve index.html for any non-API route ─────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n✅  Server running →  http://localhost:${PORT}\n`);
});
