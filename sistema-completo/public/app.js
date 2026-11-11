'use strict';
/*
 * Fisio Acompanha — interface do navegador.
 * Consome a API REST de server.py (FastAPI + SQLite). Todo o estado vem de GET /api/state;
 * cada alteração é enviada à API e o estado é recarregado em seguida.
 */

// ---------------------------------------------------------------- utilidades
const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const firstName = name => String(name || '').split(' ')[0];
const initials = name => String(name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
const decimal = n => n === null || n === undefined ? '—' : n.toFixed(1).replace('.', ',');

const TZ = 'America/Sao_Paulo';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const shift = (days, from = today()) => { const d = new Date(from + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const weekday = iso => new Date(iso + 'T12:00:00Z').getUTCDay();
const fmtDate = (iso, options = { day: '2-digit', month: 'short' }) => new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', { ...options, timeZone: 'UTC' }).replace(/\./g, '');
const localDay = isoDateTime => new Date(isoDateTime).toLocaleDateString('en-CA', { timeZone: TZ });
const fmtTime = isoDateTime => new Date(isoDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const daysAgo = iso => Math.round((Date.parse(today()) - Date.parse(iso)) / 86400000);
const relativeDay = iso => { const n = daysAgo(iso); return n === 0 ? 'Hoje' : n === 1 ? 'Ontem' : n < 7 ? `Há ${n} dias` : fmtDate(iso); };
function greeting() {
  const hour = Number(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', hour12: false, timeZone: TZ }));
  return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
}

const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* armazenamento indisponível */ } },
};

// ---------------------------------------------------------------- ícones
const ICONS = {
  home: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  dumbbell: '<path d="M6.5 6.5l11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-6"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  stretch: '<circle cx="12" cy="4" r="2"/><path d="m4 9 8-1 8 1"/><path d="M12 8v6l-3 7M12 14l3 7"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  wind: '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>',
  trendDown: '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
  trendUp: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  stop: '<circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
  sparkle: '<path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z"/><path d="M19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7z"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.activity}</svg>`;

const CATEGORIES = {
  'Mobilidade': { icon: 'activity', tone: 'green' },
  'Alongamento': { icon: 'stretch', tone: 'teal' },
  'Equilíbrio': { icon: 'target', tone: 'amber' },
  'Fortalecimento': { icon: 'dumbbell', tone: 'coral' },
  'Respiração': { icon: 'wind', tone: 'sky' },
};
const category = name => CATEGORIES[name] || { icon: 'activity', tone: 'green' };
const AVATAR_TONES = ['green', 'teal', 'amber', 'coral', 'sky', 'violet'];
const avatarTone = id => AVATAR_TONES[[...String(id)].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_TONES.length];
const avatar = (person, size = '') => `<span class="avatar ${size} tone-${avatarTone(person?.id)}">${esc(initials(person?.name))}</span>`;
const painTone = pain => pain <= 3 ? 'good' : pain <= 6 ? 'warn' : 'bad';
const painLabel = pain => pain === 0 ? 'Sem dor' : pain <= 3 ? 'Leve' : pain <= 6 ? 'Moderada' : 'Intensa';

// ---------------------------------------------------------------- estado
const S = {
  db: null,
  page: 'dashboard',
  selected: '',     // paciente em foco (o próprio, no perfil paciente)
  period: 14,
  search: '',
  category: 'Todas',
  rxFilter: 'active',
  diaryAll: false,
  menu: false,
};
const isPro = () => S.db.currentUser.role === 'professional';
const patientById = id => S.db.patients.find(p => p.id === id);
const exerciseById = id => S.db.exercises.find(e => e.id === id);
const selectedPatient = () => patientById(S.selected);

// ---------------------------------------------------------------- regras de domínio
const scheduledOn = (routine, day) => routine.start <= day && day <= routine.end
  && (routine.frequency === 'Diariamente' || [1, 3, 5].includes(weekday(day)));
const lastLogDate = routine => S.db.logs.reduce((max, l) => l.routine === routine.id && l.date > max ? l.date : max, '');
// Prescrições encerradas contam apenas até o último registro (não sabemos o dia exato do encerramento).
const dueOn = (routine, day) => scheduledOn(routine, day) && (routine.active || day <= lastLogDate(routine));
const routineStatus = r => !r.active ? 'ended' : r.start > today() ? 'scheduled' : r.end < today() ? 'finished' : 'active';
const STATUS_LABEL = { active: 'Ativa', scheduled: 'Agendada', finished: 'Finalizada', ended: 'Encerrada' };

function dueItems(patientId, day = today()) {
  return S.db.routines
    .filter(r => r.patient === patientId && (day === today() ? r.active && scheduledOn(r, day) : dueOn(r, day)))
    .flatMap(r => r.exercises.map(id => ({ routine: r, exercise: exerciseById(id) })))
    .filter(item => item.exercise);
}
const logFor = (routineId, exerciseId, day = today()) => S.db.logs.find(l => l.routine === routineId && l.exercise === exerciseId && l.date === day);
const pendingItems = patientId => dueItems(patientId).filter(x => !logFor(x.routine.id, x.exercise.id));
const logsOf = (patientId, from = '0000-00-00', to = today()) => S.db.logs.filter(l => l.patient === patientId && l.date >= from && l.date <= to);
const avgPain = logs => logs.length ? logs.reduce((sum, l) => sum + l.pain, 0) / logs.length : null;

function adherence(patientId, from, to = today()) {
  let due = 0, done = 0;
  for (let day = from; day <= to; day = shift(1, day)) {
    const items = dueItems(patientId, day);
    due += items.length;
    done += items.filter(x => logFor(x.routine.id, x.exercise.id, day)).length;
  }
  return { due, done, pct: due ? Math.round(done / due * 100) : null };
}
function streak(patientId) {
  let day = today(), count = 0;
  if (!logsOf(patientId, day, day).length) day = shift(-1, day);
  while (logsOf(patientId, day, day).length) { count++; day = shift(-1, day); }
  return count;
}
function dailyPain(patientId, from, to = today()) {
  const byDay = {};
  for (const l of logsOf(patientId, from, to)) (byDay[l.date] ||= []).push(l.pain);
  return Object.keys(byDay).sort().map(date => ({ date, value: byDay[date].reduce((a, b) => a + b, 0) / byDay[date].length }));
}
function attention() {
  const list = [];
  for (const p of S.db.patients) {
    const hasActive = S.db.routines.some(r => r.patient === p.id && routineStatus(r) === 'active');
    const recent = avgPain(logsOf(p.id, shift(-5)));
    const last = S.db.logs.filter(l => l.patient === p.id).reduce((max, l) => l.date > max ? l.date : max, '');
    const silent = hasActive && (!last || daysAgo(last) >= 3);
    const parts = [];
    if (recent !== null && recent >= 6) parts.push(`dor média ${decimal(recent)}/10`);
    if (silent) parts.push(last ? `sem registros há ${daysAgo(last)} dias` : 'ainda não registrou atividades');
    if (parts.length) list.push({ patient: p, tone: recent >= 6 ? 'bad' : 'warn', icon: recent >= 6 ? 'alert' : 'clock', text: capitalize(parts.join(' · ')) });
  }
  return list.sort((a, b) => (a.tone === 'bad' ? 0 : 1) - (b.tone === 'bad' ? 0 : 1));
}

// Mensagens não lidas: marca local por usuário e conversa.
const seenKey = patientId => `fisio-seen-${S.db.currentUser.id}-${patientId}`;
const unread = patientId => S.db.messages.filter(m => m.patient === patientId && m.from !== S.db.currentUser.role && m.at > (store.get(seenKey(patientId)) || '')).length;
const totalUnread = () => S.db.patients.reduce((sum, p) => sum + unread(p.id), 0);
function markSeen(patientId) {
  const last = S.db.messages.filter(m => m.patient === patientId).at(-1);
  if (last) store.set(seenKey(patientId), last.at);
}

// ---------------------------------------------------------------- API
async function api(path, data, method = 'POST') {
  const options = { method: data === undefined ? 'GET' : method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } };
  if (data !== undefined) options.body = JSON.stringify(data);
  let response;
  try { response = await fetch('/api' + path, options); }
  catch { throw new Error('Não foi possível conectar ao servidor. Verifique se a janela do sistema está aberta.'); }
  let result;
  try { result = await response.json(); }
  catch { throw new Error('Resposta inesperada do servidor.'); }
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') { S.db = null; render(); }
    throw new Error(typeof result.detail === 'string' ? result.detail : 'Confira os dados informados.');
  }
  return result;
}
async function loadState() {
  S.db = await api('/state');
  if (!isPro()) S.selected = S.db.currentUser.id;
  else if (!S.db.patients.some(p => p.id === S.selected)) S.selected = S.db.patients[0]?.id || '';
}

// ---------------------------------------------------------------- componentes
function toast(message, tone = 'good') {
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.innerHTML = `${icon(tone === 'bad' ? 'alert' : tone === 'info' ? 'message' : 'check')}<span>${esc(message)}</span>`;
  $('#toasts').append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 4200);
}
const badge = (text, tone = '') => `<span class="badge ${tone}">${esc(text)}</span>`;
const btn = (label, action, { tone = 'primary', iconName = 'arrow', attrs = '', size = '' } = {}) =>
  `<button type="button" class="btn ${tone} ${size}" data-action="${action}" ${attrs}>${iconName ? icon(iconName) : ''}<span>${label}</span></button>`;
