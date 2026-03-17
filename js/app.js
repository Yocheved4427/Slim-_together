// ============================================================
//  אכל טוב – Main App Logic
//  All data stored in localStorage (no server needed)
// ============================================================

'use strict';

// ── Storage helpers ─────────────────────────────────────────
const STORE_USERS   = 'aklTov_users';
const STORE_CURRENT = 'aklTov_currentUser';

function loadUsers()       { return JSON.parse(localStorage.getItem(STORE_USERS)  || '[]'); }
function saveUsers(users)  { localStorage.setItem(STORE_USERS, JSON.stringify(users)); }
function loadCurrent()     { return localStorage.getItem(STORE_CURRENT); }
function saveCurrent(u)    { localStorage.setItem(STORE_CURRENT, u); }
function clearCurrent()    { localStorage.removeItem(STORE_CURRENT); }

function getUser(username) {
  return loadUsers().find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
}
function updateUser(updated) {
  const users = loadUsers().map(u => u.username === updated.username ? updated : u);
  saveUsers(users);
}

function createUser(name, username, password, pairCode) {
  return {
    name, username, password, pairCode: pairCode.trim().toUpperCase(),
    points: 0, totalTasks: 0, currentStreak: 0, bestStreak: 0,
    lastCompletedDate: null, completedDates: [], earlyCompletions: 0,
    joinDate: todayStr()
  };
}

// ── Date helpers ────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function daysBefore(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatHebDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m-1, d);
  return date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}
function yesterdayStr() { return daysBefore(1); }

// ── Streak management ───────────────────────────────────────
function recalcStreak(user) {
  const today = todayStr();
  const yesterday = yesterdayStr();

  // If last completion was neither today nor yesterday, reset
  if (user.lastCompletedDate && user.lastCompletedDate !== today && user.lastCompletedDate !== yesterday) {
    user.currentStreak = 0;
  }
  return user;
}
function applyCompletion(user) {
  const today = todayStr();
  if (user.completedDates.includes(today)) return user; // already done

  user.completedDates.push(today);
  user.totalTasks++;
  user.points++;

  // Streak
  if (user.lastCompletedDate === yesterdayStr()) {
    user.currentStreak++;
  } else {
    user.currentStreak = 1;
  }
  user.lastCompletedDate = today;
  if (user.currentStreak > user.bestStreak) user.bestStreak = user.currentStreak;

  // Early bird
  const hour = new Date().getHours();
  if (hour < 12) user.earlyCompletions = (user.earlyCompletions || 0) + 1;

  return user;
}

// ── Partner lookup ──────────────────────────────────────────
function findPartner(currentUser) {
  const users = loadUsers();
  return users.find(u => u.pairCode === currentUser.pairCode && u.username !== currentUser.username) || null;
}

// ── Avatar color ────────────────────────────────────────────
const AVATAR_COLORS = ['#58cc02','#1cb0f6','#ff9600','#ce82ff','#ff4b4b','#46a402','#0991d0','#e6a700'];
function avatarColor(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + (hash << 5) - hash;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function avatarLetter(name) { return name.charAt(0).toUpperCase(); }

// ── Toast ───────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast hidden'; }, 3200);
}

// ── Confetti ────────────────────────────────────────────────
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 130 }, () => ({
    x: Math.random() * canvas.width,
    y: -10,
    r: Math.random() * 7 + 4,
    d: Math.random() * 100,
    color: ['#58cc02','#ffd900','#1cb0f6','#ff9600','#ce82ff','#ff4b4b'][Math.floor(Math.random()*6)],
    tilt: Math.floor(Math.random() * 12) - 6,
    speed: Math.random() * 3 + 2,
  }));

  let angle = 0;
  let frame;
  let elapsed = 0;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    angle += 0.01;
    elapsed++;
    particles.forEach(p => {
      p.y += p.speed;
      p.tilt = Math.sin(angle) * 15;
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.r * 2);
      ctx.lineTo(p.x + p.tilt - p.r, p.y);
      ctx.closePath();
      ctx.fill();
      if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width; }
    });
    if (elapsed < 120) frame = requestAnimationFrame(draw);
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); cancelAnimationFrame(frame); }
  }
  draw();
}

// ── Calendar state ───────────────────────────────────────────
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-indexed

// ════════════════════════════════════════════════════════════
//  RENDER FUNCTIONS
// ════════════════════════════════════════════════════════════

function renderNav(user) {
  user = recalcStreak(user);
  document.getElementById('nav-streak-count').textContent = user.currentStreak;
  document.getElementById('nav-points-count').textContent = user.points;
  document.getElementById('nav-flame').textContent = user.currentStreak > 0 ? '🔥' : '💤';
}

