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
  { id: 'year',   label: 'Year'   },
  { id: 'summer', label: 'Summer' },
  { id: 'fall',   label: 'Fall'   },
];

const PARTICLE_COLORS = {
  active:       [26,  26,  46 ],
  'not-work-time': [185, 180, 172],
  summer:       [196, 144, 42 ],
  'off-season': [160, 168, 184],
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

// ─────────────────────────────────────────────────────────────────────────────
// Progress Calculations
// Each returns { progress: 0–1, remainingLabel: string, cardState: string }
// cardState: 'active' | 'not-work-time' | 'summer' | 'off-season'
// ─────────────────────────────────────────────────────────────────────────────

function getHourState(now) {
  if (state.workMode && !isCurrentlyWorkTime(now)) {
    const msg = isWorkDay(now) ? 'outside work hours' : 'not a work day';
    return { progress: 0, remainingLabel: msg, cardState: 'not-work-time' };
  }
  const mins = now.getMinutes() + now.getSeconds() / 60;
  const remaining = Math.ceil(60 - mins);
  return { progress: mins / 60, remainingLabel: `${remaining}m remaining`, cardState: 'active' };
}

function getDayState(now) {
  if (state.workMode) {
    if (!isWorkDay(now)) {
      return { progress: 0, remainingLabel: 'not a work day', cardState: 'not-work-time' };
    }
    const mins = now.getHours() * 60 + now.getMinutes();
    if (mins < WORK_START) {
      return { progress: 0, remainingLabel: 'work starts at 08:00', cardState: 'not-work-time' };
    }
    if (mins >= LUNCH_START && mins < LUNCH_END) {
      return { progress: (LUNCH_START - WORK_START) / WORK_MINUTES, remainingLabel: 'lunch break', cardState: 'not-work-time' };
    }
    if (mins >= WORK_END) {
      return { progress: 1, remainingLabel: 'work day done', cardState: 'not-work-time' };
    }
    const elapsed = elapsedWorkMinutesToday(now);
    const remaining = WORK_MINUTES - elapsed;
    return { progress: elapsed / WORK_MINUTES, remainingLabel: fmtMinutes(remaining) + ' remaining', cardState: 'active' };
  }
  const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const remainSecs = 86400 - secs;
  return { progress: secs / 86400, remainingLabel: fmtMinutes(remainSecs / 60) + ' remaining', cardState: 'active' };
}

function getWeekState(now) {
  const dow = (now.getDay() + 6) % 7; // 0=Mon, 6=Sun
  const monday = startOfDay(now);
  monday.setDate(monday.getDate() - dow);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  if (state.workMode) {
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 5); // exclusive end (Sat)
    const totalWork = countWorkDays(monday, friday);
    if (totalWork === 0) {
      return { progress: 0, remainingLabel: 'no work days this week', cardState: 'not-work-time' };
    }
    let elapsed = countWorkDays(monday, startOfDay(now));
    if (isWorkDay(now)) elapsed += elapsedWorkMinutesToday(now) / WORK_MINUTES;
    const progress = Math.min(1, elapsed / totalWork);
    const remaining = Math.ceil(totalWork - elapsed);
    const label = remaining <= 0 ? 'week done' : fmtWorkDays(remaining);
    return { progress, remainingLabel: label, cardState: 'active' };
  }

  const progress = (now - monday) / (nextMonday - monday);
  const remainMs = nextMonday - now;
  const remainDays = Math.ceil(remainMs / 86400000);
  return { progress, remainingLabel: fmtDays(remainDays), cardState: 'active' };
}

function getMonthState(now) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstNextMonth = new Date(year, month + 1, 1);

  if (state.workMode) {
    const totalWork = countWorkDays(firstDay, firstNextMonth);
    if (totalWork === 0) {
      return { progress: 1, remainingLabel: 'no work days this month', cardState: 'not-work-time' };
    }
    let elapsed = countWorkDays(firstDay, startOfDay(now));
    if (isWorkDay(now)) elapsed += elapsedWorkMinutesToday(now) / WORK_MINUTES;
    const progress = Math.min(1, elapsed / totalWork);
    const remaining = Math.ceil(totalWork - elapsed);
    const label = remaining <= 0 ? 'month done' : fmtWorkDays(remaining);
    return { progress, remainingLabel: label, cardState: 'active' };
  }

  const progress = (now - firstDay) / (firstNextMonth - firstDay);
  const remainDays = Math.ceil((firstNextMonth - now) / 86400000);
  return { progress, remainingLabel: fmtDays(remainDays), cardState: 'active' };
}

function getYearState(now) {
  const year = now.getFullYear();
  const firstDay = new Date(year, 0, 1);
  const firstNextYear = new Date(year + 1, 0, 1);

  if (state.workMode) {
    const totalWork = countWorkDays(firstDay, firstNextYear);
    let elapsed = countWorkDays(firstDay, startOfDay(now));
    if (isWorkDay(now)) elapsed += elapsedWorkMinutesToday(now) / WORK_MINUTES;
    const progress = Math.min(1, elapsed / totalWork);
    const remaining = Math.ceil(totalWork - elapsed);
    const label = remaining <= 0 ? 'year done' : fmtWorkDays(remaining);
    return { progress, remainingLabel: label, cardState: 'active' };
  }

  const progress = (now - firstDay) / (firstNextYear - firstDay);
  const remainDays = Math.ceil((firstNextYear - now) / 86400000);
  return { progress, remainingLabel: fmtDays(remainDays), cardState: 'active' };
}