const empty = (iconName, title, text = '') => `<div class="empty">${icon(iconName)}<strong>${title}</strong>${text ? `<p>${text}</p>` : ''}</div>`;

function header(eyebrow, title, subtitle, actions = '') {
  return `<header class="page-head"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${subtitle ? `<p class="lead">${subtitle}</p>` : ''}</div>${actions ? `<div class="page-actions">${actions}</div>` : ''}</header>`;
}
function stat({ label, value, note = '', iconName, tone = 'green', trend = '' }) {
  return `<article class="stat"><div class="stat-icon tone-${tone}">${icon(iconName)}</div><div><p class="stat-label">${label}</p><p class="stat-value">${value}${trend}</p>${note ? `<p class="stat-note">${note}</p>` : ''}</div></article>`;
}
function trendChip(current, previous, lowerIsBetter = true) {
  if (current === null || previous === null) return '';
  const diff = current - previous;
  if (Math.abs(diff) < 0.15) return `<span class="trend flat">estável</span>`;
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  return `<span class="trend ${good ? 'good' : 'bad'}">${icon(diff < 0 ? 'trendDown' : 'trendUp')}${decimal(Math.abs(diff))}</span>`;
}
function ring(pct, { size = 132, stroke = 12, label = '', sub = '' } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, value = Math.max(0, Math.min(100, pct ?? 0));
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
    <circle class="ring-value" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - value / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg><div class="ring-label"><strong>${label || (pct === null ? '—' : pct + '%')}</strong>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
}
function sparkline(points, width = 96, height = 30) {
  if (points.length < 2) return `<span class="spark-empty">—</span>`;
  const xy = points.map((p, i) => [i / (points.length - 1) * width, height - 3 - p.value / 10 * (height - 6)]);
  const last = points.at(-1).value;
  return `<svg class="sparkline ${painTone(Math.round(last))}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true"><polyline points="${xy.map(p => p.join(',')).join(' ')}"/><circle cx="${xy.at(-1)[0]}" cy="${xy.at(-1)[1]}" r="2.6"/></svg>`;
}
function progressBar(pct, tone = '') {
  return `<div class="progress ${tone}"><span style="width:${Math.max(0, Math.min(100, pct ?? 0))}%"></span></div>`;
}

