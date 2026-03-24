// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const WORK_START  = 8 * 60;   // 08:00 in minutes from midnight
const LUNCH_START = 12 * 60;  // 12:00
const LUNCH_END   = 13 * 60;  // 13:00
const WORK_END    = 17 * 60;  // 17:00
const WORK_MINUTES = 8 * 60;  // 480 min = 8 effective hours

const CARDS = [
  { id: 'hour',   label: 'Hour'   },
  { id: 'day',    label: 'Day'    },
  { id: 'week',   label: 'Week'   },
  { id: 'month',  label: 'Month'  },
  { id: 'summer', label: 'Summer' },
  { id: 'fall',   label: 'Fall'   },
  { id: 'year',   label: 'Year'   },
];

const PARTICLE_COLORS = {
  active:          [26,  26,  46 ],
  'not-work-time': [185, 180, 172],
  summer:          [196, 144, 42 ],
  'off-season':    [160, 168, 184],
};

const PARTICLE_COLORS_DARK = {
  active:          [200, 200, 220],
  'not-work-time': [60,  58,  55 ],
  summer:          [196, 144, 42 ],
  'off-season':    [75,  82,  98 ],
};

// ─────────────────────────────────────────────────────────────────────────────
// App State
// ─────────────────────────────────────────────────────────────────────────────

