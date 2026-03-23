// ============================================================
//  אכל טוב – Main App Logic  (Firebase edition)
//  All data stored in Firebase Firestore.
//  Daily task is set manually each day by any logged-in user.
// ============================================================

'use strict';

// ── Session (only username kept locally) ─────────────────
const STORE_CURRENT = 'aklTov_currentUser';
function loadCurrent()   { return localStorage.getItem(STORE_CURRENT); }
function saveCurrent(u)  { localStorage.setItem(STORE_CURRENT, u); }
function clearCurrent()  { localStorage.removeItem(STORE_CURRENT); }

// ── Date helpers ─────────────────────────────────────────────
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
  return new Date(y, m-1, d).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}
function yesterdayStr() { return daysBefore(1); }

// ── Streak management ─────────────────────────────────────────
function recalcStreak(user) {
  if (user.lastCompletedDate &&
      user.lastCompletedDate !== todayStr() &&
      user.lastCompletedDate !== yesterdayStr()) {
    user.currentStreak = 0;
  }
  return user;
}
function applyCompletion(user) {
  const today = todayStr();
  if (user.completedDates.includes(today)) return user;
  user.completedDates.push(today);
  user.totalTasks++;
  user.points++;
  user.currentStreak = user.lastCompletedDate === yesterdayStr() ? user.currentStreak + 1 : 1;
  user.lastCompletedDate = today;
  if (user.currentStreak > user.bestStreak) user.bestStreak = user.currentStreak;
  const hour = new Date().getHours();
  if (hour < 12) user.earlyCompletions = (user.earlyCompletions || 0) + 1;
  return user;
}

// ── Avatar helpers ────────────────────────────────────────────
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
//  RENDER FUNCTIONS  (data passed in as parameters)
// ════════════════════════════════════════════════════════════

function renderNav(user) {
  document.getElementById('nav-streak-count').textContent = user.currentStreak;
  document.getElementById('nav-points-count').textContent = user.points;
  document.getElementById('nav-flame').textContent        = user.currentStreak > 0 ? '🔥' : '💤';
}