let chartId = 0;
function painChart(points, { height = 260 } = {}) {
  if (!points.length) return empty('chart', 'Sem registros no período', 'Os registros de dor aparecerão aqui.');
  const W = 640, H = height, L = 34, R = 18, T = 18, B = 34, id = 'g' + (++chartId);
  const x = i => L + (points.length === 1 ? (W - L - R) / 2 : i / (points.length - 1) * (W - L - R));
  const y = v => T + (1 - v / 10) * (H - T - B);
  const xy = points.map((p, i) => [x(i), y(p.value)]);
  // Curva suave (Catmull-Rom convertida em Bézier), com controles limitados ao gráfico.
  const clampY = v => Math.max(T, Math.min(H - B, v));
  let line = `M${xy[0][0]},${xy[0][1]}`;
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[i - 1] || xy[i], p1 = xy[i], p2 = xy[i + 1], p3 = xy[i + 2] || p2;
    line += ` C${p1[0] + (p2[0] - p0[0]) / 6},${clampY(p1[1] + (p2[1] - p0[1]) / 6)} ${p2[0] - (p3[0] - p1[0]) / 6},${clampY(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]},${p2[1]}`;
  }
  const area = `${line} L${xy.at(-1)[0]},${H - B} L${xy[0][0]},${H - B} Z`;
  const every = Math.ceil(points.length / 8);
  return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Média diária de dor, escala de 0 a 10">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="grad-top"/><stop offset="1" class="grad-bottom"/></linearGradient></defs>
    <rect class="zone bad" x="${L}" y="${y(10)}" width="${W - L - R}" height="${y(7) - y(10)}"/>
    <rect class="zone warn" x="${L}" y="${y(7)}" width="${W - L - R}" height="${y(4) - y(7)}"/>
    ${[0, 2, 4, 6, 8, 10].map(n => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(n)}" y2="${y(n)}"/><text class="axis" x="${L - 10}" y="${y(n) + 4}" text-anchor="end">${n}</text>`).join('')}
    <path class="area" d="${area}" fill="url(#${id})"/>
    <path class="line" d="${line}"/>
    ${points.map((p, i) => { const last = i === points.length - 1; return last || (i % every === 0 && points.length - 1 - i >= every * 0.75) ? `<text class="axis" x="${x(i)}" y="${H - 10}" text-anchor="${last && points.length > 1 ? 'end' : i === 0 && points.length > 1 ? 'start' : 'middle'}">${esc(fmtDate(p.date))}</text>` : ''; }).join('')}
    ${points.map((p, i) => {
      const [px, py] = xy[i], tx = Math.max(L + 44, Math.min(W - R - 44, px)), ty = py < T + 46 ? py + 16 : py - 46;
      return `<g class="pt"><rect class="hit" x="${px - 14}" y="${T}" width="28" height="${H - T - B}"/><line class="guide" x1="${px}" x2="${px}" y1="${T}" y2="${H - B}"/><circle class="dot ${painTone(Math.round(p.value))}" cx="${px}" cy="${py}" r="4.5"/>
        <g class="tip"><rect x="${tx - 44}" y="${ty}" width="88" height="34" rx="9"/><text x="${tx}" y="${ty + 14}" text-anchor="middle" class="tip-date">${esc(fmtDate(p.date))}</text><text x="${tx}" y="${ty + 27}" text-anchor="middle" class="tip-value">Dor ${decimal(p.value)}</text></g></g>`;
    }).join('')}
  </svg></div>`;
}
function adherenceBars(buckets) {
  return `<div class="bars">${buckets.map(b => `<div class="bar-col" title="${esc(b.title)}"><div class="bar-track"><span class="bar ${b.pct === null ? 'none' : b.pct >= 80 ? 'good' : b.pct >= 50 ? 'warn' : 'bad'}" style="height:${b.pct ?? 4}%"></span></div><small>${esc(b.label)}</small></div>`).join('')}</div>`;
}
function adherenceBuckets(patientIds, days) {
  const buckets = [];
  const size = days > 14 ? 7 : 1;
  for (let end = today(); buckets.length < Math.ceil(days / size); end = shift(-size, end)) {
    const start = shift(-(size - 1), end);
    let due = 0, done = 0;
    for (const id of patientIds) { const a = adherence(id, start, end); due += a.due; done += a.done; }
    const pct = due ? Math.round(done / due * 100) : null;
    const label = size > 1 ? fmtDate(start) : end === today() ? 'Hoje' : days > 7 ? end.slice(8) : capitalize(fmtDate(end, { weekday: 'short' }).slice(0, 3));
    buckets.unshift({ pct, label, title: `${size === 1 ? fmtDate(end) : fmtDate(start) + ' a ' + fmtDate(end)}: ${pct === null ? 'sem atividades previstas' : pct + '% concluído'}` });
  }
  return buckets;
}
function patientPicker() {
  if (!isPro()) return '';
  return `<label class="select-wrap">${icon('user')}<select id="patient-select" aria-label="Selecionar paciente">${S.db.patients.map(p => `<option value="${p.id}" ${p.id === S.selected ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>`;
}
function segmented(id, options, current) {
  return `<div class="segmented" role="tablist" id="${id}">${options.map(([value, label]) => `<button type="button" role="tab" aria-selected="${String(value) === String(current)}" data-action="${id}" data-value="${value}">${label}</button>`).join('')}</div>`;
}

// ---------------------------------------------------------------- login
function renderLogin(error = '') {
  $('#app').innerHTML = `<div class="login">
    <section class="login-art">
      <div class="brand light">${brandMark()}<div>fisio acompanha<small>Cuidado em movimento</small></div></div>
      <div class="login-copy">
        <p class="eyebrow">Entre cada consulta</p>
        <h1>O cuidado continua<br><em>fora da clínica.</em></h1>
        <p>Rotinas de exercícios, registros de dor e conversa com o fisioterapeuta em um só lugar — para que nenhuma evolução se perca entre uma sessão e outra.</p>
      </div>
      <div class="float-cards" aria-hidden="true">
        <div class="float-card one"><span class="fc-icon">${icon('check')}</span><div><strong>Mobilidade de ombros</strong><small>Registrado · dor 2/10</small></div></div>
        <div class="float-card two">${ring(86, { size: 64, stroke: 7 })}<div><strong>Adesão semanal</strong><small>6 de 7 dias</small></div></div>
        <div class="float-card three"><span class="fc-icon">${icon('trendDown')}</span><div><strong>Dor em queda</strong><small>−3,2 pontos em 4 semanas</small></div></div>
      </div>
      <small class="login-foot">UDF · Análise e Desenvolvimento de Sistemas · ODS 3 · 2026.2</small>
    </section>
    <section class="login-panel">
      <div class="login-box">
        <p class="eyebrow">Bem-vindo de volta</p>
        <h2>Acesse sua conta</h2>
        <p class="lead">Use o e-mail e a senha cadastrados.</p>
        <form id="login-form" novalidate>
          <label class="field"><span>E-mail</span><input name="email" type="email" required autocomplete="username" placeholder="seu@email.com"></label>
          <label class="field"><span>Senha</span><input name="password" type="password" required autocomplete="current-password" placeholder="••••••••"></label>
          <p id="login-error" class="form-error" role="alert">${esc(error)}</p>
          <button class="btn primary block" type="submit"><span>Entrar</span>${icon('arrow')}</button>
        </form>
        <div class="divider"><span>Acesso rápido para demonstração</span></div>
        <div class="quick">
          <button type="button" class="quick-btn" data-action="quick-login" data-email="camila@example.com"><span class="avatar tone-green">CO</span><span><strong>Camila Oliveira</strong><small>Fisioterapeuta</small></span>${icon('arrow')}</button>
          <button type="button" class="quick-btn" data-action="quick-login" data-email="mariana@example.com"><span class="avatar tone-coral">MC</span><span><strong>Mariana Costa</strong><small>Paciente</small></span>${icon('arrow')}</button>
        </div>
        <p class="hint">${icon('key')}<span>Todas as contas de exemplo usam a senha <strong>demo123</strong>. Use apenas dados fictícios.</span></p>
      </div>
    </section>
  </div>`;
}
const brandMark = () => `<span class="brand-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12.5h4l2-6 4 12 2.5-6H21"/></svg></span>`;

// ---------------------------------------------------------------- estrutura
const PAGES = {
  professional: [['dashboard', 'home', 'Visão geral'], ['patients', 'users', 'Pacientes'], ['exercises', 'dumbbell', 'Exercícios'], ['routines', 'clipboard', 'Prescrições'], ['evolution', 'chart', 'Evolução'], ['messages', 'message', 'Mensagens']],
  patient: [['dashboard', 'home', 'Meu acompanhamento'], ['routines', 'clipboard', 'Minha rotina'], ['evolution', 'chart', 'Meu histórico'], ['messages', 'message', 'Mensagens']],
};
const pageList = () => [...PAGES[S.db.currentUser.role], ['about', 'info', 'Sobre o projeto']];

function shell() {
  const user = S.db.currentUser, pro = isPro();
  const pageHtml = content(); // antes das contagens: abrir a conversa marca mensagens como lidas
  const unreadCount = totalUnread();
  const alerts = pro ? attention().length : pendingItems(S.selected).length;
  const current = pageList().find(p => p[0] === S.page) || pageList()[0];
  const navItem = ([id, iconName, label]) => `<a href="#/${id}" class="nav-item ${S.page === id ? 'active' : ''}" ${S.page === id ? 'aria-current="page"' : ''}>${icon(iconName)}<span>${label}</span>${id === 'messages' && unreadCount ? `<b class="count">${unreadCount}</b>` : ''}${id === 'routines' && !pro && alerts ? `<b class="count soft">${alerts}</b>` : ''}</a>`;
  const theme = document.documentElement.dataset.theme;
  $('#app').innerHTML = `<div class="layout ${S.menu ? 'menu-open' : ''}">
    <aside class="sidebar">
      <div class="brand">${brandMark()}<div>fisio acompanha<small>Cuidado em movimento</small></div></div>
      <p class="nav-label">${pro ? 'Clínica' : 'Seu cuidado'}</p>
      <nav class="nav" aria-label="Navegação principal">${PAGES[user.role].map(navItem).join('')}</nav>
      <p class="nav-label">Projeto</p>
      <nav class="nav">${navItem(['about', 'info', 'Sobre o projeto'])}</nav>
      <div class="side-card">
        <span class="side-card-icon">${icon('heart')}</span>
        <strong>Pequenos passos, cuidado contínuo.</strong>
        <small>ODS 3 · Saúde e bem-estar</small>
      </div>
      <div class="profile">
        ${avatar({ id: user.id, name: user.name })}
        <div><strong>${esc(user.name)}</strong><small>${pro ? 'Fisioterapeuta' : 'Paciente'}</small></div>
        <button class="icon-btn ghost" data-action="logout" aria-label="Sair da conta" title="Sair da conta">${icon('logout')}</button>
      </div>
    </aside>
    <div class="scrim" data-action="menu"></div>
    <div class="workspace">
      <header class="topbar">
        <button class="icon-btn menu-toggle" data-action="menu" aria-label="Abrir menu">${icon('menu')}</button>
        <div class="crumb"><span>${pro ? 'Clínica' : 'Meu cuidado'}</span>${icon('arrow')}<strong>${current[2]}</strong></div>
        <div class="top-actions">
          <span class="live" title="Os dados são atualizados automaticamente"><i></i>Sincronizado</span>
          <button class="icon-btn" data-action="theme" aria-label="Alternar tema claro/escuro" title="Alternar tema">${icon(theme === 'dark' ? 'sun' : 'moon')}</button>
          <button class="icon-btn" data-action="reminders" aria-label="${pro ? 'Alertas' : 'Lembretes'}" title="${pro ? 'Alertas' : 'Lembretes'}">${icon('bell')}${alerts ? `<span class="dot">${alerts}</span>` : ''}</button>
        </div>
      </header>
      <main id="main" tabindex="-1"><div class="page">${pageHtml}</div>
        <footer class="footer"><span>Fisio Acompanha · Projeto acadêmico UDF · ADS 2026.2</span><span>${icon('database')} Dados persistidos em SQLite</span></footer>
      </main>
    </div>
  </div>`;
}
function content() {
  const pages = { dashboard, patients, exercises, routines, evolution, messages, about };
  return (pages[S.page] || dashboard)();
}

// ---------------------------------------------------------------- páginas: visão geral
function dashboard() { return isPro() ? dashboardPro() : dashboardPatient(); }

function dashboardPro() {
  const user = S.db.currentUser, pts = S.db.patients;
  const due = pts.flatMap(p => dueItems(p.id)), pend = pts.flatMap(p => pendingItems(p.id));
  const rate = due.length ? Math.round((due.length - pend.length) / due.length * 100) : null;
  const allLogs = S.db.logs;
  const last7 = avgPain(allLogs.filter(l => l.date >= shift(-6))), prev7 = avgPain(allLogs.filter(l => l.date >= shift(-13) && l.date < shift(-6)));
  const activePts = pts.filter(p => S.db.routines.some(r => r.patient === p.id && routineStatus(r) === 'active')).length;
  const todayLogs = allLogs.filter(l => l.date === today()).length;
  const week = adherence7(pts.map(p => p.id));
  const alerts = attention();
  const recent = allLogs.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  return `${header(fmtDate(today(), { weekday: 'long', day: 'numeric', month: 'long' }), `${greeting()}, ${esc(firstName(user.name))}.`, 'Este é o panorama do cuidado dos seus pacientes hoje.',
    btn('Nova prescrição', 'routine-new', { tone: 'ghost', iconName: 'clipboard' }) + btn('Novo paciente', 'patient-new', { iconName: 'plus' }))}
  <section class="hero-grid">
    <article class="hero">
      <div class="hero-text">
        <p class="eyebrow">Conclusão de hoje</p>
        <h2>${rate === null ? 'Nenhuma atividade prevista hoje.' : `${due.length - pend.length} de ${plural(due.length, 'exercício', 'exercícios')} previstos já foram registrados.`}</h2>
        <p>${pend.length ? `Ainda ${pend.length === 1 ? 'falta 1 atividade' : `faltam ${pend.length} atividades`} entre seus pacientes.` : 'Todos os pacientes estão em dia.'}</p>
        <a class="btn lime" href="#/evolution">${icon('chart')}<span>Acompanhar evolução</span></a>
      </div>
      ${ring(rate, { size: 150, stroke: 13, sub: 'concluído' })}
    </article>
    <article class="card">
      <div class="card-head"><div><h3>Adesão da semana</h3><p>Exercícios realizados ÷ previstos</p></div>${badge(week.pct === null ? '—' : week.pct + '%', week.pct >= 80 ? 'good' : 'warn')}</div>
      ${adherenceBars(adherenceBuckets(pts.map(p => p.id), 7))}
    </article>
  </section>
  <section class="stats">
    ${stat({ label: 'Pacientes ativos', value: activePts, note: `${plural(pts.length, 'vinculado', 'vinculados')} a você`, iconName: 'users', tone: 'green' })}
    ${stat({ label: 'Registros hoje', value: todayLogs, note: 'Atividades informadas', iconName: 'check', tone: 'teal' })}
    ${stat({ label: 'Dor média · 7 dias', value: decimal(last7), trend: trendChip(last7, prev7), note: 'Comparado à semana anterior', iconName: 'activity', tone: 'coral' })}
    ${stat({ label: 'Mensagens não lidas', value: totalUnread(), note: 'Conversas com pacientes', iconName: 'message', tone: 'sky' })}
  </section>
  <section class="grid-2-1">
    <article class="card flush">
      <div class="card-head pad"><div><h3>Seus pacientes</h3><p>Progresso de hoje e tendência de dor (14 dias)</p></div><a class="text-btn" href="#/patients">Ver todos ${icon('arrow')}</a></div>
      <div class="patient-rows">${pts.map(patientRow).join('') || empty('users', 'Nenhum paciente cadastrado', 'Cadastre o primeiro paciente para começar.')}</div>
    </article>
    <div class="stack">
      <article class="card">
        <div class="card-head"><div><h3>Precisa de atenção</h3><p>Dor elevada ou ausência de registros</p></div>${alerts.length ? badge(String(alerts.length), 'bad') : ''}</div>
        <div class="alerts">${alerts.map(a => `<button class="alert-item ${a.tone}" data-action="patient-view" data-id="${a.patient.id}">${avatar(a.patient, 'sm')}<span><strong>${esc(a.patient.name)}</strong><small>${icon(a.icon)}${esc(a.text)}</small></span>${icon('arrow')}</button>`).join('') || empty('shield', 'Tudo tranquilo', 'Nenhum paciente com alerta no momento.')}</div>
      </article>
      <article class="card">
        <div class="card-head"><div><h3>Atividade recente</h3><p>Últimos registros dos pacientes</p></div></div>
        <ol class="timeline">${recent.map(l => { const p = patientById(l.patient); return `<li><span class="tl-dot ${painTone(l.pain)}"></span><div><p><strong>${esc(firstName(p?.name))}</strong> concluiu <strong>${esc(exerciseById(l.exercise)?.name || 'exercício')}</strong></p><small>${relativeDay(l.date)} · dor ${l.pain}/10${l.comment ? ` · “${esc(l.comment)}”` : ''}</small></div></li>`; }).join('') || '<li class="muted">Nenhum registro ainda.</li>'}</ol>
      </article>
    </div>
  </section>`;
}
function adherence7(ids) {
  let due = 0, done = 0;
  for (const id of ids) { const a = adherence(id, shift(-6)); due += a.due; done += a.done; }
  return { pct: due ? Math.round(done / due * 100) : null };
}
function patientRow(p) {
  const due = dueItems(p.id), pend = pendingItems(p.id);
  const pct = due.length ? Math.round((due.length - pend.length) / due.length * 100) : null;
  const lastLog = S.db.logs.filter(l => l.patient === p.id).at(-1);
  return `<button class="patient-row" data-action="patient-view" data-id="${p.id}">
    ${avatar(p)}
    <span class="pr-main"><strong>${esc(p.name)}</strong><small>${esc(p.goal)}</small></span>
    <span class="pr-progress">${pct === null ? '<small class="muted">Sem atividades hoje</small>' : `${progressBar(pct, pct === 100 ? 'good' : '')}<small>${due.length - pend.length}/${due.length} hoje</small>`}</span>
    <span class="pr-spark">${sparkline(dailyPain(p.id, shift(-13)))}</span>
    <span class="pr-pain">${lastLog ? badge(`Dor ${lastLog.pain}`, painTone(lastLog.pain)) : badge('Sem registros', 'muted')}</span>
    ${icon('arrow', 'chev')}
  </button>`;
}

function dashboardPatient() {
  const p = selectedPatient(), due = dueItems(p.id), pend = pendingItems(p.id);
  const done = due.length - pend.length, pct = due.length ? Math.round(done / due.length * 100) : null;
  const days = streak(p.id);
  const a7 = avgPain(logsOf(p.id, shift(-6))), prev = avgPain(logsOf(p.id, shift(-13), shift(-7)));
  const adh = adherence(p.id, shift(-13));
  const lastMsg = S.db.messages.filter(m => m.patient === p.id && m.from === 'professional').at(-1);
  return `${header(fmtDate(today(), { weekday: 'long', day: 'numeric', month: 'long' }), `${greeting()}, ${esc(firstName(p.name))}.`, 'Cada registro ajuda seu fisioterapeuta a acompanhar sua evolução.')}
  <section class="hero-grid">
    <article class="hero">
      <div class="hero-text">
        <p class="eyebrow">Sua rotina de hoje</p>
        <h2>${due.length ? (pend.length ? `Você concluiu ${done} de ${plural(due.length, 'exercício', 'exercícios')}.` : 'Rotina de hoje concluída. Parabéns!') : 'Nenhum exercício previsto para hoje.'}</h2>
        <p>${pend.length ? `Próximo: <strong>${esc(pend[0].exercise.name)}</strong> · ${pend[0].exercise.duration} min` : 'Descanse e volte amanhã para continuar.'}</p>
        <div class="hero-chips"><span>${icon('flame')} ${plural(days, 'dia', 'dias')} seguidos</span><span>${icon('target')} ${p.goal ? esc(p.goal) : 'Seu objetivo'}</span></div>
        ${pend.length ? `<a class="btn lime" href="#/routines">${icon('clipboard')}<span>Ir para minha rotina</span></a>` : ''}
      </div>
      ${ring(pct, { size: 150, stroke: 13, label: due.length ? `${done}/${due.length}` : '—', sub: 'exercícios' })}
    </article>
    <article class="card message-card">
      <div class="card-head"><div><h3>Seu fisioterapeuta</h3><p>${esc(S.db.currentUser.professionalName)}</p></div>${avatar({ id: 'professional1', name: S.db.currentUser.professionalName }, 'sm')}</div>
      ${lastMsg ? `<blockquote>“${esc(lastMsg.text)}”<small>${relativeDay(localDay(lastMsg.at))} · ${fmtTime(lastMsg.at)}</small></blockquote>` : '<p class="muted">Nenhuma mensagem ainda.</p>'}
      <a class="btn ghost block" href="#/messages">${icon('message')}<span>Abrir conversa</span>${unread(p.id) ? `<b class="count">${unread(p.id)}</b>` : ''}</a>
    </article>
  </section>
  <section class="stats">
    ${stat({ label: 'Sequência', value: plural(days, 'dia', 'dias'), note: 'Com pelo menos um registro', iconName: 'flame', tone: 'coral' })}
    ${stat({ label: 'Pendentes hoje', value: pend.length, note: `de ${plural(due.length, 'exercício previsto', 'exercícios previstos')}`, iconName: 'clock', tone: 'amber' })}
    ${stat({ label: 'Dor média · 7 dias', value: decimal(a7), trend: trendChip(a7, prev), note: 'Comparado à semana anterior', iconName: 'activity', tone: 'teal' })}
    ${stat({ label: 'Adesão · 14 dias', value: adh.pct === null ? '—' : adh.pct + '%', note: `${adh.done} de ${adh.due} realizados`, iconName: 'check', tone: 'green' })}
  </section>
  <section class="grid-2-1">
    <article class="card flush">
      <div class="card-head pad"><div><h3>Exercícios de hoje</h3><p>Um de cada vez, no seu ritmo</p></div><a class="text-btn" href="#/routines">Minha rotina ${icon('arrow')}</a></div>
      ${routineItems(due)}
    </article>
    <article class="card">
      <div class="card-head"><div><h3>Sua dor · 14 dias</h3><p>Média diária informada por você</p></div></div>
      ${painChart(dailyPain(p.id, shift(-13)), { height: 230 })}
    </article>
  </section>`;
}
function routineItems(items) {
  if (!items.length) return empty('calendar', 'Nenhum exercício previsto para hoje', 'Consulte suas prescrições ou converse com seu fisioterapeuta.');
  return `<div class="routine-list">${items.map(({ routine: r, exercise: e }) => {
    const log = logFor(r.id, e.id), cat = category(e.category);
    return `<article class="routine-item ${log ? 'done' : ''}">
      <span class="ri-icon tone-${cat.tone}">${icon(log ? 'check' : cat.icon)}</span>
      <div class="ri-body"><h4>${esc(e.name)}</h4><p>${esc(e.instructions)}</p><small>${icon('clock')} ${e.duration} min · ${esc(e.category)} · ${esc(r.frequency)}</small></div>
      ${log ? `<span class="ri-done">${badge('Feito · dor ' + log.pain, painTone(log.pain))}</span>` : isPro() ? badge('Pendente', 'warn') : btn('Registrar', 'log-new', { size: 'sm', iconName: 'check', attrs: `data-routine="${r.id}" data-id="${e.id}"` })}
    </article>`;
  }).join('')}</div>`;
}

// ---------------------------------------------------------------- páginas: pacientes
function patients() {
  return `${header('Pessoas no centro', 'Pacientes', 'Vínculos, objetivos e o andamento de cada acompanhamento.', btn('Novo paciente', 'patient-new', { iconName: 'plus' }))}
  <div class="toolbar"><label class="search">${icon('search')}<input id="search" type="search" placeholder="Buscar por nome, e-mail ou objetivo" aria-label="Buscar pacientes" value="${esc(S.search)}"></label><span class="muted" id="patient-count"></span></div>
  <section class="patient-grid" id="patient-results">${patientCards()}</section>`;
}
function patientCards() {
  const q = S.search.toLocaleLowerCase('pt-BR');
  const list = S.db.patients.filter(p => `${p.name} ${p.email} ${p.goal}`.toLocaleLowerCase('pt-BR').includes(q));
  if (!list.length) return empty('search', 'Nenhum paciente encontrado', 'Tente outro termo de busca.');
  return list.map(p => {
    const adh = adherence(p.id, shift(-6)), pain = avgPain(logsOf(p.id, shift(-6)));
    const active = S.db.routines.filter(r => r.patient === p.id && routineStatus(r) === 'active').length;
    return `<article class="patient-card">
      <div class="pc-top">${avatar(p, 'lg')}<div><h3>${esc(p.name)}</h3><p>${esc(p.email)}</p></div></div>
      <p class="pc-goal">${icon('target')} ${esc(p.goal)}</p>
      <dl class="pc-stats">
        <div><dt>Adesão 7d</dt><dd>${adh.pct === null ? '—' : adh.pct + '%'}</dd></div>
        <div><dt>Dor média 7d</dt><dd class="${pain === null ? '' : 'pain-' + painTone(Math.round(pain))}">${decimal(pain)}</dd></div>
        <div><dt>Prescrições</dt><dd>${active} ${active === 1 ? 'ativa' : 'ativas'}</dd></div>
      </dl>
      <p class="pc-since">${icon('calendar')} Em acompanhamento desde ${fmtDate(p.since, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
      <div class="pc-actions">
        ${btn('Evolução', 'patient-view', { size: 'sm', iconName: 'chart', attrs: `data-id="${p.id}"` })}
        <button class="icon-btn" data-action="routine-new" data-id="${p.id}" aria-label="Nova prescrição para ${esc(p.name)}" title="Nova prescrição">${icon('clipboard')}</button>
        <button class="icon-btn" data-action="patient-message" data-id="${p.id}" aria-label="Mensagem para ${esc(p.name)}" title="Mensagem">${icon('message')}${unread(p.id) ? `<span class="dot">${unread(p.id)}</span>` : ''}</button>
        <button class="icon-btn" data-action="patient-edit" data-id="${p.id}" aria-label="Editar ${esc(p.name)}" title="Editar">${icon('edit')}</button>
      </div>
    </article>`;
  }).join('');
}

// ---------------------------------------------------------------- páginas: exercícios
function exercises() {
  const cats = ['Todas', ...new Set([...Object.keys(CATEGORIES), ...S.db.exercises.map(e => e.category)])];
  const list = S.db.exercises.filter(e => S.category === 'Todas' || e.category === S.category);
  return `${header('Biblioteca de cuidado', 'Catálogo de exercícios', 'Instruções organizadas para compor as prescrições.', btn('Novo exercício', 'exercise-new', { iconName: 'plus' }))}
  <div class="chips">${cats.map(c => `<button type="button" class="chip ${S.category === c ? 'active' : ''}" data-action="category" data-value="${esc(c)}">${c === 'Todas' ? '' : icon(category(c).icon)}${esc(c)}<b>${c === 'Todas' ? S.db.exercises.length : S.db.exercises.filter(e => e.category === c).length}</b></button>`).join('')}</div>
  <section class="exercise-grid">${list.map(e => {
    const cat = category(e.category);
    const uses = S.db.routines.filter(r => r.active && r.exercises.includes(e.id)).length;
    return `<article class="exercise-card tone-${cat.tone}">
      <div class="ex-visual"><span class="ex-icon">${icon(cat.icon)}</span><span class="ex-duration">${icon('clock')} ${e.duration} min</span></div>
      <div class="ex-body">
        <p class="ex-cat">${esc(e.category)}</p>
        <h3>${esc(e.name)}</h3>
        <p class="ex-text">${esc(e.instructions)}</p>
        ${e.notes ? `<p class="ex-note">${icon('info')} ${esc(e.notes)}</p>` : ''}
        <div class="ex-foot"><small>${uses ? `Em ${plural(uses, 'prescrição ativa', 'prescrições ativas')}` : 'Sem prescrições ativas'}</small>${btn('Editar', 'exercise-edit', { size: 'sm', tone: 'ghost', iconName: 'edit', attrs: `data-id="${e.id}"` })}</div>
      </div>
    </article>`;
  }).join('') || empty('dumbbell', 'Nenhum exercício nesta categoria')}</section>
  <p class="disclaimer">${icon('info')} Conteúdo ilustrativo para fins acadêmicos. A orientação e a prescrição são sempre realizadas pelo profissional.</p>`;
}

// ---------------------------------------------------------------- páginas: prescrições / rotina
function routines() {
  if (!isPro()) {
    const p = selectedPatient(), due = dueItems(p.id), pend = pendingItems(p.id);
    const mine = S.db.routines.filter(r => r.patient === p.id).sort((a, b) => b.start.localeCompare(a.start));
    return `${header('Um passo de cada vez', 'Minha rotina', 'Siga as orientações e registre cada atividade realizada.')}
    <section class="card flush">
      <div class="card-head pad"><div><h3>Hoje · ${fmtDate(today(), { weekday: 'long', day: 'numeric', month: 'long' })}</h3><p>${due.length ? `${due.length - pend.length} de ${due.length} concluídos` : 'Sem exercícios previstos'}</p></div>${due.length ? progressBar(Math.round((due.length - pend.length) / due.length * 100), pend.length ? '' : 'good') : ''}</div>
      ${routineItems(due)}
    </section>
    <h2 class="section-title">Minhas prescrições</h2>
    <section class="rx-list">${mine.map(prescriptionCard).join('') || empty('clipboard', 'Nenhuma prescrição')}</section>`;
  }
  const all = S.db.routines.slice().sort((a, b) => b.start.localeCompare(a.start));
  const groups = { active: all.filter(r => routineStatus(r) === 'active'), scheduled: all.filter(r => routineStatus(r) === 'scheduled'), closed: all.filter(r => ['ended', 'finished'].includes(routineStatus(r))), all };
  const list = groups[S.rxFilter] || groups.active;
  return `${header('Planejamento do cuidado', 'Prescrições', 'Exercícios, frequência e período de cada acompanhamento.', btn('Nova prescrição', 'routine-new', { iconName: 'plus' }))}
  <div class="toolbar">${segmented('rx-filter', [['active', `Ativas · ${groups.active.length}`], ['scheduled', `Agendadas · ${groups.scheduled.length}`], ['closed', `Encerradas · ${groups.closed.length}`], ['all', `Todas · ${all.length}`]], S.rxFilter)}</div>
  <section class="rx-list">${list.map(prescriptionCard).join('') || empty('clipboard', 'Nenhuma prescrição neste filtro')}</section>`;
}
function prescriptionCard(r) {
  const p = patientById(r.patient), status = routineStatus(r);
  const total = Math.max(1, Math.round((Date.parse(r.end) - Date.parse(r.start)) / 86400000));
  const elapsed = Math.max(0, Math.min(total, Math.round((Date.parse(today()) - Date.parse(r.start)) / 86400000)));
  const left = Math.round((Date.parse(r.end) - Date.parse(today())) / 86400000);
  const startsIn = Math.round((Date.parse(r.start) - Date.parse(today())) / 86400000);
  const adh = status === 'active' ? adherence(r.patient, r.start).pct : null;
  return `<article class="rx-card ${status}">
    <div class="rx-head">
      ${isPro() ? `${avatar(p)}<div><h3>${esc(p?.name)}</h3><p>${esc(r.frequency)}</p></div>` : `<span class="ri-icon tone-green">${icon('clipboard')}</span><div><h3>${esc(r.frequency)}</h3><p>Prescrita por ${esc(S.db.currentUser.professionalName)}</p></div>`}
      ${badge(STATUS_LABEL[status], { active: 'good', scheduled: 'info', finished: 'muted', ended: 'muted' }[status])}
    </div>
    <div class="rx-period">
      <div class="rx-dates"><span>${icon('calendar')} ${fmtDate(r.start)} → ${fmtDate(r.end, { day: '2-digit', month: 'short', year: 'numeric' })}</span><span>${status === 'active' ? `${left === 0 ? 'Termina hoje' : `${plural(left, 'dia restante', 'dias restantes')}`}` : status === 'scheduled' ? `Começa em ${plural(startsIn, 'dia', 'dias')}` : ''}</span></div>
      ${progressBar(status === 'ended' ? 100 : elapsed / total * 100, status === 'active' ? '' : 'muted')}
    </div>
    <div class="pill-list">${r.exercises.map(id => { const e = exerciseById(id); return e ? `<span class="pill tone-${category(e.category).tone}">${icon(category(e.category).icon)}${esc(e.name)}</span>` : ''; }).join('')}</div>
    ${r.notes ? `<p class="rx-notes">${esc(r.notes)}</p>` : ''}
    ${(isPro() && r.active) || adh !== null ? `<div class="rx-foot">${adh !== null ? `<small>Adesão desde o início: <strong>${adh}%</strong></small>` : '<span></span>'}${isPro() && r.active ? btn('Encerrar', 'routine-end', { size: 'sm', tone: 'danger-ghost', iconName: 'stop', attrs: `data-id="${r.id}"` }) : ''}</div>` : ''}
  </article>`;
}

// ---------------------------------------------------------------- páginas: evolução
function evolution() {
  const p = selectedPatient();
  if (!p) return `${header('Cada registro conta', 'Evolução', '')}${empty('users', 'Nenhum paciente cadastrado')}`;
  const from = shift(-(S.period - 1)), logs = logsOf(p.id, from);
  const prevLogs = logsOf(p.id, shift(-(2 * S.period - 1)), shift(-S.period));
  const avg = avgPain(logs), prev = avgPain(prevLogs), adh = adherence(p.id, from);
  const activeDays = new Set(logs.map(l => l.date)).size;
  const byDay = {};
  for (const l of logs.slice().reverse()) (byDay[l.date] ||= []).push(l);
  const dayEntries = Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0]));
  return `${header('Cada registro conta', isPro() ? 'Evolução do paciente' : 'Meu histórico', 'Registros informados pelo paciente para apoiar a avaliação profissional.',
    isPro() ? btn('Mensagem', 'patient-message', { tone: 'ghost', iconName: 'message', attrs: `data-id="${p.id}"` }) + btn('Editar', 'patient-edit', { tone: 'ghost', iconName: 'edit', attrs: `data-id="${p.id}"` }) + btn('Prescrever', 'routine-new', { iconName: 'plus', attrs: `data-id="${p.id}"` }) : '')}
  <div class="toolbar">${patientPicker()}${segmented('period', [[7, '7 dias'], [14, '14 dias'], [30, '30 dias'], [90, '90 dias']], S.period)}</div>
  <section class="profile-strip card">
    ${avatar(p, 'lg')}
    <div><h2>${esc(p.name)}</h2><p>${icon('target')} ${esc(p.goal)}</p></div>
    <div class="ps-meta"><span>${icon('calendar')} Desde ${fmtDate(p.since, { day: '2-digit', month: 'short', year: 'numeric' })}</span><span>${icon('flame')} ${plural(streak(p.id), 'dia', 'dias')} seguidos</span></div>
  </section>
  <section class="stats">
    ${stat({ label: 'Atividades registradas', value: logs.length, note: `Nos últimos ${S.period} dias`, iconName: 'check', tone: 'green' })}
    ${stat({ label: 'Dor média', value: decimal(avg), trend: trendChip(avg, prev), note: `vs. ${S.period} dias anteriores`, iconName: 'activity', tone: 'coral' })}
    ${stat({ label: 'Adesão', value: adh.pct === null ? '—' : adh.pct + '%', note: `${adh.done} de ${adh.due} previstos`, iconName: 'target', tone: 'teal' })}
    ${stat({ label: 'Dias com registro', value: activeDays, note: `de ${S.period} dias`, iconName: 'calendar', tone: 'sky' })}
  </section>
  <section class="grid-2-1">
    <article class="card">
      <div class="card-head"><div><h3>Dor ao longo do tempo</h3><p>Média diária · escala de 0 (sem dor) a 10 (dor máxima)</p></div><div class="legend"><span class="good">Leve</span><span class="warn">Moderada</span><span class="bad">Intensa</span></div></div>
      ${painChart(dailyPain(p.id, from))}
    </article>
    <article class="card">
      <div class="card-head"><div><h3>Adesão</h3><p>${S.period > 14 ? 'Por semana' : 'Por dia'} · realizados ÷ previstos</p></div></div>
      ${adherenceBars(adherenceBuckets([p.id], S.period))}
    </article>
  </section>
  <section class="card flush">
    <div class="card-head pad"><div><h3>Diário de atividades</h3><p>${plural(logs.length, 'registro', 'registros')} no período</p></div></div>
    <div class="diary">${dayEntries.slice(0, S.diaryAll ? undefined : 5).map(([day, items]) => `
      <div class="diary-day"><p class="diary-date"><strong>${relativeDay(day)}</strong><small>${capitalize(fmtDate(day, { weekday: 'long' }))}, ${fmtDate(day)}</small></p>
      <div class="diary-items">${items.map(l => { const e = exerciseById(l.exercise); return `<div class="diary-item"><span class="ri-icon sm tone-${category(e?.category).tone}">${icon(category(e?.category).icon)}</span><div><strong>${esc(e?.name || 'Exercício')}</strong>${l.comment ? `<p>“${esc(l.comment)}”</p>` : ''}</div>${badge(`Dor ${l.pain} · ${painLabel(l.pain)}`, painTone(l.pain))}</div>`; }).join('')}</div></div>`).join('') || empty('calendar', 'Nenhum registro neste período')}</div>
    ${dayEntries.length > 5 ? `<div class="diary-more"><button type="button" class="btn ghost sm" data-action="diary-toggle">${S.diaryAll ? 'Mostrar menos' : `Ver todos os ${dayEntries.length} dias`}</button></div>` : ''}
  </section>`;
}

