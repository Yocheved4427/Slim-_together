// ============================================================
//  אכל טוב – API layer (Firebase Firestore)
//  No server needed – data lives in Firestore, accessible
//  from any browser / device / network.
// ============================================================
'use strict';

// db is defined in firebase-config.js (loaded before this file)

const API = {

  // ── Auth ──────────────────────────────────────────────────

  async register(name, username, password, pairCode) {
    const key = username.toLowerCase();
    const doc = await db.collection('users').doc(key).get();
    if (doc.exists) return { error: 'שם המשתמש כבר תפוס' };
    if (!name || !username || !password || !pairCode) return { error: 'כל השדות חובה' };
    if (password.length < 4) return { error: 'הסיסמה חייבת להכיל לפחות 4 תווים' };

    const today = _todayStr();
    const user = {
      name, username: key, password,
      pairCode: pairCode.trim().toUpperCase(),
      points: 0, totalTasks: 0, currentStreak: 0, bestStreak: 0,
      lastCompletedDate: null, completedDates: [], earlyCompletions: 0,
      joinDate: today
    };
    await db.collection('users').doc(key).set(user);
    return { user: _sanitize(user) };
  },

  async login(username, password) {
    const doc = await db.collection('users').doc(username.toLowerCase()).get();
    if (!doc.exists)              return { error: 'שם משתמש לא קיים' };
    const user = doc.data();
    if (user.password !== password) return { error: 'סיסמה שגויה' };
    return { user: _sanitize(user) };
  },

  // ── Users ─────────────────────────────────────────────────

  async getUser(username) {
    const doc = await db.collection('users').doc(username.toLowerCase()).get();
    return doc.exists ? _sanitize(doc.data()) : null;
  },

  async updateUser(user) {
    await db.collection('users').doc(user.username.toLowerCase()).set(user, { merge: true });
    return _sanitize(user);
  },

  async getPartner(pairCode, username) {
    const snap = await db.collection('users')
      .where('pairCode', '==', pairCode)
      .get();
    const partner = snap.docs
      .map(d => d.data())
      .find(u => u.username !== username.toLowerCase());
    return partner ? _sanitize(partner) : null;
  },

  // ── Couple custom tasks ───────────────────────────────────

  async getPairTasks(pairCode) {
    const doc = await db.collection('pairTasks').doc(pairCode).get();
    return doc.exists ? (doc.data().tasks || []) : [];
  },

  async savePairTasks(pairCode, tasks) {
    await db.collection('pairTasks').doc(pairCode).set({ tasks });
  },

  // ── Daily task (set manually each day) ───────────────────

  async getDailyTask(dateStr) {
    const doc = await db.collection('dailyTasks').doc(dateStr).get();
    return doc.exists ? doc.data() : null;
  },

  async setDailyTask(dateStr, task) {
    await db.collection('dailyTasks').doc(dateStr).set(task);
  }
};

// ── Internal helpers ──────────────────────────────────────
function _sanitize(user) {
  const { password, ...safe } = user;
  return safe;
}
function _todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