function getSummerState(now) {
  const { midsommar, fallStart } = state;
  if (!midsommar || !fallStart) return { progress: 0, remainingLabel: '…', cardState: 'active' };

  const year = now.getFullYear();
  const janFirst = new Date(year, 0, 1);

  // Currently summer
  if (now >= midsommar && now < fallStart) {
    const backDate = fallStart.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
    return { progress: 1, remainingLabel: `back ${backDate}`, cardState: 'summer' };
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
      return { progress, remainingLabel: label, cardState: 'active' };
    }
    const progress = (now - janFirst) / (midsommar - janFirst);
    const remainDays = Math.ceil((midsommar - now) / 86400000);
    return { progress, remainingLabel: fmtDays(remainDays, '', 'till summer'), cardState: 'active' };
  }

  // After summer (fall/end of year) — point to next year's summer
  const nextYearStart = new Date(year + 1, 0, 1);
  const remainDays = Math.ceil((nextYearStart - now) / 86400000);
  return { progress: 1, remainingLabel: fmtDays(remainDays, '', 'till new year'), cardState: 'off-season' };
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
  constructor(canvas, seed) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.seed = seed;
    this.particles = [];
    this.N = 120;
    this.targetProgress = 0;
    this.currentProgress = 0;
    this.cardState = 'active';

    this._initParticles();

    this._ro = new ResizeObserver(() => this._onResize());
    this._ro.observe(canvas.parentElement);
  }

  _onResize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * devicePixelRatio;
    this.canvas.height = rect.height * devicePixelRatio;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this._initParticles();
  }

  _initParticles() {
    const { N, seed } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.particles = Array.from({ length: N }, (_, i) => ({
      x:     seededRandom(seed * 200 + i * 5    ) * w,
      y:     seededRandom(seed * 200 + i * 5 + 1) * h,
      size:  (1.5 + seededRandom(seed * 200 + i * 5 + 2) * 2.5) * devicePixelRatio,
      phase: seededRandom(seed * 200 + i * 5 + 3) * Math.PI * 2,
      speed: 0.3 + seededRandom(seed * 200 + i * 5 + 4) * 0.5,
      opacity: 0,
    }));
  }

  update(progress, cardState) {
    this.targetProgress = progress;
    this.cardState = cardState;
  }

  draw(ts) {
    const { ctx, canvas, particles, N } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Smoothly interpolate progress
    this.currentProgress += (this.targetProgress - this.currentProgress) * 0.025;

    const activeCount = Math.floor(this.currentProgress * N);
    const color = PARTICLE_COLORS[this.cardState] || PARTICLE_COLORS.active;
    const t = ts * 0.001;

    for (let i = 0; i < N; i++) {
      const p = particles[i];
      const targetOpacity = i < activeCount
        ? 0.35 + seededRandom(this.seed * 200 + i * 5 + 2) * 0.3
        : 0;
      p.opacity += (targetOpacity - p.opacity) * 0.04;
      if (p.opacity < 0.005) continue;

      const dx = Math.sin(t * p.speed + p.phase) * 3 * devicePixelRatio;
      const dy = Math.cos(t * p.speed * 0.7 + p.phase + 1.3) * 2 * devicePixelRatio;

      ctx.beginPath();
      ctx.arc(p.x + dx, p.y + dy, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${p.opacity})`;
      ctx.fill();
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
// DOM & Animation
// ─────────────────────────────────────────────────────────────────────────────

function buildDOM() {
  const container = document.getElementById('cards');
  CARDS.forEach(({ id, label }) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.id = `card-${id}`;

    const canvas = document.createElement('canvas');
    card.appendChild(canvas);

    const content = document.createElement('div');
    content.className = 'card-content';
    content.innerHTML = `
      <span class="card-name">${label}</span>
      <span class="card-remaining"></span>
    `;
    card.appendChild(content);
    container.appendChild(card);
  });
}

function initParticleFields() {
  const fields = {};
  CARDS.forEach(({ id }, i) => {
    const card = document.getElementById(`card-${id}`);
    const canvas = card.querySelector('canvas');
    // Trigger initial resize
    const rect = card.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    fields[id] = new ParticleField(canvas, i + 1);
  });
  return fields;
}

let particleFields = null;

function tick(ts) {
  const now = new Date();
  CARDS.forEach(({ id, label }) => {
    const { progress, remainingLabel, cardState } = getCardState(id, now);
    const card = document.getElementById(`card-${id}`);

    // Update card state class
    card.className = `card state-${cardState}`;

    // Update text
    card.querySelector('.card-remaining').textContent = remainingLabel;

    // Update particles
    particleFields[id].update(progress, cardState);
    particleFields[id].draw(ts);
  });

  requestAnimationFrame(tick);
}

function setupToggles() {
  const workModeEl = document.getElementById('workMode');
  const bridgeDaysEl = document.getElementById('bridgeDays');
  const bridgeDaysLabel = document.getElementById('bridgeDaysLabel');

  workModeEl.addEventListener('change', () => {
    state.workMode = workModeEl.checked;
    bridgeDaysLabel.classList.toggle('visible', state.workMode);
    if (!state.workMode) {
      bridgeDaysEl.checked = false;
      state.includeBridgeDays = false;
    }
  });

  bridgeDaysEl.addEventListener('change', () => {
    state.includeBridgeDays = bridgeDaysEl.checked;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  // Show loading indicator
  const loadingEl = document.createElement('div');
  loadingEl.id = 'loading';
  loadingEl.textContent = 'loading';
  document.body.appendChild(loadingEl);

  buildDOM();
  setupToggles();

  await loadData();

  particleFields = initParticleFields();

  loadingEl.classList.add('hidden');
  setTimeout(() => loadingEl.remove(), 600);

  requestAnimationFrame(tick);
}

init();