function renderHome(user) {
  user = recalcStreak(user);
  const partner = findPartner(user);
  const task    = getDailyTask();
  const today   = todayStr();

  // Greeting
  document.getElementById('greeting-name').textContent   = user.name.split(' ')[0];
  document.getElementById('banner-streak').textContent   = user.currentStreak;
  document.getElementById('banner-points').textContent   = user.points;

  // Quote
  document.getElementById('daily-quote').textContent = getRandomQuote();

  if (!partner) {
    // Waiting for partner
    document.getElementById('waiting-partner').classList.remove('hidden');
    document.getElementById('daily-task-card').classList.add('hidden');
    document.getElementById('pair-progress').classList.add('hidden');
    document.getElementById('my-pair-code').textContent = user.pairCode;
    return;
  }

  document.getElementById('waiting-partner').classList.add('hidden');
  document.getElementById('daily-task-card').classList.remove('hidden');
  document.getElementById('pair-progress').classList.remove('hidden');

  // Task card
  document.getElementById('task-date-display').textContent = formatHebDate(today);
  document.getElementById('task-icon').textContent  = task.icon;
  document.getElementById('task-title').textContent = task.title;
  document.getElementById('task-desc').textContent  = task.desc;
  document.getElementById('task-tip').textContent   = task.tip;

  // My avatar
  const myAv = document.getElementById('my-avatar-home');
  myAv.textContent         = avatarLetter(user.name);
  myAv.style.background    = avatarColor(user.username);
  document.getElementById('my-name-home').textContent = user.name;

  // My completion button
  const btnComplete = document.getElementById('btn-complete');
  const alreadyDone = user.completedDates.includes(today);
  btnComplete.classList.toggle('done', alreadyDone);
  btnComplete.disabled = alreadyDone;

  // Partner avatar
  const pAv = document.getElementById('partner-avatar-home');
  pAv.textContent       = avatarLetter(partner.name);
  pAv.style.background  = avatarColor(partner.username);
  document.getElementById('partner-name-home').textContent = partner.name;

  // Partner status
  const partnerDone = partner.completedDates.includes(today);
  const pStatus = document.getElementById('partner-status');
  if (partnerDone) {
    pStatus.className = 'partner-status done';
    pStatus.innerHTML = '<span>✅ הושלם!</span>';
  } else {
    pStatus.className = 'partner-status pending';
    pStatus.innerHTML = '<span>⏳ ממתין...</span>';
  }

  // Week dots (last 7 days)
  document.getElementById('week-my-name').textContent      = user.name;
  document.getElementById('week-partner-name').textContent = partner.name;
  renderWeekDots('week-my-dots',      user,    today);
  renderWeekDots('week-partner-dots', partner, today);
}

function renderWeekDots(containerId, user, today) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const DAYS = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
  for (let i = 6; i >= 0; i--) {
    const ds   = daysBefore(i);
    const date = new Date(ds + 'T00:00:00');
    const dot  = document.createElement('div');
    if (ds === today) {
      const done = user.completedDates.includes(ds);
      dot.className = `week-dot ${done ? 'done' : 'today'}`;
      dot.textContent = done ? '✓' : DAYS[date.getDay()];
    } else if (ds < today) {
      const done = user.completedDates.includes(ds);
      dot.className = `week-dot ${done ? 'done' : 'missed'}`;
      dot.textContent = done ? '✓' : '✗';
    } else {
      dot.className = 'week-dot future';
      dot.textContent = DAYS[date.getDay()];
    }
    dot.title = formatHebDate(ds);
    container.appendChild(dot);
  }
}

function renderProfile(user) {
  user = recalcStreak(user);

  // Avatar
  const av = document.getElementById('profile-avatar');
  av.textContent      = avatarLetter(user.name);
  av.style.background = avatarColor(user.username);

  document.getElementById('profile-name').textContent     = user.name;
  document.getElementById('profile-username').textContent = '@' + user.username;

  // Stats
  document.getElementById('stat-streak').textContent = user.currentStreak;
  document.getElementById('stat-best').textContent   = user.bestStreak;
  document.getElementById('stat-points').textContent = user.points;
  document.getElementById('stat-tasks').textContent  = user.totalTasks;

  // Calendar
  renderCalendar(user);

  // Achievements
  renderAchievements(user);
}

function renderCalendar(user) {
  const grid  = document.getElementById('calendar-grid');
  const title = document.getElementById('cal-month-title');
  grid.innerHTML = '';

  const today     = todayStr();
  const firstDay  = new Date(calYear, calMonth, 1);
  const lastDay   = new Date(calYear, calMonth + 1, 0);
  const startDow  = firstDay.getDay(); // 0=Sun

  const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני',
                     'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  title.textContent = `${MONTHS_HE[calMonth]} ${calYear}`;

  // Empty cells before first day (week starts Sunday)
  for (let i = 0; i < startDow; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day empty';
    grid.appendChild(cell);
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const ds   = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cell = document.createElement('div');
    cell.textContent = d;

    if (ds > today) {
      cell.className = 'cal-day future';
    } else if (ds === today) {
      const done = user.completedDates.includes(ds);
      cell.className = `cal-day today ${done ? 'completed' : ''}`;
    } else {
      // past
      const joinDate = user.joinDate || todayStr();
      if (ds < joinDate) {
        cell.className = 'cal-day future'; // before joining
      } else {
        cell.className = user.completedDates.includes(ds) ? 'cal-day completed' : 'cal-day missed';
      }
    }
    grid.appendChild(cell);
  }
}