// ---------------------------------------------------------------- páginas: mensagens
function messages() {
  const pro = isPro(), p = selectedPatient();
  if (p) markSeen(p.id);
  const convs = pro ? S.db.patients.slice().sort((a, b) => (lastMessage(b.id)?.at || '').localeCompare(lastMessage(a.id)?.at || '')) : [p];
  const msgs = S.db.messages.filter(m => m.patient === p?.id);
  let lastDay = '';
  const bubbles = msgs.map(m => {
    const day = localDay(m.at), sep = day !== lastDay ? `<div class="day-sep"><span>${relativeDay(day)}</span></div>` : '';
    lastDay = day;
    const own = m.from === S.db.currentUser.role;
    return `${sep}<div class="bubble ${own ? 'own' : ''}"><p>${esc(m.text)}</p><small>${fmtTime(m.at)}${own ? ' ' + icon('check') : ''}</small></div>`;
  }).join('');
  const otherName = pro ? p?.name : S.db.currentUser.professionalName;
  return `${header('Cuidado também é conversa', 'Mensagens', 'Canal direto entre paciente e fisioterapeuta. As novas mensagens aparecem automaticamente.')}
  <section class="chat-layout card flush">
    ${pro ? `<aside class="conv-list">${convs.map(c => { const last = lastMessage(c.id), n = c.id === p?.id ? 0 : unread(c.id); return `<button class="conv ${c.id === p?.id ? 'active' : ''}" data-action="conversation" data-id="${c.id}">${avatar(c)}<span class="conv-main"><strong>${esc(c.name)}</strong><small>${last ? (last.from === 'professional' ? 'Você: ' : '') + esc(last.text) : 'Sem mensagens'}</small></span><span class="conv-meta">${last ? `<small>${relativeDay(localDay(last.at)) === 'Hoje' ? fmtTime(last.at) : relativeDay(localDay(last.at))}</small>` : ''}${n ? `<b class="count">${n}</b>` : ''}</span></button>`; }).join('')}</aside>` : ''}
    <div class="chat">
      <div class="chat-head">${avatar(pro ? p : { id: 'professional1', name: otherName })}<div><strong>${esc(otherName)}</strong><small>${pro ? esc(p?.goal) : 'Fisioterapeuta responsável'}</small></div><span class="live"><i></i>Ao vivo</span></div>
      <div class="bubbles" id="bubbles">${bubbles || empty('message', 'A conversa começa aqui', 'Envie a primeira mensagem.')}</div>
      <form id="message-form" class="composer"><textarea name="message" rows="1" required maxlength="1000" placeholder="Escreva sua mensagem…  (Enter envia · Shift+Enter quebra linha)" aria-label="Mensagem"></textarea><button class="btn primary icon-only" type="submit" aria-label="Enviar mensagem">${icon('send')}</button></form>
    </div>
  </section>`;
}
const lastMessage = patientId => S.db.messages.filter(m => m.patient === patientId).at(-1);