function renderHome(user, partner, dailyTasks) {
  const today = todayStr();

  // Greeting
  document.getElementById('greeting-name').textContent   = user.name.split(' ')[0];
  document.getElementById('banner-streak').textContent   = user.currentStreak;
  document.getElementById('banner-points').textContent   = user.points;

  document.getElementById('daily-quote').textContent = getRandomQuote();

  // No partner yet
  if (!partner) {
    document.getElementById('set-task-section').classList.add('hidden');
    document.getElementById('waiting-partner').classList.remove('hidden');
    document.getElementById('daily-task-card').classList.add('hidden');
    document.getElementById('partner-task-card').classList.add('hidden');
    document.getElementById('pair-progress').classList.add('hidden');
    document.getElementById('my-pair-code').textContent = user.pairCode;
    return;
  }

  const tasks   = (dailyTasks && dailyTasks.tasks) ? dailyTasks.tasks : {};
  // myTask  = task the partner set for me
  // partnerTask = task I set for my partner
  const myTask      = tasks[user.username]    || null;
  const partnerTask = tasks[partner.username] || null;

  // Update set-task toggle label to reflect current status
  const setTaskLabel = document.querySelector('#set-task-toggle span:first-child');
  if (setTaskLabel) {
    setTaskLabel.textContent = partnerTask
      ? `✏️ שנה משימה לשותף ✅`
      : `✏️ הגדר משימה לשותף`;
  }

  document.getElementById('set-task-section').classList.remove('hidden');
  document.getElementById('waiting-partner').classList.add('hidden');
  document.getElementById('pair-progress').classList.remove('hidden');

  // ── My task card (partner assigned this to me) ──
  document.getElementById('daily-task-card').classList.remove('hidden');
  document.getElementById('task-date-display').textContent = formatHebDate(today);
  document.getElementById('task-tip').textContent = getDailyTip();

  if (!myTask) {
    document.getElementById('task-icon').textContent  = '⏳';
    document.getElementById('task-title').textContent = `${partner.name.split(' ')[0]} עוד לא הגדיר משימה בשבילך`;
    document.getElementById('task-desc').textContent  = 'צפה שהשותף יגדיר את המשימה שלך בקרוב.';
    document.getElementById('btn-complete').disabled  = true;
    document.getElementById('btn-complete').classList.remove('done');
  } else {
    document.getElementById('task-icon').textContent  = myTask.icon  || '🥗';
    document.getElementById('task-title').textContent = myTask.title || '';
    document.getElementById('task-desc').textContent  = myTask.desc  || '';
    const alreadyDone = user.completedDates.includes(today);
    document.getElementById('btn-complete').classList.toggle('done', alreadyDone);
    document.getElementById('btn-complete').disabled  = alreadyDone;
  }

  // My avatar (in my task card)
  const myAv = document.getElementById('my-avatar-home');
  myAv.textContent      = avatarLetter(user.name);
  myAv.style.background = avatarColor(user.username);
  document.getElementById('my-name-home').textContent = user.name;

  // ── Partner’s task card (I assigned this to partner) ──
  document.getElementById('partner-task-card').classList.remove('hidden');
  document.getElementById('partner-task-label').textContent =
    `המשימה של ${partner.name.split(' ')[0]}`;

  if (!partnerTask) {
    document.getElementById('partner-task-icon').textContent  = '❓';
    document.getElementById('partner-task-title').textContent = 'עדיין לא הגדרת משימה לשותף';
    document.getElementById('partner-task-desc').textContent  = 'השתמש בטופס למעלה כדי להגדיר משימה.';
  } else {
    document.getElementById('partner-task-icon').textContent  = partnerTask.icon  || '🥗';
    document.getElementById('partner-task-title').textContent = partnerTask.title || '';
    document.getElementById('partner-task-desc').textContent  = partnerTask.desc  || '';
  }

  // Partner avatar & status (in partner task card)
  const pAv = document.getElementById('partner-avatar-home');
  pAv.textContent       = avatarLetter(partner.name);
  pAv.style.background  = avatarColor(partner.username);
  document.getElementById('partner-name-home').textContent = partner.name;

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

function renderProfile(user, customTasks) {
  const av = document.getElementById('profile-avatar');
  av.textContent      = avatarLetter(user.name);
  av.style.background = avatarColor(user.username);

  document.getElementById('profile-name').textContent     = user.name;
  document.getElementById('profile-username').textContent = '@' + user.username;
  document.getElementById('stat-streak').textContent      = user.currentStreak;
  document.getElementById('stat-best').textContent        = user.bestStreak;
  document.getElementById('stat-points').textContent      = user.points;
  document.getElementById('stat-tasks').textContent       = user.totalTasks;

  renderCalendar(user);
  renderAchievements(user);
  renderCustomTasksList(customTasks, user.pairCode);
}

function renderCustomTasksList(tasks, pairCode) {
  const list = document.getElementById('custom-tasks-list');
  list.innerHTML = '';

  if (!tasks || tasks.length === 0) {
    list.innerHTML = '<p class="empty-tasks-msg">עדיין לא הוספתם משימות לזוג</p>';
    return;
  }

  tasks.forEach((task, idx) => {
    const item = document.createElement('div');
    item.className = 'custom-task-item';
    item.innerHTML = `
      <span class="ct-icon">${task.icon || '📌'}</span>
      <div class="ct-body">
        <div class="ct-title">${task.title}</div>
        ${task.desc ? `<div class="ct-desc">${task.desc}</div>` : ''}
      </div>
      <span class="custom-task-badge">זוגי</span>
      <button class="btn-delete-task" data-idx="${idx}" title="מחק משימה">🗑</button>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll('.btn-delete-task').forEach(btn => {
    btn.addEventListener('click', async () => {
      const i    = parseInt(btn.dataset.idx);
      const curr = await API.getPairTasks(pairCode);
      curr.splice(i, 1);
      await API.savePairTasks(pairCode, curr);
      const uname = loadCurrent();
      const u     = await API.getUser(uname);
      renderProfile(recalcStreak(u), curr);
      showToast('המשימה נמחקה', 'info');
    });
  });
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
//  FULL APP RENDER  (async)
// ════════════════════════════════════════════════════════════

let pollInterval = null;

async function renderApp() {
  const username = loadCurrent();
  if (!username) { showScreen('screen-auth'); return; }

  let user = await API.getUser(username);
  if (!user) { clearCurrent(); showScreen('screen-auth'); return; }

  const streakBefore = user.currentStreak;
  user = recalcStreak(user);
  if (user.currentStreak !== streakBefore) await API.updateUser(user);

  const [partner, dailyTasks] = await Promise.all([
    API.getPartner(user.pairCode, user.username),
    API.getDailyTasks(todayStr())
  ]);

  showScreen('screen-app');
  renderNav(user);
  renderHome(user, partner, dailyTasks);
  renderProfile(user, await API.getPairTasks(user.pairCode));
  showPage('page-home');

  // Poll every 8 s to sync partner + daily task changes
  clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    const uname = loadCurrent();
    if (!uname) { clearInterval(pollInterval); return; }
    const [freshUser, freshPartner, freshTasks] = await Promise.all([
      API.getUser(uname),
      API.getPartner(user.pairCode, uname),
      API.getDailyTasks(todayStr())
    ]);
    if (!freshUser) return;
    renderNav(recalcStreak(freshUser));
    renderHome(recalcStreak(freshUser), freshPartner, freshTasks);
  }, 8000);
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
  document.getElementById('form-login').addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');
    const result   = await API.login(username, password);
    if (result.error) { errEl.textContent = result.error; errEl.classList.remove('hidden'); }
    else { errEl.classList.add('hidden'); saveCurrent(result.user.username); await renderApp(); }
  });

  // ── Register ──
  document.getElementById('form-register').addEventListener('submit', async e => {
    e.preventDefault();
    const name     = document.getElementById('reg-name').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const pairCode = document.getElementById('reg-paircode').value.trim();
    const errEl    = document.getElementById('reg-error');
    const result   = await API.register(name, username, password, pairCode);
    if (result.error) { errEl.textContent = result.error; errEl.classList.remove('hidden'); }
    else { errEl.classList.add('hidden'); saveCurrent(result.user.username); await renderApp(); }
  });

  // ── Logout ──
  document.getElementById('btn-logout').addEventListener('click', () => {
    clearInterval(pollInterval);
    clearCurrent();
    showScreen('screen-auth');
  });

  // ── Nav tabs ──
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      const username = loadCurrent();
      if (!username) return;
      const user = await API.getUser(username);
      if (!user) return;
      if (tab.dataset.page === 'profile') {
        const tasks = await API.getPairTasks(user.pairCode);
        renderProfile(recalcStreak(user), tasks);
      }
      if (tab.dataset.page === 'home') {
        const [partner, dailyTasks] = await Promise.all([
          API.getPartner(user.pairCode, user.username),
          API.getDailyTasks(todayStr())
        ]);
        renderHome(recalcStreak(user), partner, dailyTasks);
      }
      showPage('page-' + tab.dataset.page);
    });
  });

  // ── Set today’s task toggle ──
  document.getElementById('set-task-toggle').addEventListener('click', () => {
    const form  = document.getElementById('form-set-task');
    const arrow = document.getElementById('set-task-arrow');
    const open  = form.classList.toggle('hidden');
    arrow.textContent = open ? '▼' : '▲';
  });

  // ── Set today's task for partner ──
  document.getElementById('form-set-task').addEventListener('submit', async e => {
    e.preventDefault();
    const icon  = document.getElementById('set-task-icon').value.trim()  || '🥗';
    const title = document.getElementById('set-task-title').value.trim();
    const desc  = document.getElementById('set-task-desc').value.trim();
    if (!title) return;
    const username = loadCurrent();
    const user     = await API.getUser(username);
    if (!user) return;
    const partner  = await API.getPartner(user.pairCode, user.username);
    if (!partner) return;
    const task = { icon, title, desc, setBy: user.name, setAt: new Date().toISOString() };
    await API.setDailyTaskForUser(todayStr(), partner.username, task);
    document.getElementById('set-task-icon').value  = '';
    document.getElementById('set-task-title').value = '';
    document.getElementById('set-task-desc').value  = '';
    document.getElementById('form-set-task').classList.add('hidden');
    document.getElementById('set-task-arrow').textContent = '▼';
    const dailyTasks = await API.getDailyTasks(todayStr());
    renderHome(recalcStreak(user), partner, dailyTasks);
    showToast(`✅ משימה נשמרה עבור ${partner.name.split(' ')[0]}!`, 'success');
  });

  // ── Complete task button ──
  document.getElementById('btn-complete').addEventListener('click', async () => {
    const username = loadCurrent();
    if (!username) return;
    let user = await API.getUser(username);
    if (!user || user.completedDates.includes(todayStr())) return;

    user = applyCompletion(user);
    user = await API.updateUser(user);

    const btn = document.getElementById('btn-complete');
    btn.classList.add('done'); btn.disabled = true;
    btn.classList.add('pop');
    setTimeout(() => btn.classList.remove('pop'), 350);

    showToast(`🎉 נהדר! +1 נקודה! רצף: ${user.currentStreak} ימים 🔥`, 'success');
    launchConfetti();

    const [partner, dailyTasks] = await Promise.all([
      API.getPartner(user.pairCode, user.username),
      API.getDailyTasks(todayStr())
    ]);
    renderNav(user);
    renderHome(user, partner, dailyTasks);
  });

  // ── Add custom task ──
  document.getElementById('form-add-task').addEventListener('submit', async e => {
    e.preventDefault();
    const icon  = document.getElementById('new-task-icon').value.trim()  || '📌';
    const title = document.getElementById('new-task-title').value.trim();
    const desc  = document.getElementById('new-task-desc').value.trim();
    const tip   = document.getElementById('new-task-tip').value.trim();
    if (!title) return;
    const username = loadCurrent();
    const user     = await API.getUser(username);
    if (!user) return;
    const tasks = await API.getPairTasks(user.pairCode);
    tasks.push({ icon, title, desc, tip, custom: true });
    await API.savePairTasks(user.pairCode, tasks);
    document.getElementById('new-task-icon').value  = '';
    document.getElementById('new-task-title').value = '';
    document.getElementById('new-task-desc').value  = '';
    document.getElementById('new-task-tip').value   = '';
    renderCustomTasksList(tasks, user.pairCode);
    showToast(`✅ המשימה "${title}" נוספה לרוטציה!`, 'success');
  });

  // ── Calendar navigation ──
  document.getElementById('cal-prev').addEventListener('click', async () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    const username = loadCurrent();
    if (username) renderCalendar(await API.getUser(username));
  });
  document.getElementById('cal-next').addEventListener('click', async () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    const username = loadCurrent();
    if (username) renderCalendar(await API.getUser(username));
  });

  // ── Initial render ──
  renderApp();
});