const state = {
  workMode: false,
  includeBridgeDays: false,
  holidaySet: new Set(),
  bridgeDaySet: new Set(),
  midsommar: null,   // Date of midsommarafton
  fallStart: null,   // Date of first Monday of August
  loaded: false,
  hiddenCards: new Set(JSON.parse(localStorage.getItem('hiddenCards') || '[]')),
  customTimers: JSON.parse(localStorage.getItem('customTimers') || '[]'),
  editMode: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Date Utilities
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function firstMondayOfAugust(year) {
  const d = new Date(year, 7, 1); // Aug 1
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const offset = day === 1 ? 0 : (8 - day) % 7;
  return new Date(year, 7, 1 + offset);
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function seededRandom(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

// ─────────────────────────────────────────────────────────────────────────────
// Work Time Utilities
// ─────────────────────────────────────────────────────────────────────────────

function isWeekend(date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}

function isJuly(date) {
  return date.getMonth() === 6;
}

function isWorkDay(date) {
  if (isWeekend(date)) return false;
  if (isJuly(date)) return false;
  const ds = formatDate(date);
  if (state.holidaySet.has(ds)) return false;
  if (state.includeBridgeDays && state.bridgeDaySet.has(ds)) return false;
  return true;
}

// Returns elapsed work minutes today (0 to WORK_MINUTES)
function elapsedWorkMinutesToday(now) {
  const mins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  if (mins < WORK_START) return 0;
  if (mins >= WORK_END) return WORK_MINUTES;
  if (mins >= LUNCH_START && mins < LUNCH_END) return LUNCH_START - WORK_START;
  if (mins < LUNCH_START) return mins - WORK_START;
  return (LUNCH_START - WORK_START) + (mins - LUNCH_END);
}

function isCurrentlyWorkTime(now) {
  if (!isWorkDay(now)) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < WORK_START || mins >= WORK_END) return false;
  if (mins >= LUNCH_START && mins < LUNCH_END) return false;
  return true;
}

// Count work days in [start, end) — start inclusive, end exclusive
function countWorkDays(start, end) {
  let count = 0;
  const d = startOfDay(start);
  const e = startOfDay(end);
  while (d < e) {
    if (isWorkDay(d)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Label Formatting
// ─────────────────────────────────────────────────────────────────────────────

function fmtMinutes(min) {
  const h = Math.floor(min / 60);
  const m = Math.ceil(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtDays(n, prefix = '', suffix = 'remaining') {
  const d = n === 1 ? 'day' : 'days';
  return [prefix, `${n}`, d, suffix].filter(Boolean).join(' ');
}

function fmtWorkDays(n, prefix = '', suffix = 'remaining') {
  const d = n === 1 ? 'working day' : 'working days';
  return [prefix, `${n}`, d, suffix].filter(Boolean).join(' ');
}

function fmtDate(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtTime(h, m = 0) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress Calculations
// Each returns { progress: 0–1, remainingLabel: string, cardState: string }
// cardState: 'active' | 'not-work-time' | 'summer' | 'off-season'
// ─────────────────────────────────────────────────────────────────────────────

function getHourState(now) {
  const nextHour = (now.getHours() + 1) % 24;
  const endsLabel = `ends ${fmtTime(nextHour)}`;
  if (state.workMode && !isCurrentlyWorkTime(now)) {
    const msg = isWorkDay(now) ? 'outside work hours' : 'not a work day';
    return { progress: 0, remainingLabel: msg, endsLabel, cardState: 'not-work-time' };
  }
  const mins = now.getMinutes() + now.getSeconds() / 60;
  const remaining = Math.ceil(60 - mins);
  return { progress: mins / 60, remainingLabel: `${remaining}m remaining`, endsLabel, cardState: 'active' };
}

function getDayState(now) {
  if (state.workMode) {
    const endsLabel = 'ends 17:00';
    if (!isWorkDay(now)) {
      return { progress: 0, remainingLabel: 'not a work day', endsLabel, cardState: 'not-work-time' };
    }
    const mins = now.getHours() * 60 + now.getMinutes();
    if (mins < WORK_START) {
      return { progress: 0, remainingLabel: 'work starts at 08:00', endsLabel, cardState: 'not-work-time' };
    }
    if (mins >= LUNCH_START && mins < LUNCH_END) {
      return { progress: (LUNCH_START - WORK_START) / WORK_MINUTES, remainingLabel: 'lunch break', endsLabel, cardState: 'not-work-time' };
    }
    if (mins >= WORK_END) {
      return { progress: 1, remainingLabel: 'work day done', endsLabel, cardState: 'not-work-time' };
    }
    const elapsed = elapsedWorkMinutesToday(now);
    const remaining = WORK_MINUTES - elapsed;
    return { progress: elapsed / WORK_MINUTES, remainingLabel: fmtMinutes(remaining) + ' remaining', endsLabel, cardState: 'active' };
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const endsLabel = `ends ${fmtDate(tomorrow)}`;
  const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const remainSecs = 86400 - secs;
  return { progress: secs / 86400, remainingLabel: fmtMinutes(remainSecs / 60) + ' remaining', endsLabel, cardState: 'active' };
}

function getWeekState(now) {
  const dow = (now.getDay() + 6) % 7; // 0=Mon, 6=Sun
  const monday = startOfDay(now);
  monday.setDate(monday.getDate() - dow);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  if (state.workMode) {
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4); // Friday
    const saturdayEnd = new Date(monday);
    saturdayEnd.setDate(monday.getDate() + 5);
    const endsLabel = `ends ${fmtDate(friday)}`;
    const totalWork = countWorkDays(monday, saturdayEnd);
    if (totalWork === 0) {
      return { progress: 0, remainingLabel: 'no work days this week', endsLabel, cardState: 'not-work-time' };
    }
    let elapsed = countWorkDays(monday, startOfDay(now));
    if (isWorkDay(now)) elapsed += elapsedWorkMinutesToday(now) / WORK_MINUTES;
    const progress = Math.min(1, elapsed / totalWork);
    const remaining = Math.ceil(totalWork - elapsed);
    const label = remaining <= 0 ? 'week done' : fmtWorkDays(remaining);
    return { progress, remainingLabel: label, endsLabel, cardState: 'active' };
  }

  const sunday = new Date(nextMonday);
  sunday.setDate(nextMonday.getDate() - 1);
  const endsLabel = `ends ${fmtDate(sunday)}`;
  const progress = (now - monday) / (nextMonday - monday);
  const remainMs = nextMonday - now;
  const remainDays = Math.ceil(remainMs / 86400000);
  return { progress, remainingLabel: fmtDays(remainDays), endsLabel, cardState: 'active' };
}

function getMonthState(now) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstNextMonth = new Date(year, month + 1, 1);
  const lastDay = new Date(year, month + 1, 0);
  const endsLabel = `ends ${fmtDate(lastDay)}`;

  if (state.workMode) {
    const totalWork = countWorkDays(firstDay, firstNextMonth);
    if (totalWork === 0) {
      return { progress: 1, remainingLabel: 'no work days this month', endsLabel, cardState: 'not-work-time' };
    }
    let elapsed = countWorkDays(firstDay, startOfDay(now));
    if (isWorkDay(now)) elapsed += elapsedWorkMinutesToday(now) / WORK_MINUTES;
    const progress = Math.min(1, elapsed / totalWork);
    const remaining = Math.ceil(totalWork - elapsed);
    const label = remaining <= 0 ? 'month done' : fmtWorkDays(remaining);
    return { progress, remainingLabel: label, endsLabel, cardState: 'active' };
  }

  const progress = (now - firstDay) / (firstNextMonth - firstDay);
  const remainDays = Math.ceil((firstNextMonth - now) / 86400000);
  return { progress, remainingLabel: fmtDays(remainDays), endsLabel, cardState: 'active' };
}

function getYearState(now) {
  const year = now.getFullYear();
  const firstDay = new Date(year, 0, 1);
  const firstNextYear = new Date(year + 1, 0, 1);
  const endsLabel = `ends 31 Dec`;

  if (state.workMode) {
    const totalWork = countWorkDays(firstDay, firstNextYear);
    let elapsed = countWorkDays(firstDay, startOfDay(now));
    if (isWorkDay(now)) elapsed += elapsedWorkMinutesToday(now) / WORK_MINUTES;
    const progress = Math.min(1, elapsed / totalWork);
    const remaining = Math.ceil(totalWork - elapsed);
    const label = remaining <= 0 ? 'year done' : fmtWorkDays(remaining);
    return { progress, remainingLabel: label, endsLabel, cardState: 'active' };
  }

  const progress = (now - firstDay) / (firstNextYear - firstDay);
  const remainDays = Math.ceil((firstNextYear - now) / 86400000);
  return { progress, remainingLabel: fmtDays(remainDays), endsLabel, cardState: 'active' };
}

function getSummerState(now) {
  const { midsommar, fallStart } = state;
  if (!midsommar || !fallStart) return { progress: 0, remainingLabel: '…', endsLabel: '', cardState: 'active' };

  const year = now.getFullYear();
  const janFirst = new Date(year, 0, 1);
  const endsLabel = `ends ${fmtDate(midsommar)}`;

  // Currently summer
  if (now >= midsommar && now < fallStart) {
    const backDate = fallStart.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
    return { progress: 1, remainingLabel: `back ${backDate}`, endsLabel, cardState: 'summer' };
  }

  // Pre-summer (before midsommar)
  if (now < midsommar) {
    if (state.workMode) {
      const totalWork = countWorkDays(janFirst, midsommar);
      let elapsed = countWorkDays(janFirst, startOfDay(now));
      if (isWorkDay(now)) elapsed += elapsedWorkMinutesToday(now) / WORK_MINUTES;
      const progress = totalWork > 0 ? Math.min(1, elapsed / totalWork) : 0;
      const remaining = Math.ceil(totalWork - elapsed);
      const label = remaining <= 0 ? 'summer soon!' : fmtWorkDays(remaining, '', 'till summer');
      return { progress, remainingLabel: label, endsLabel, cardState: 'active' };
    }
    const progress = (now - janFirst) / (midsommar - janFirst);
    const remainDays = Math.ceil((midsommar - now) / 86400000);
    return { progress, remainingLabel: fmtDays(remainDays, '', 'till summer'), endsLabel, cardState: 'active' };
  }

  // After summer (fall/end of year)
  const nextYearStart = new Date(year + 1, 0, 1);
  const remainDays = Math.ceil((nextYearStart - now) / 86400000);
  return { progress: 1, remainingLabel: fmtDays(remainDays, '', 'till new year'), endsLabel, cardState: 'off-season' };
}

function getFallState(now) {
  const { fallStart } = state;
  if (!fallStart) return { progress: 0, remainingLabel: '…', cardState: 'off-season' };

  const year = now.getFullYear();
  const yearEnd = new Date(year + 1, 0, 1);

  if (now < fallStart) {
    const remainDays = Math.ceil((fallStart - now) / 86400000);
    return { progress: 0, remainingLabel: fmtDays(remainDays, '', 'till fall'), cardState: 'off-season' };
  }

  if (state.workMode) {
    const totalWork = countWorkDays(fallStart, yearEnd);
    let elapsed = countWorkDays(fallStart, startOfDay(now));
    if (isWorkDay(now)) elapsed += elapsedWorkMinutesToday(now) / WORK_MINUTES;
    const progress = totalWork > 0 ? Math.min(1, elapsed / totalWork) : 0;
    const remaining = Math.ceil(totalWork - elapsed);
    const label = remaining <= 0 ? 'year done!' : fmtWorkDays(remaining);
    return { progress, remainingLabel: label, cardState: 'active' };
  }

  const progress = Math.min(1, (now - fallStart) / (yearEnd - fallStart));
  const remainDays = Math.ceil((yearEnd - now) / 86400000);
  return { progress, remainingLabel: fmtDays(remainDays), cardState: 'active' };
}

function getCustomState(timer, now) {
  const target = new Date(timer.date + 'T00:00:00');
  const start = timer.startDate ? new Date(timer.startDate + 'T00:00:00') : new Date(timer.createdAt);
  const endsLabel = `ends ${fmtDate(target)}`;
  if (now >= target) {
    return { progress: 1, remainingLabel: 'done!', endsLabel, cardState: 'active' };
  }

  if (state.workMode) {
    const totalWork = countWorkDays(start, target);
    let elapsed = countWorkDays(start, startOfDay(now));
    if (isWorkDay(now)) elapsed += elapsedWorkMinutesToday(now) / WORK_MINUTES;
    const progress = totalWork > 0 ? Math.max(0, Math.min(1, elapsed / totalWork)) : 0;
    const remaining = Math.ceil(totalWork - elapsed);
    const label = remaining <= 0 ? 'done!' : fmtWorkDays(remaining, '', 'remaining');
    return { progress, remainingLabel: label, endsLabel, cardState: 'active' };
  }

  const total = target - start;
  const elapsed = now - start;
  const progress = total > 0 ? Math.max(0, Math.min(1, elapsed / total)) : 0;
  const remainDays = Math.ceil((target - startOfDay(now)) / 86400000);
  return { progress, remainingLabel: fmtDays(remainDays, '', 'remaining'), endsLabel, cardState: 'active' };
}

function getCardState(id, now) {
  switch (id) {
    case 'hour':   return getHourState(now);
    case 'day':    return getDayState(now);
    case 'week':   return getWeekState(now);
    case 'month':  return getMonthState(now);
    case 'year':   return getYearState(now);
    case 'summer': return getSummerState(now);
    case 'fall':   return getFallState(now);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Particle Field
// ─────────────────────────────────────────────────────────────────────────────

class ParticleField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.COLS = 100;
    this.ROWS = 4;
    this.N = this.COLS * this.ROWS;
    this.targetProgress = 0;
    this.currentProgress = 0;
    this.cardState = 'active';

    this._ro = new ResizeObserver(() => this._onResize());
    this._ro.observe(canvas.parentElement);
  }

  _onResize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * devicePixelRatio;
    this.canvas.height = rect.height * devicePixelRatio;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
  }

  update(progress, cardState) {
    this.targetProgress = progress;
    this.cardState = cardState;
  }

  draw(_ts) {
    const { ctx, canvas, COLS, ROWS, N } = this;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    this.currentProgress += (this.targetProgress - this.currentProgress) * 0.05;
    const filledCount = Math.round(this.currentProgress * N);

    const theme = document.documentElement.dataset.theme;
    const isDark = theme === 'dark' ||
      (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const colorMap = isDark ? PARTICLE_COLORS_DARK : PARTICLE_COLORS;
    const color = colorMap[this.cardState] || colorMap.active;
    const fillColor = `rgba(${color[0]},${color[1]},${color[2]},0.75)`;
    const emptyColor = `rgba(${color[0]},${color[1]},${color[2]},0.15)`;

    // Fixed dot size, tightly packed, centered in card
    const dpr = devicePixelRatio;
    const radius = 4 * dpr;
    const gap    = 2 * dpr;
    const step   = radius * 2 + gap;

    const gridW = COLS * step - gap;
    const gridH = ROWS * step - gap;
    const startX = (w - gridW) / 2;
    const startY = (h - gridH) / 2;
    const strokeW = Math.max(1, radius * 0.4);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c;
        const x = startX + c * step + radius;
        const y = startY + r * step + radius;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);

        if (idx < filledCount) {
          ctx.fillStyle = idx === filledCount - 1 ? 'rgba(205,10,0,0.85)' : fillColor;
          ctx.fill();
        } else {
          ctx.strokeStyle = emptyColor;
          ctx.lineWidth = strokeW;
          ctx.stroke();
        }
      }
    }
  }

  destroy() {
    this._ro.disconnect();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Loading & Caching
// ─────────────────────────────────────────────────────────────────────────────

async function fetchWithCache(url, cacheKey) {
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const { year, data } = JSON.parse(cached);
      if (year === new Date().getFullYear()) return data;
    } catch (_) {}
  }
  const res = await fetch(url);
  const data = await res.json();
  localStorage.setItem(cacheKey, JSON.stringify({ year: new Date().getFullYear(), data }));
  return data;
}

async function loadData() {
  const year = new Date().getFullYear();
  const [holidays, bridgeDays] = await Promise.all([
    fetchWithCache(`/api/holidays?year=${year}`, `holidays_${year}`),
    fetchWithCache(`/api/bridge-days?year=${year}`, `bridgeDays_${year}`),
  ]);

  state.holidaySet = new Set(holidays.map(h => h.date));
  state.bridgeDaySet = new Set(bridgeDays.map(h => h.date));

  const midsommarEntry = holidays.find(h => h.code === 'midsummerEve');
  state.midsommar = midsommarEntry ? new Date(midsommarEntry.date + 'T00:00:00') : null;
  state.fallStart = firstMondayOfAugust(year);
  state.loaded = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM & Card Management
// ─────────────────────────────────────────────────────────────────────────────

let particleFields = null;

function shouldShowSummer(now) {
  return state.midsommar && now < state.midsommar;
}

function shouldShowFall(now) {
  return state.fallStart && now >= state.fallStart;
}

function isBuiltinCardVisible(id, now) {
  if (state.hiddenCards.has(id)) return false;
  if (id === 'summer' && !shouldShowSummer(now)) return false;
  if (id === 'fall' && !shouldShowFall(now)) return false;
  return true;
}

function makeCardShell(id) {
  const card = document.createElement('div');
  card.className = 'card';
  card.id = `card-${id}`;

  const canvas = document.createElement('canvas');
  card.appendChild(canvas);

  const content = document.createElement('div');
  content.className = 'card-content';
  content.innerHTML = `
    <span class="card-name"></span>
    <span class="card-ends"></span>
    <span class="card-remaining"></span>
  `;
  card.appendChild(content);
  return card;
}

function rebuildCards() {
  if (particleFields) {
    Object.values(particleFields).forEach(f => f.destroy());
  }
  particleFields = {};

  const container = document.getElementById('cards');
  container.innerHTML = '';

  const now = new Date();

  // Visible built-in cards
  CARDS.forEach(({ id, label }) => {
    if (!isBuiltinCardVisible(id, now)) return;

    const card = makeCardShell(id);
    card.querySelector('.card-name').textContent = label;

    if (state.editMode) {
      const btn = document.createElement('button');
      btn.className = 'card-edit-btn card-remove';
      btn.dataset.id = id;
      btn.setAttribute('aria-label', 'Hide');
      btn.textContent = '×';
      card.querySelector('.card-content').appendChild(btn);
    }

    container.appendChild(card);
  });

  // Custom timer cards
  state.customTimers.forEach(timer => {
    const card = makeCardShell(timer.id);
    card.querySelector('.card-name').textContent = timer.label;

    if (state.editMode) {
      const btn = document.createElement('button');
      btn.className = 'card-edit-btn card-remove';
      btn.dataset.customId = timer.id;
      btn.setAttribute('aria-label', 'Remove');
      btn.textContent = '×';
      card.querySelector('.card-content').appendChild(btn);
    }

    container.appendChild(card);
  });

  // Edit mode extras
  if (state.editMode) {
    // Ghost cards for hidden built-in cards (not auto-hidden)
    CARDS.forEach(({ id, label }) => {
      if (!state.hiddenCards.has(id)) return;
      const ghost = document.createElement('div');
      ghost.className = 'card card-ghost';
      ghost.innerHTML = `
        <div class="card-content card-content-interactive">
          <span class="card-name">${label}</span>
          <button class="card-edit-btn card-restore" data-id="${id}" aria-label="Restore">+</button>
        </div>
      `;
      container.appendChild(ghost);
    });

    // Add custom timer form
    const addCard = document.createElement('div');
    addCard.className = 'card card-add';
    addCard.innerHTML = `
      <div class="add-timer-form">
        <input type="text" id="newTimerLabel" placeholder="Label" maxlength="24">
        <input type="date" id="newTimerStart">
        <input type="date" id="newTimerDate">
        <button id="addTimerBtn">Add</button>
      </div>
    `;
    container.appendChild(addCard);
  }

  // Init particle fields for all real (non-ghost) cards
  const cardEls = container.querySelectorAll('.card:not(.card-ghost):not(.card-add)');
  cardEls.forEach(card => {
    const id = card.id.replace('card-', '');
    const canvas = card.querySelector('canvas');
    if (!canvas) return;
    const rect = card.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    particleFields[id] = new ParticleField(canvas);
  });

  // Attach edit-mode button listeners
  container.querySelectorAll('.card-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const customId = btn.dataset.customId;
      if (id) {
        state.hiddenCards.add(id);
        localStorage.setItem('hiddenCards', JSON.stringify([...state.hiddenCards]));
      } else if (customId) {
        state.customTimers = state.customTimers.filter(t => t.id !== customId);
        localStorage.setItem('customTimers', JSON.stringify(state.customTimers));
      }
      rebuildCards();
    });
  });

  container.querySelectorAll('.card-restore').forEach(btn => {
    btn.addEventListener('click', () => {
      state.hiddenCards.delete(btn.dataset.id);
      localStorage.setItem('hiddenCards', JSON.stringify([...state.hiddenCards]));
      rebuildCards();
    });
  });

  const addBtn = document.getElementById('addTimerBtn');
  if (addBtn) {
    // Default dates to today
    document.getElementById('newTimerStart').value = formatDate(new Date());
    document.getElementById('newTimerDate').value = formatDate(new Date());

    addBtn.addEventListener('click', () => {
      const label = document.getElementById('newTimerLabel').value.trim();
      const startDate = document.getElementById('newTimerStart').value;
      const date = document.getElementById('newTimerDate').value;
      if (!label || !date) return;
      state.customTimers.push({
        id: `custom-${Date.now()}`,
        label,
        startDate,
        date,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('customTimers', JSON.stringify(state.customTimers));
      rebuildCards();
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Animation
// ─────────────────────────────────────────────────────────────────────────────

const weekEl = document.getElementById('week-number');

function tick(ts) {
  const now = new Date();
  if (weekEl) weekEl.innerHTML = `week <span style="color:var(--accent)">${getISOWeek(now)}</span>`;

  CARDS.forEach(({ id }) => {
    if (!isBuiltinCardVisible(id, now)) return;
    if (!particleFields[id]) return;

    const { progress, remainingLabel, endsLabel, cardState } = getCardState(id, now);
    const card = document.getElementById(`card-${id}`);
    if (!card) return;

    card.className = `card state-${cardState}`;
    card.querySelector('.card-remaining').textContent = remainingLabel;
    card.querySelector('.card-ends').textContent = endsLabel || '';

    particleFields[id].update(progress, cardState);
    particleFields[id].draw(ts);
  });

  state.customTimers.forEach(timer => {
    if (!particleFields[timer.id]) return;
    const { progress, remainingLabel, endsLabel, cardState } = getCustomState(timer, now);
    const card = document.getElementById(`card-${timer.id}`);
    if (!card) return;

    card.className = `card state-${cardState}`;
    card.querySelector('.card-remaining').textContent = remainingLabel;
    card.querySelector('.card-ends').textContent = endsLabel || '';

    particleFields[timer.id].update(progress, cardState);
    particleFields[timer.id].draw(ts);
  });

  requestAnimationFrame(tick);
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme & Toggle Setup
// ─────────────────────────────────────────────────────────────────────────────

function isDarkMode() {
  const theme = document.documentElement.dataset.theme;
  return theme === 'dark' ||
    (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function setupThemeToggle() {
  const btn = document.getElementById('themeToggle');
  const ICONS = { dark: '☀', light: '☾' };

  const saved = localStorage.getItem('theme');
  if (saved === 'dark' || saved === 'light') {
    document.documentElement.dataset.theme = saved;
  }

  function updateIcon() {
    btn.textContent = isDarkMode() ? ICONS.dark : ICONS.light;
  }

  updateIcon();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateIcon);

  btn.addEventListener('click', () => {
    const dark = isDarkMode();
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
    updateIcon();
  });
}

function setupToggles() {
  const workModeEl = document.getElementById('workMode');
  const bridgeDaysEl = document.getElementById('bridgeDays');
  const bridgeDaysLabel = document.getElementById('bridgeDaysLabel');

  // Restore saved state
  const savedWorkMode = localStorage.getItem('workMode') === 'true';
  const savedBridgeDays = localStorage.getItem('bridgeDays') === 'true';
  workModeEl.checked = savedWorkMode;
  state.workMode = savedWorkMode;
  bridgeDaysEl.checked = savedBridgeDays && savedWorkMode;
  state.includeBridgeDays = savedBridgeDays && savedWorkMode;
  bridgeDaysLabel.classList.toggle('visible', savedWorkMode);

  workModeEl.addEventListener('change', () => {
    state.workMode = workModeEl.checked;
    localStorage.setItem('workMode', state.workMode);
    bridgeDaysLabel.classList.toggle('visible', state.workMode);
    if (!state.workMode) {
      bridgeDaysEl.checked = false;
      state.includeBridgeDays = false;
      localStorage.setItem('bridgeDays', 'false');
    }
  });

  bridgeDaysEl.addEventListener('change', () => {
    state.includeBridgeDays = bridgeDaysEl.checked;
    localStorage.setItem('bridgeDays', state.includeBridgeDays);
  });
}

function setupEditMode() {
  const btn = document.getElementById('editToggle');
  btn.addEventListener('click', () => {
    state.editMode = !state.editMode;
    btn.classList.toggle('active', state.editMode);
    rebuildCards();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  const loadingEl = document.createElement('div');
  loadingEl.id = 'loading';
  loadingEl.textContent = 'loading';
  document.body.appendChild(loadingEl);

  setupToggles();
  setupThemeToggle();
  setupEditMode();

  await loadData();

  rebuildCards();

  loadingEl.classList.add('hidden');
  setTimeout(() => loadingEl.remove(), 600);

  requestAnimationFrame(tick);
}

init();