// ---------------------------------------------------------------- páginas: sobre
function about() {
  const team = ['Amanda', 'Flavio', 'Kecia', 'Lohanne', 'Luísângel', 'Luiz', 'Marcus', 'Miguel', 'Uriel', 'Vinicius'];
  const features = [
    ['RF02', 'Cadastro e edição de pacientes, com e-mail único e senha inicial'],
    ['RF03', 'Catálogo de exercícios com categoria, duração e instruções'],
    ['RF04', 'Prescrições com período, frequência e bloqueio de sobreposição'],
    ['RF05', 'Registro diário da atividade com nível de dor (0–10) e comentário'],
    ['RF06', 'Evolução com gráfico de dor, adesão e diário de atividades'],
    ['RF07', 'Lembretes das atividades previstas e ainda pendentes'],
    ['RF08', 'Mensagens entre paciente e fisioterapeuta, com atualização automática'],
    ['RF09', 'Alertas de dor elevada ou ausência de registros para o profissional'],
  ];
  return `${header('Tecnologia a serviço do cuidado', 'Sobre o projeto', 'Sistema de Acompanhamento Fisioterapêutico · UDF · Análise e Desenvolvimento de Sistemas')}
  <section class="about-hero card">
    <div><p class="eyebrow">O problema</p><h2>Entre uma consulta e outra, o cuidado se dispersa.</h2><p>Exercícios em papel, dúvidas esquecidas e relatos de dor que se perdem dificultam a avaliação da evolução do paciente. O Fisio Acompanha aproxima paciente e fisioterapeuta no período em que o tratamento acontece de fato: em casa.</p></div>
    <div class="ods"><span>3</span><div><strong>ODS 3</strong><small>Saúde e bem-estar</small></div></div>
  </section>
  <h2 class="section-title">Arquitetura</h2>
  <section class="tech-grid">
    ${[['layout', 'Interface', 'HTML, CSS e JavaScript puro, responsiva, com tema claro e escuro.'], ['code', 'API REST', 'Python + FastAPI: autenticação, regras de negócio e validações. Documentação em /docs.'], ['database', 'Banco de dados', 'SQLite com chaves estrangeiras, restrições e transações.'], ['shield', 'Segurança', 'Senhas com PBKDF2-SHA256, sessões HttpOnly e acesso filtrado por perfil.']].map(([i, t, d]) => `<article class="tech card"><span class="stat-icon tone-green">${icon(i)}</span><h3>${t}</h3><p>${d}</p></article>`).join('')}
  </section>
  <h2 class="section-title">Funcionalidades</h2>
  <section class="card"><ul class="features">${features.map(([code, text]) => `<li><span class="badge info">${code}</span>${text}</li>`).join('')}</ul></section>
  <section class="grid-2">
    <article class="card"><h3>Equipe</h3><div class="team">${team.map(n => `<span>${avatar({ id: n, name: n }, 'sm')}${n}</span>`).join('')}</div><p class="muted">Brasília · 2026.2</p></article>
    <article class="card"><h3>Limites acadêmicos</h3><p class="muted">Use somente dados fictícios: as contas de exemplo têm senhas públicas. Execução local, sem recuperação de senha nem notificações externas. A aplicação não emite diagnósticos e não substitui a avaliação presencial. Python/FastAPI e SQLite substituem, nesta entrega, a stack Java/Spring Boot e H2 prevista no documento.</p></article>
  </section>`;
}

