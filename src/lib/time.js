/** Time helpers. All timestamps are epoch milliseconds. */

export const HOUR = 3600000;
export const DAY = 86400000;

/** 1:23:45 — live timer readout */
export function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** h:mm:ss — aggregate readout */
export function fmtHours(ms) {
  return fmtClock(ms);
}

/** h:mm:ss — durations in entry lists */
export function fmtDur(ms) {
  return fmtClock(ms);
}

/** 7h 30m — compact daily readout (home cards, break chips) */
export function fmtHM(ms) {
  const m = Math.floor(Math.max(0, ms) / 60000);
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/* ------- break-aware durations -------
   An entry may carry `breaks: [{ start, end }]` (epoch ms, inside the entry,
   non-overlapping). Worked time is the entry span minus its breaks. */

export const breaksMs = (e) => (e.breaks || []).reduce((s, b) => s + Math.max(0, b.end - b.start), 0);

/** Worked (net) duration of an entry. */
export const entryMs = (e) => e.end - e.start - breaksMs(e);

/** Worked ms of an entry that fall inside [from, to). */
export function workedOverlapMs(e, from, to) {
  let ms = overlapMs(e.start, e.end, from, to);
  for (const b of e.breaks || []) ms -= overlapMs(b.start, b.end, from, to);
  return Math.max(0, ms);
}

export function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function fmtDate(ts, opts = { day: 'numeric', month: 'short' }) {
  return new Date(ts).toLocaleDateString([], opts);
}

export function fmtDateFull(ts) {
  return new Date(ts).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export const startOfDay = (ts) => new Date(ts).setHours(0, 0, 0, 0);
export const endOfDay = (ts) => startOfDay(ts) + DAY;

export function startOfWeek(ts) {
  const d = new Date(startOfDay(ts));
  const day = (d.getDay() + 6) % 7; // Monday = 0
  return d.getTime() - day * DAY;
}

export function startOfMonth(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function startOfYear(ts) {
  return new Date(new Date(ts).getFullYear(), 0, 1).getTime();
}

/** [from, to) range for a stats filter */
export function rangeFor(filter, now = Date.now(), custom = null) {
  switch (filter) {
    case 'today': return [startOfDay(now), endOfDay(now)];
    case 'yesterday': return [startOfDay(now) - DAY, startOfDay(now)];
    case 'last7': return [startOfDay(now) - 6 * DAY, endOfDay(now)];
    case 'last30': return [startOfDay(now) - 29 * DAY, endOfDay(now)];
    case 'last90': return [startOfDay(now) - 89 * DAY, endOfDay(now)];
    case 'prevWeek': return [startOfWeek(now) - 7 * DAY, startOfWeek(now)];
    case 'prevMonth': {
      const d = new Date(startOfMonth(now));
      return [new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), startOfMonth(now)];
    }
    case 'prevYear': {
      const y = new Date(now).getFullYear();
      return [new Date(y - 1, 0, 1).getTime(), new Date(y, 0, 1).getTime()];
    }
    case 'week': return [startOfWeek(now), startOfWeek(now) + 7 * DAY];
    case 'month': {
      const from = startOfMonth(now);
      const d = new Date(from);
      return [from, new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()];
    }
    case 'year': {
      const from = startOfYear(now);
      return [from, new Date(new Date(from).getFullYear() + 1, 0, 1).getTime()];
    }
    case 'custom': {
      if (custom && custom.from && custom.to) return [custom.from, custom.to + DAY];
      return [startOfDay(now), endOfDay(now)];
    }
    default: return [0, now + DAY];
  }
}

/** Milliseconds of an interval that fall inside [from, to) */
export function overlapMs(start, end, from, to) {
  return Math.max(0, Math.min(end, to) - Math.max(start, from));
}

/** Date -> value used for <input type="date"> / "datetime-local" */
export function toDateInput(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function toTimeInput(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** "2026-07-11" + "13:00" -> epoch ms (local time) */
export function fromInputs(dateStr, timeStr) {
  if (!dateStr) return NaN;
  return new Date(`${dateStr}T${timeStr || '00:00'}`).getTime();
}
