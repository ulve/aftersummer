# Aftersummer — Design Plan

## Concept
A single-page web app showing temporal progress across multiple scales, with an optional work-time mode. Elegant, light, particle-based visuals.

## Visual Design
- Light warm background (#f7f6f2)
- Particle accumulation: dark particles fill each card as time passes
- Elegant sans-serif typography (Inter)
- No raw percentages — contextual labels only ("42m remaining", "3 working days till summer")

## Cards (7 total, stacked to fill viewport)
| Card    | Normal mode                     | Work mode                              |
|---------|---------------------------------|----------------------------------------|
| Hour    | 0–59 min of current hour        | Same — inactive outside work hours     |
| Day     | 00:00–23:59                     | 08:00–12:00 + 13:00–17:00 (8h)        |
| Week    | Mon 00:00 – Sun 23:59           | Mon–Fri, work hours only               |
| Month   | Calendar days                   | Working days in month                  |
| Year    | Calendar days                   | Working days in year                   |
| Summer  | Jan 1 → Midsommarafton progress | Working days — special state in summer |
| Fall    | 1st Mon Aug → Dec 31 progress   | Working days                           |

## Card States
- **active**: dark particles accumulating
- **not-work-time**: muted grey particles, greyed label (outside work hours/days)
- **summer**: warm amber particles at 100% (Midsommarafton → 1st Mon Aug)
- **off-season**: cool grey-blue particles at 0% (fall card before fall starts)

## Work Rules
- Hours: 08:00–12:00 + 13:00–17:00 (8 effective hours, lunch excluded)
- Days: Mon–Fri
- July: entirely off (covered by summer period)
- Holidays: from dagsmart.se API
- Bridge days: optional (separate toggle)

## Summer / Fall Periods
- **Summer**: Midsommarafton (from API) → first Monday of August
- **Pre-summer**: Jan 1 → Midsommarafton
- **Fall**: first Monday of August → Dec 31

## API
- **Base URL**: `https://api.dagsmart.se`
- `GET /holidays?year=YEAR&weekends=false` → `[{ date, code, name: {en, sv} }]`
  - Note: returns holidays that fall on weekends too (e.g. Easter Saturday) — must check weekends separately
  - Midsommarafton code: `midsummerEve`
- `GET /bridge-days?year=YEAR` → `[{ date }]` (no code/name)
- Cached in localStorage per year, refreshed if stale (different year)
- Proxied through local server to avoid CORS

## UI Controls
- **Work time** toggle: switches all cards to work-mode calculations
- **Bridge days** toggle: visible only when work mode is on; treats bridge days as non-work

## Stack
- Vanilla JS (ES modules), no framework, no build step
- Single `public/index.html` + `public/style.css` + `public/app.js`
- Node.js + Express server: serves static files + proxies API calls
- `npm start` to run