// ---------------------------------------------------------------- modais e formulários
function openModal(title, body, { wide = false, subtitle = '' } = {}) {
  const modal = $('#modal');
  modal.className = wide ? 'wide' : '';
  modal.innerHTML = `<div class="modal-head"><div><h2 id="modal-title">${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div><button class="icon-btn ghost" data-action="modal-close" aria-label="Fechar">${icon('close')}</button></div><div class="modal-body">${body}</div>`;
  if (!modal.open) modal.showModal();
  modal.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),textarea,select')?.focus();
}
const closeModal = () => $('#modal').open && $('#modal').close();
const field = (name, label, value = '', type = 'text', extra = '', full = false) =>
  `<label class="field ${full ? 'full' : ''}"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const formWrap = (kind, body, id = '', submit = 'Salvar') =>
  `<form id="edit-form" data-kind="${kind}" data-id="${id}"><div class="form-grid">${body}</div><p id="form-error" class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="btn ghost" data-action="modal-close">Cancelar</button><button type="submit" class="btn primary">${icon('check')}<span>${submit}</span></button></div></form>`;

function patientForm(id) {
  const p = patientById(id) || {};
  openModal(id ? 'Editar paciente' : 'Novo paciente', formWrap('patient',
    field('name', 'Nome completo', p.name, 'text', 'required maxlength="80" placeholder="Ex.: Ana Ribeiro"', true)
    + field('email', 'E-mail (login do paciente)', p.email, 'email', 'required maxlength="120" placeholder="ana@example.com"')
    + (id ? '' : field('password', 'Senha inicial', '', 'password', 'required minlength="6" maxlength="200" placeholder="Mínimo 6 caracteres"'))
    + field('goal', 'Objetivo do acompanhamento', p.goal, 'text', 'required maxlength="120" placeholder="Ex.: Mobilidade de joelho"', true),
    id, id ? 'Salvar alterações' : 'Cadastrar paciente'), { subtitle: id ? '' : 'O paciente poderá entrar com este e-mail e senha.' });
}
function exerciseForm(id) {
  const e = exerciseById(id) || {};
  openModal(id ? 'Editar exercício' : 'Novo exercício', formWrap('exercise',
    field('name', 'Nome do exercício', e.name, 'text', 'required maxlength="100"', true)
    + `<label class="field"><span>Categoria</span><select name="category">${Object.keys(CATEGORIES).map(c => `<option ${c === e.category ? 'selected' : ''}>${c}</option>`).join('')}</select></label>`
    + field('duration', 'Duração (minutos)', e.duration || 5, 'number', 'required min="1" max="180" step="1"')
    + `<label class="field full"><span>Instruções</span><textarea name="instructions" rows="4" required maxlength="1500">${esc(e.instructions || '')}</textarea></label>`
    + `<label class="field full"><span>Observações <em>(opcional)</em></span><textarea name="notes" rows="2" maxlength="500">${esc(e.notes || '')}</textarea></label>`,
    id), { wide: true });
}
function routineForm(patientId) {
  if (!S.db.patients.length) return toast('Cadastre um paciente antes de criar uma prescrição.', 'bad');
  const target = patientId || S.selected;
  openModal('Nova prescrição', formWrap('routine',
    `<label class="field"><span>Paciente</span><select name="patient">${S.db.patients.map(p => `<option value="${p.id}" ${p.id === target ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>`
    + `<label class="field"><span>Frequência</span><select name="frequency"><option>Diariamente</option><option>Segunda, quarta e sexta</option></select></label>`
    + field('start', 'Início', today(), 'date', 'required')
    + field('end', 'Término', shift(30), 'date', 'required')
    + `<fieldset class="field full"><legend>Exercícios</legend><div class="pick-grid">${S.db.exercises.map(e => { const c = category(e.category); return `<label class="pick"><input type="checkbox" name="exercises" value="${e.id}"><span class="ri-icon sm tone-${c.tone}">${icon(c.icon)}</span><span><strong>${esc(e.name)}</strong><small>${esc(e.category)} · ${e.duration} min</small></span>${icon('check', 'pick-check')}</label>`; }).join('')}</div></fieldset>`
    + `<label class="field full"><span>Orientações adicionais <em>(opcional)</em></span><textarea name="notes" rows="2" maxlength="1000" placeholder="Orientações combinadas na consulta"></textarea></label>`,
    '', 'Criar prescrição'), { wide: true, subtitle: 'Exercícios repetidos no mesmo período são bloqueados pelo sistema.' });
}
function logForm(routineId, exerciseId) {
  const r = S.db.routines.find(x => x.id === routineId), e = exerciseById(exerciseId);
  if (isPro() || !r || !e || logFor(routineId, exerciseId)) return toast('Este exercício não está disponível para registro.', 'bad');
  const cat = category(e.category);
  openModal('Registrar atividade', `<div class="log-ex"><span class="ri-icon tone-${cat.tone}">${icon(cat.icon)}</span><div><strong>${esc(e.name)}</strong><small>${e.duration} min · ${esc(e.category)}</small></div></div>`
    + formWrap('log', `<input type="hidden" name="routine" value="${routineId}"><input type="hidden" name="exercise" value="${exerciseId}">
      <fieldset class="field full"><legend>Qual foi seu nível de dor durante o exercício?</legend>
        <div class="pain-scale">${Array.from({ length: 11 }, (_, n) => `<label class="pain-opt ${painTone(n)}"><input type="radio" name="pain" value="${n}" ${n === 0 ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
        <div class="pain-legend"><span>Sem dor</span><output id="pain-label" class="badge good">0 · Sem dor</output><span>Dor máxima</span></div>
      </fieldset>
      <label class="field full"><span>Como você se sentiu? <em>(opcional)</em></span><textarea name="comment" rows="3" maxlength="1000" placeholder="Conte ao seu fisioterapeuta…"></textarea></label>
      <label class="check full"><input type="checkbox" name="completed" required><span>Confirmo que realizei esta atividade hoje.</span></label>`, '', 'Registrar'));
}
function endRoutineConfirm(id) {
  const r = S.db.routines.find(x => x.id === id);
  openModal('Encerrar prescrição?', `<p class="muted">A prescrição de <strong>${esc(patientById(r?.patient)?.name)}</strong> deixará de gerar atividades. Todo o histórico de registros será preservado.</p>
    <div class="modal-actions"><button class="btn ghost" data-action="modal-close">Cancelar</button><button class="btn danger" data-action="routine-end-confirm" data-id="${id}">${icon('stop')}<span>Encerrar prescrição</span></button></div>`);
}
function reminders() {
  if (isPro()) {
    const list = attention();
    return openModal('Alertas', list.length ? `<div class="alerts">${list.map(a => `<button class="alert-item ${a.tone}" data-action="patient-view" data-id="${a.patient.id}">${avatar(a.patient, 'sm')}<span><strong>${esc(a.patient.name)}</strong><small>${icon(a.icon)}${esc(a.text)}</small></span>${icon('arrow')}</button>`).join('')}</div>` : empty('shield', 'Nenhum alerta', 'Todos os pacientes estão com registros recentes e dor controlada.'),
      { subtitle: 'Pacientes com dor elevada ou sem registros recentes.' });
  }
  const list = pendingItems(S.selected);
  openModal('Lembretes de hoje', `${list.length ? `<div class="routine-list compact">${list.map(x => { const c = category(x.exercise.category); return `<div class="routine-item"><span class="ri-icon sm tone-${c.tone}">${icon(c.icon)}</span><div class="ri-body"><h4>${esc(x.exercise.name)}</h4><small>${icon('clock')} ${x.exercise.duration} min · pendente</small></div>${btn('Registrar', 'log-new', { size: 'sm', iconName: 'check', attrs: `data-routine="${x.routine.id}" data-id="${x.exercise.id}"` })}</div>`; }).join('')}</div>` : empty('check', 'Tudo em dia!', 'Nenhum exercício pendente para hoje.')}`,
    { subtitle: fmtDate(today(), { weekday: 'long', day: 'numeric', month: 'long' }) });
}

// ---------------------------------------------------------------- navegação
function go(page) {
  if (location.hash !== '#/' + page) location.hash = '#/' + page;
  else route();
}
function route() {
  if (!S.db) return;
  const wanted = location.hash.replace(/^#\/?/, '') || 'dashboard';
  S.page = pageList().some(p => p[0] === wanted) ? wanted : 'dashboard';
  S.menu = false;
  closeModal();
  render();
  $('#main')?.scrollTo(0, 0);
  window.scrollTo(0, 0);
  if (S.page === 'messages') scrollChat();
}
function render() {
  if (!S.db) return renderLogin();
  shell();
}
function scrollChat() { const b = $('#bubbles'); if (b) b.scrollTop = b.scrollHeight; }

// Re-renderiza preservando o texto digitado na conversa e o foco.
function refreshView() {
  const draft = $('#message-form textarea')?.value, focused = document.activeElement?.name === 'message';
  const searchFocused = document.activeElement?.id === 'search';
  render();
  const area = $('#message-form textarea');
  if (area && draft) area.value = draft;
  if (area && focused) area.focus();
  if (searchFocused) { const s = $('#search'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
  scrollChat();
}

// ---------------------------------------------------------------- eventos
document.addEventListener('click', async event => {
  const el = event.target.closest('[data-action]');
  if (event.target === $('#modal')) return closeModal(); // clique fora do conteúdo do modal
  if (!el) return;
  const { action, id } = el.dataset;
  try {
    switch (action) {
      case 'quick-login': {
        const form = $('#login-form');
        form.email.value = el.dataset.email; form.password.value = 'demo123';
        form.requestSubmit();
        break;
      }
      case 'logout': await api('/auth/logout', {}); S.db = null; S.selected = ''; history.replaceState(null, '', location.pathname); render(); break;
      case 'menu': S.menu = !S.menu; $('.layout').classList.toggle('menu-open', S.menu); break;
      case 'theme': {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next; store.set('fisio-theme', next); refreshView();
        break;
      }
      case 'reminders': reminders(); break;
      case 'modal-close': closeModal(); break;
      case 'patient-new': patientForm(); break;
      case 'patient-edit': patientForm(id); break;
      case 'patient-view': S.selected = id; go('evolution'); break;
      case 'patient-message': S.selected = id; go('messages'); break;
      case 'conversation': S.selected = id; refreshView(); break;
      case 'exercise-new': exerciseForm(); break;
      case 'exercise-edit': exerciseForm(id); break;
      case 'routine-new': routineForm(id); break;
      case 'routine-end': endRoutineConfirm(id); break;
      case 'routine-end-confirm':
        el.disabled = true;
        await api(`/routines/${id}/end`, {}); await loadState(); closeModal(); refreshView();
        toast('Prescrição encerrada. Histórico preservado.');
        break;
      case 'log-new': logForm(el.dataset.routine, id); break;
      case 'category': S.category = el.dataset.value; refreshView(); break;
      case 'rx-filter': S.rxFilter = el.dataset.value; refreshView(); break;
      case 'period': S.period = Number(el.dataset.value); refreshView(); break;
      case 'diary-toggle': S.diaryAll = !S.diaryAll; refreshView(); break;
    }
  } catch (error) { toast(error.message, 'bad'); el.disabled = false; }
});

document.addEventListener('change', event => {
  if (event.target.id === 'patient-select') { S.selected = event.target.value; refreshView(); }
  if (event.target.name === 'pain') {
    const n = Number(event.target.value), out = $('#pain-label');
    out.textContent = `${n} · ${painLabel(n)}`; out.className = `badge ${painTone(n)}`;
  }
});
document.addEventListener('input', event => {
  if (event.target.id === 'search') { S.search = event.target.value; $('#patient-results').innerHTML = patientCards(); }
  if (event.target.name === 'message') { event.target.style.height = 'auto'; event.target.style.height = Math.min(event.target.scrollHeight, 140) + 'px'; }
});
document.addEventListener('keydown', event => {
  if (event.target.name === 'message' && event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.target.form.requestSubmit(); }
});
window.addEventListener('hashchange', route);

document.addEventListener('submit', async event => {
  const form = event.target;
  if (!['login-form', 'message-form', 'edit-form'].includes(form.id)) return;
  event.preventDefault();
  const data = new FormData(form), val = key => String(data.get(key) || '').trim();
  const { kind, id } = form.dataset;
  const submit = form.querySelector('[type="submit"]');
  const errorBox = form.querySelector('.form-error');
  if (errorBox) errorBox.textContent = '';
  if (form.id !== 'message-form' && !form.checkValidity()) {
    const invalid = form.querySelector(':invalid');
    if (errorBox) errorBox.textContent = invalid?.type === 'checkbox' && invalid.name === 'completed' ? 'Confirme que realizou a atividade.' : 'Preencha os campos obrigatórios corretamente.';
    invalid?.focus();
    return;
  }
  if (submit) submit.disabled = true;
  try {
    if (form.id === 'login-form') {
      await api('/auth/login', { email: val('email'), password: val('password') });
      await loadState();
      S.page = 'dashboard';
      if (location.hash !== '#/dashboard') location.hash = '#/dashboard'; else render();
      toast(`Bem-vindo(a), ${firstName(S.db.currentUser.name)}!`);
      return;
    }
    if (form.id === 'message-form') {
      if (!val('message')) return;
      await api('/messages', { patient: S.selected, text: val('message') });
      form.reset();
      await loadState(); refreshView(); $('#message-form textarea')?.focus();
      return;
    }
    const method = id ? 'PUT' : 'POST';
    let message = 'Salvo com sucesso.';
    if (kind === 'patient') {
      await api('/patients' + (id ? '/' + id : ''), { name: val('name'), email: val('email'), goal: val('goal'), password: val('password') }, method);
      message = id ? 'Cadastro atualizado.' : 'Paciente cadastrado. Ele já pode entrar com o e-mail e a senha informados.';
    }
    if (kind === 'exercise') {
      await api('/exercises' + (id ? '/' + id : ''), { name: val('name'), duration: Number(val('duration')), category: val('category'), instructions: val('instructions'), notes: val('notes') }, method);
      message = id ? 'Exercício atualizado.' : 'Exercício adicionado ao catálogo.';
    }
    if (kind === 'routine') {
      if (!data.getAll('exercises').length) throw new Error('Selecione pelo menos um exercício.');
      await api('/routines', { patient: val('patient'), exercises: data.getAll('exercises'), frequency: val('frequency'), start: val('start'), end: val('end'), notes: val('notes') });
      S.selected = val('patient'); S.rxFilter = 'all';
      message = 'Prescrição criada.';
    }
    if (kind === 'log') {
      await api('/logs', { routine: val('routine'), exercise: val('exercise'), pain: Number(val('pain')), completed: data.has('completed'), comment: val('comment') });
      message = 'Atividade registrada. Seu fisioterapeuta já pode ver!';
    }
    await loadState(); closeModal(); refreshView();
    toast(message);
  } catch (error) {
    if (errorBox) errorBox.textContent = error.message; else toast(error.message, 'bad');
  } finally { if (submit) submit.disabled = false; }
});

// ---------------------------------------------------------------- atualização automática
// Consulta o servidor periodicamente; avisa sobre mensagens novas e atualiza a tela.
const signature = db => db ? [db.patients.length, db.exercises.length, db.routines.map(r => r.id + r.active).join(), db.logs.length, db.messages.length].join('|') : '';
async function poll() {
  if (!S.db || document.hidden || $('#modal').open) return;
  const before = S.db, sigBefore = signature(before);
  try { await loadState(); } catch { return; }
  if (signature(S.db) === sigBefore) return;
  const known = new Set(before.messages.map(m => m.id));
  for (const m of S.db.messages.filter(m => !known.has(m.id) && m.from !== S.db.currentUser.role)) {
    if (!(S.page === 'messages' && m.patient === S.selected)) {
      toast(`Nova mensagem de ${m.from === 'professional' ? S.db.currentUser.professionalName : patientById(m.patient)?.name}`, 'info');
    }
  }
  refreshView();
}
setInterval(poll, 5000);

async function boot() {
  try { await loadState(); route(); }
  catch { S.db = null; render(); }
}
boot();
