/* Versão online: substitui a API FastAPI por um servidor simulado no navegador.
   Os dados ficam no localStorage (compartilhado entre abas); a sessão fica no sessionStorage (uma por aba). */
(() => {
  const SEED = __SEED__;
  const KEY = 'fisio-web-db-v1', SKEY = 'fisio-web-session';
  let memory = null, memorySession = null;

  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const weekday = iso => new Date(iso + 'T12:00:00Z').getUTCDay();
  const mwf = iso => [1, 3, 5].includes(weekday(iso));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()) + Date.now()).replace(/[^a-z0-9]/gi, '').slice(0, 32);
  const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  function seedDb() {
    const base = today(), day = n => addDays(base, n), rand = rng(2026);
    const db = { seededOn: base, users: [], patients: [], exercises: [], routines: [], logs: [], messages: [] };
    db.users.push({ id: 'professional1', name: 'Camila Oliveira', email: 'camila@example.com', password: 'demo123', role: 'professional' });
    const names = {};
    for (const p of SEED.patients) {
      names[p.id] = p.name;
      db.users.push({ id: p.id, name: p.name, email: p.email, password: 'demo123', role: 'patient' });
      db.patients.push({ id: p.id, professional: 'professional1', goal: p.goal, since: day(p.since) });
    }
    for (const e of SEED.exercises) db.exercises.push({ ...e, professional: 'professional1' });
    for (const r of SEED.routines) {
      db.routines.push({ id: r.id, professional: 'professional1', patient: r.patient, frequency: r.frequency, start: day(r.start), end: day(r.end), notes: r.notes, active: !!r.active, exercises: [...r.exercises] });
      const sim = r.simulate;
      if (!sim) continue;
      const last = Math.min(sim.until, r.end);
      for (let offset = r.start; offset <= last; offset++) {
        const current = day(offset);
        if (r.frequency !== 'Diariamente' && !mwf(current)) continue;
        const progress = (offset - r.start) / Math.max(last - r.start, 1);
        for (const eid of r.exercises) {
          if (rand() > sim.adherence) continue;
          let pain = Math.round(sim.pain_from + (sim.pain_to - sim.pain_from) * progress + (rand() * 2.4 - 1.2));
          pain = Math.max(0, Math.min(10, pain));
          const pool = pain >= 6 ? SEED.comments_high : SEED.comments_low;
          const comment = rand() < 0.3 ? pool[Math.floor(rand() * pool.length)] : '';
          db.logs.push({ id: uid(), patient: r.patient, exercise: eid, routine: r.id, date: current, pain, comment, author: names[r.patient], created: new Date().toISOString() });
        }
      }
    }
    for (const m of SEED.messages) db.messages.push({ id: m.id, patient: m.patient, from: m.from, text: m.text, at: new Date(`${day(m.day)}T${m.time}:00-03:00`).toISOString() });
    return db;
  }

  function load() {
    let db = null;
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = memory; }
    // Os dados de demonstração são relativos a hoje: recria a cada novo dia.
    if (!db || db.seededOn !== today()) { db = seedDb(); save(db); }
    return db;
  }
  function save(db) { memory = db; try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* fica só em memória */ } }
  const getSession = () => { try { return sessionStorage.getItem(SKEY); } catch { return memorySession; } };
  const setSession = v => { memorySession = v; try { v ? sessionStorage.setItem(SKEY, v) : sessionStorage.removeItem(SKEY); } catch { /* memória */ } };

  class HttpError extends Error { constructor(status, detail) { super(detail); this.status = status; } }
  const fail = (status, detail) => { throw new HttpError(status, detail); };
  const text = (data, key, max = 1000, required = true) => {
    const v = data[key] ?? '';
    if (typeof v !== 'string') fail(422, `Campo inválido: ${key}.`);
    const t = v.trim();
    if ((required && !t) || t.length > max) fail(422, `Preencha ${key} com até ${max} caracteres.`);
    return t;
  };
  const email = data => {
    const e = text(data, 'email', 120).toLowerCase();
    if (!e.includes('@') || !e.split('@').pop().includes('.') || e.includes(' ')) fail(422, 'Informe um e-mail válido.');
    return e;
  };
  const isoDate = (data, key) => { const v = data[key]; if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v))) fail(422, 'Informe datas válidas.'); return v; };

  function currentUser(db) {
    const u = db.users.find(x => x.id === getSession());
    if (!u) fail(401, 'Entre na sua conta para continuar.');
    return u;
  }
  const professional = u => { if (u.role !== 'professional') fail(403, 'Esta ação exige o perfil de fisioterapeuta.'); };
  function linked(db, u, pid) {
    const p = db.patients.find(x => x.id === pid);
    if (!p || (u.role === 'patient' && pid !== u.id) || (u.role === 'professional' && p.professional !== u.id)) fail(403, 'Paciente indisponível para esta conta.');
    return p;
  }

  function state(db) {
    const u = currentUser(db);
    const mine = u.role === 'professional' ? db.patients.filter(p => p.professional === u.id) : db.patients.filter(p => p.id === u.id);
    const owner = u.role === 'professional' ? u.id : mine[0].professional;
    const ids = new Set(mine.map(p => p.id));
    const routines = db.routines.filter(r => ids.has(r.patient));
    const used = new Set(routines.flatMap(r => r.exercises));
    const exercises = db.exercises.filter(e => u.role === 'professional' ? e.professional === owner : used.has(e.id));
    return {
      patients: mine.map(p => { const user = db.users.find(x => x.id === p.id); return { id: p.id, name: user.name, email: user.email, goal: p.goal, since: p.since }; }),
      exercises: exercises.map(({ id, name, category, duration, instructions, notes }) => ({ id, name, category, duration, instructions, notes })),
      routines: routines.map(({ id, patient, frequency, start, end, notes, active, exercises }) => ({ id, patient, frequency, start, end, notes, active, exercises: [...exercises] })),
      logs: db.logs.filter(l => ids.has(l.patient)).sort((a, b) => (a.date + a.created).localeCompare(b.date + b.created)).map(({ id, patient, exercise, routine, date, pain, comment, author }) => ({ id, patient, exercise, routine, date, pain, comment, author })),
      messages: db.messages.filter(m => ids.has(m.patient)).sort((a, b) => a.at.localeCompare(b.at)).map(({ id, patient, from, text, at }) => ({ id, patient, from, text, at })),
      currentUser: { id: u.id, name: u.name, role: u.role, professionalName: db.users.find(x => x.id === owner).name },
    };
  }

  function route(method, path, data) {
    const db = load();
    let m;
    if (method === 'GET' && path === '/api/health') return { status: 'ok', database: 'navegador' };
    if (method === 'GET' && path === '/api/state') return state(db);
    if (method === 'POST' && path === '/api/auth/login') {
      const e = email(data), pw = text(data, 'password', 200);
      const u = db.users.find(x => x.email.toLowerCase() === e);
      if (!u || u.password !== pw) fail(401, 'E-mail ou senha incorretos.');
      setSession(u.id);
      return { ok: true };
    }
    if (method === 'POST' && path === '/api/auth/logout') { setSession(null); return { ok: true }; }
    if ((method === 'POST' && path === '/api/patients') || (method === 'PUT' && (m = path.match(/^\/api\/patients\/([^/]+)$/)))) {
      const id = m ? decodeURIComponent(m[1]) : '';
      const name = text(data, 'name', 80), mail = email(data), goal = text(data, 'goal', 120);
      const u = currentUser(db); professional(u);
      if (id) linked(db, u, id);
      if (db.users.some(x => x.email.toLowerCase() === mail && x.id !== id)) fail(409, 'Este e-mail já está cadastrado.');
      if (id) {
        Object.assign(db.users.find(x => x.id === id), { name, email: mail });
        db.patients.find(x => x.id === id).goal = goal;
        save(db); return { id };
      }
      const pw = text(data, 'password', 200);
      if (pw.length < 6) fail(422, 'Use uma senha com pelo menos 6 caracteres.');
      const nid = uid();
      db.users.push({ id: nid, name, email: mail, password: pw, role: 'patient' });
      db.patients.push({ id: nid, professional: u.id, goal, since: today() });
      save(db); return { id: nid };
    }
    if ((method === 'POST' && path === '/api/exercises') || (method === 'PUT' && (m = path.match(/^\/api\/exercises\/([^/]+)$/)))) {
      const id = m ? decodeURIComponent(m[1]) : '';
      const duration = data.duration;
      if (!Number.isInteger(duration) || duration < 1 || duration > 180) fail(422, 'A duração deve ser um inteiro de 1 a 180 minutos.');
      const values = { name: text(data, 'name', 100), category: text(data, 'category', 50), duration, instructions: text(data, 'instructions', 1500), notes: text(data, 'notes', 500, false) };
      const u = currentUser(db); professional(u);
      if (id) {
        const e = db.exercises.find(x => x.id === id && x.professional === u.id);
        if (!e) fail(404, 'Exercício não encontrado.');
        Object.assign(e, values); save(db); return { id };
      }
      const nid = uid();
      db.exercises.push({ id: nid, professional: u.id, ...values });
      save(db); return { id: nid };
    }
    if (method === 'POST' && path === '/api/routines') {
      const start = isoDate(data, 'start'), end = isoDate(data, 'end');
      if (end < start) fail(422, 'O término deve ser igual ou posterior ao início.');
      const frequency = text(data, 'frequency', 50);
      if (!['Diariamente', 'Segunda, quarta e sexta'].includes(frequency)) fail(422, 'Frequência inválida.');
      const ex = data.exercises;
      if (!Array.isArray(ex) || !ex.length || ex.length > 100 || ex.some(e => typeof e !== 'string') || new Set(ex).size !== ex.length) fail(422, 'Selecione exercícios válidos, sem repetição.');
      const pid = text(data, 'patient', 100), notes = text(data, 'notes', 1000, false);
      const u = currentUser(db); professional(u); linked(db, u, pid);
      for (const eid of ex) {
        if (!db.exercises.some(e => e.id === eid && e.professional === u.id)) fail(422, 'Exercício indisponível.');
        if (db.routines.some(r => r.patient === pid && r.active && r.exercises.includes(eid) && r.start <= end && r.end >= start)) fail(409, 'Já existe uma prescrição com este exercício nesse período. Encerre a anterior ou selecione outro.');
      }
      const rid = uid();
      db.routines.push({ id: rid, professional: u.id, patient: pid, frequency, start, end, notes, active: true, exercises: [...ex] });
      save(db); return { id: rid };
    }
    if (method === 'POST' && (m = path.match(/^\/api\/routines\/([^/]+)\/end$/))) {
      const u = currentUser(db); professional(u);
      const r = db.routines.find(x => x.id === decodeURIComponent(m[1]) && x.professional === u.id);
      if (!r) fail(404, 'Prescrição não encontrada.');
      r.active = false; save(db); return { ok: true };
    }
    if (method === 'POST' && path === '/api/logs') {
      const pain = data.pain;
      if (!Number.isInteger(pain) || pain < 0 || pain > 10) fail(422, 'A dor deve ser um número inteiro entre 0 e 10.');
      if (data.completed !== true) fail(422, 'Confirme a realização da atividade.');
      const rid = text(data, 'routine', 100), eid = text(data, 'exercise', 100), comment = text(data, 'comment', 1000, false);
      const u = currentUser(db);
      if (u.role !== 'patient') fail(403, 'Apenas o paciente pode registrar sua atividade.');
      const r = db.routines.find(x => x.id === rid && x.patient === u.id && x.exercises.includes(eid));
      const t = today();
      if (!r || !r.active || !(r.start <= t && t <= r.end) || (r.frequency !== 'Diariamente' && !mwf(t))) fail(403, 'Atividade indisponível para este paciente ou data.');
      if (db.logs.some(l => l.routine === rid && l.exercise === eid && l.date === t)) fail(409, 'Esta atividade já foi registrada hoje.');
      const lid = uid();
      db.logs.push({ id: lid, patient: u.id, exercise: eid, routine: rid, date: t, pain, comment, author: u.name, created: new Date().toISOString() });
      save(db); return { id: lid };
    }
    if (method === 'POST' && path === '/api/messages') {
      const pid = text(data, 'patient', 100), msg = text(data, 'text', 1000);
      const u = currentUser(db); linked(db, u, pid);
      const mid = uid();
      db.messages.push({ id: mid, patient: pid, from: u.role, text: msg, at: new Date().toISOString() });
      save(db); return { id: mid };
    }
    fail(404, 'Recurso não encontrado.');
  }

  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, options = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.startsWith('/api/')) return realFetch(input, options);
    const method = (options.method || 'GET').toUpperCase();
    let data = {};
    if (options.body) { try { data = JSON.parse(options.body); } catch { return json({ detail: 'JSON inválido.' }, 400); } }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ detail: 'Objeto JSON esperado.' }, 422);
    try { return json(route(method, url.split('?')[0], data)); }
    catch (error) { if (error instanceof HttpError) return json({ detail: error.message }, error.status); throw error; }
  };
})();