function renderAchievements(user) {
  const grid = document.getElementById('achievements-grid');
  grid.innerHTML = '';
  ACHIEVEMENTS.forEach(ach => {
    const unlocked = ach.condition(user);
    const el = document.createElement('div');
    el.className = `achievement ${unlocked ? 'unlocked' : 'locked'}`;
    el.innerHTML = `
      <span class="achievement-icon">${ach.icon}</span>
      <div class="achievement-name">${ach.name}</div>
      <div class="achievement-desc">${ach.desc}</div>
    `;
    grid.appendChild(el);
  });
}

// ════════════════════════════════════════════════════════════
//  SCREEN / PAGE SWITCH
// ════════════════════════════════════════════════════════════

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.page === id.replace('page-', ''));
  });
}

// ════════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════════

function login(username, password) {
  const user = getUser(username);
  if (!user)                        return 'שם משתמש לא קיים';
  if (user.password !== password)   return 'סיסמה שגויה';
  saveCurrent(user.username);
  return null;
}

function register(name, username, password, pairCode) {
  if (!name || !username || !password || !pairCode) return 'כל השדות חובה';
  if (password.length < 4)                          return 'הסיסמה חייבת להכיל לפחות 4 תווים';
  if (getUser(username))                            return 'שם המשתמש כבר תפוס';
  const users = loadUsers();
  const newUser = createUser(name, username, password, pairCode);
  users.push(newUser);
  saveUsers(users);
  saveCurrent(newUser.username);
  return null;
}

// ════════════════════════════════════════════════════════════
//  FULL APP RENDER
// ════════════════════════════════════════════════════════════

function renderApp() {
  const username = loadCurrent();
  if (!username) { showScreen('screen-auth'); return; }
  let user = getUser(username);
  if (!user) { clearCurrent(); showScreen('screen-auth'); return; }

  // On each load, check if streak should reset due to missed day
  user = recalcStreak(user);
  updateUser(user);

  showScreen('screen-app');
  renderNav(user);
  renderHome(user);
  renderProfile(user);
  showPage('page-home');
}

// ════════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

  // ── Auth tabs ──
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`form-${tab.dataset.tab}`).classList.add('active');
    });
  });

  // ── Login ──
  document.getElementById('form-login').addEventListener('submit', e => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const err = login(username, password);
    const errEl = document.getElementById('login-error');
    if (err) { errEl.textContent = err; errEl.classList.remove('hidden'); }
    else { errEl.classList.add('hidden'); renderApp(); }
  });

  // ── Register ──
  document.getElementById('form-register').addEventListener('submit', e => {
    e.preventDefault();
    const name      = document.getElementById('reg-name').value.trim();
    const username  = document.getElementById('reg-username').value.trim();
    const password  = document.getElementById('reg-password').value;
    const pairCode  = document.getElementById('reg-paircode').value.trim();
    const err = register(name, username, password, pairCode);
    const errEl = document.getElementById('reg-error');
    if (err) { errEl.textContent = err; errEl.classList.remove('hidden'); }
    else { errEl.classList.add('hidden'); renderApp(); }
  });

  // ── Logout ──
  document.getElementById('btn-logout').addEventListener('click', () => {
    clearCurrent();
    showScreen('screen-auth');
  });

  // ── Nav tabs ──
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const page = 'page-' + tab.dataset.page;
      const username = loadCurrent();
      if (!username) return;
      let user = getUser(username);
      if (!user) return;
      if (tab.dataset.page === 'profile') renderProfile(user);
      if (tab.dataset.page === 'home')    renderHome(user);
      showPage(page);
    });
  });

  // ── Complete task button ──
  document.getElementById('btn-complete').addEventListener('click', () => {
    const username = loadCurrent();
    if (!username) return;
    let user = getUser(username);
    if (!user) return;

    const today = todayStr();
    if (user.completedDates.includes(today)) return;

    user = applyCompletion(user);
    updateUser(user);

    // Animate button
    const btn = document.getElementById('btn-complete');
    btn.classList.add('done');
    btn.disabled = true;
    btn.classList.add('pop');
    setTimeout(() => btn.classList.remove('pop'), 350);

    showToast(`🎉 נהדר! +1 נקודה! רצף: ${user.currentStreak} ימים 🔥`, 'success');
    launchConfetti();

    renderNav(user);
    renderHome(user);
  });

  // ── Calendar navigation ──
  document.getElementById('cal-prev').addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    const username = loadCurrent();
    if (username) renderCalendar(getUser(username));
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    const username = loadCurrent();
    if (username) renderCalendar(getUser(username));
  });

  // ── Initial render ──
  renderApp();
});
