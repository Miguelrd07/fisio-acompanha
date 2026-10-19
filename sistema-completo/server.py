"""API acadêmica de acompanhamento fisioterapêutico, com SQLite e sessões."""
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timedelta, timezone, date
from pathlib import Path
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get('FISIO_DB', ROOT / 'data' / 'fisioterapia.db'))
COOKIE = 'fisio_session'
BAHIA = timezone(timedelta(hours=-3))
ATTEMPTS = {}

def today():
    return datetime.now(BAHIA).date().isoformat()

@contextmanager
def connect():
    connection = sqlite3.connect(DB_PATH, timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA foreign_keys=ON')
    try:
        with connection:
            yield connection
    finally:
        connection.close()

def password_hash(password):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 310000).hex()
    return f'pbkdf2_sha256$310000${salt}${digest}'

def password_valid(password, encoded):
    try:
        _, iterations, salt, expected = encoded.split('$')
        actual = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), int(iterations)).hex()
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False

def new_id():
    return secrets.token_hex(16)

def initialize():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as c:
        c.executescript((ROOT / 'schema.sql').read_text(encoding='utf-8'))
        if c.execute('SELECT count(*) FROM users').fetchone()[0]:
            return
        seed = json.loads((ROOT / 'seed.json').read_text(encoding='utf-8'))
        encoded = password_hash('demo123')
        c.execute('INSERT INTO users VALUES (?,?,?,?,?)', ('professional1', 'Camila Oliveira', 'camila@example.com', encoded, 'professional'))
        for p in seed['patients']:
            c.execute('INSERT INTO users VALUES (?,?,?,?,?)', (p['id'], p['name'], p['email'], encoded, 'patient'))
            c.execute('INSERT INTO patients VALUES (?,?,?,?)', (p['id'], 'professional1', p['goal'], p['since']))
        for e in seed['exercises']:
            c.execute('INSERT INTO exercises VALUES (?,?,?,?,?,?,?)', (e['id'], 'professional1', e['name'], e['category'], e['duration'], e['instructions'], e['notes']))
        for r in seed['routines']:
            c.execute('INSERT INTO routines VALUES (?,?,?,?,?,?,?,?)', (r['id'], 'professional1', r['patient'], r['frequency'], r['start'], r['end'], r['notes'], int(r['active'])))
            c.executemany('INSERT INTO routine_exercises VALUES (?,?)', [(r['id'], e) for e in r['exercises']])
        for l in seed['logs']:
            c.execute('INSERT INTO logs VALUES (?,?,?,?,?,?,?,?,?)', (l['id'], l['patient'], l['exercise'], l['routine'], l['date'], l['pain'], l['comment'], l['author'], datetime.now(timezone.utc).isoformat()))
        for m in seed['messages']:
            c.execute('INSERT INTO messages VALUES (?,?,?,?,?,?)', (m['id'], m['patient'], 'professional1', m['from'], m['text'], m['at']))

@asynccontextmanager
async def lifespan(app):
    initialize()
    yield

app = FastAPI(title='Fisio Acompanha API', version='1.0.0', lifespan=lifespan)

@app.middleware('http')
async def security(request: Request, call_next):
    if request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
        origin = request.headers.get('origin')
        if origin and origin != str(request.base_url).rstrip('/'):
            return JSONResponse({'detail': 'Origem não autorizada.'}, status_code=403)
        if request.headers.get('content-type', '').split(';')[0] != 'application/json':
            return JSONResponse({'detail': 'Envie JSON.'}, status_code=415)
        if int(request.headers.get('content-length', '0')) > 32768:
            return JSONResponse({'detail': 'Requisição muito grande.'}, status_code=413)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'same-origin'
    if request.url.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store'
    return response

def current_user(request, c):
    token = request.cookies.get(COOKIE, '')
    if not token:
        raise HTTPException(401, 'Entre na sua conta para continuar.')
    hashed = hashlib.sha256(token.encode()).hexdigest()
    row = c.execute('SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?', (hashed, time.time())).fetchone()
    if not row:
        raise HTTPException(401, 'Sessão expirada. Entre novamente.')
    return dict(row)

def professional(user):
    if user['role'] != 'professional':
        raise HTTPException(403, 'Esta ação exige o perfil de fisioterapeuta.')

def linked(c, user, patient_id):
    row = c.execute('SELECT * FROM patients WHERE id=?', (patient_id,)).fetchone()
    if not row or (user['role'] == 'patient' and patient_id != user['id']) or (user['role'] == 'professional' and row['professional_id'] != user['id']):
        raise HTTPException(403, 'Paciente indisponível para esta conta.')
    return dict(row)

def text_value(data, key, maximum=1000, required=True):
    value = data.get(key, '')
    if not isinstance(value, str):
        raise HTTPException(422, f'Campo inválido: {key}.')
    value = value.strip()
    if (required and not value) or len(value) > maximum:
        raise HTTPException(422, f'Preencha {key} com até {maximum} caracteres.')
    return value

def email_value(data):
    email = text_value(data, 'email', 120).lower()
    if '@' not in email or '.' not in email.split('@')[-1] or ' ' in email:
        raise HTTPException(422, 'Informe um e-mail válido.')
    return email

def date_value(data, key):
    try:
        value = date.fromisoformat(data.get(key, '')).isoformat()
    except (ValueError, TypeError):
        raise HTTPException(422, 'Informe datas válidas.')
    return value

async def body(request):
    raw = await request.body()
    if len(raw) > 32768:
        raise HTTPException(413, 'Requisição muito grande.')
    try:
        data = json.loads(raw)
    except (ValueError, UnicodeError):
        raise HTTPException(400, 'JSON inválido.')
    if not isinstance(data, dict):
        raise HTTPException(422, 'Objeto JSON esperado.')
    return data

@app.post('/api/auth/login')
async def login(request: Request):
    data = await body(request)
    email = email_value(data)
    password = text_value(data, 'password', 200)
    key = (request.client.host, email)
    tries = [t for t in ATTEMPTS.get(key, []) if time.time() - t < 60]
    if len(tries) >= 8:
        raise HTTPException(429, 'Muitas tentativas. Aguarde um minuto.')
    with connect() as c:
        user = c.execute('SELECT * FROM users WHERE email=?', (email,)).fetchone()
        if not user or not password_valid(password, user['password_hash']):
            ATTEMPTS[key] = tries + [time.time()]
            raise HTTPException(401, 'E-mail ou senha incorretos.')
        ATTEMPTS.pop(key, None)
        token = secrets.token_urlsafe(32)
        c.execute('DELETE FROM sessions WHERE expires_at<?', (time.time(),))
        c.execute('INSERT INTO sessions VALUES (?,?,?)', (hashlib.sha256(token.encode()).hexdigest(), user['id'], time.time()+8*3600))
    response = JSONResponse({'ok': True})
    response.set_cookie(COOKIE, token, max_age=8*3600, httponly=True, samesite='strict', secure=request.url.scheme == 'https')
    return response

@app.post('/api/auth/logout')
def logout(request: Request):
    token = request.cookies.get(COOKIE, '')
    with connect() as c:
        c.execute('DELETE FROM sessions WHERE token_hash=?', (hashlib.sha256(token.encode()).hexdigest(),))
    response = JSONResponse({'ok': True})
    response.delete_cookie(COOKIE)
    return response

@app.get('/api/state')
def state(request: Request):
    with connect() as c:
        user = current_user(request, c)
        if user['role'] == 'professional':
            rows = c.execute('SELECT p.id,u.name,u.email,p.goal,p.since FROM patients p JOIN users u ON p.id=u.id WHERE p.professional_id=?', (user['id'],)).fetchall()
            owner = user['id']
        else:
            rows = c.execute('SELECT p.id,u.name,u.email,p.goal,p.since FROM patients p JOIN users u ON p.id=u.id WHERE p.id=?', (user['id'],)).fetchall()
            owner = c.execute('SELECT professional_id FROM patients WHERE id=?', (user['id'],)).fetchone()[0]
        patients = [dict(p) for p in rows]
        ids = [p['id'] for p in patients]
        placeholders = ','.join('?' for _ in ids) or 'NULL'
        routines = []
        for row in c.execute(f'SELECT id,patient_id AS patient,frequency,start,end,notes,active FROM routines WHERE patient_id IN ({placeholders})', ids):
            r = dict(row)
            r['active'] = bool(r['active'])
            r['exercises'] = [e[0] for e in c.execute('SELECT exercise_id FROM routine_exercises WHERE routine_id=?', (r['id'],))]
            routines.append(r)
        if user['role'] == 'professional':
            exercises = c.execute('SELECT id,name,category,duration,instructions,notes FROM exercises WHERE professional_id=?', (owner,)).fetchall()
        else:
            exercises = c.execute('SELECT DISTINCT e.id,e.name,e.category,e.duration,e.instructions,e.notes FROM exercises e JOIN routine_exercises re ON re.exercise_id=e.id JOIN routines r ON r.id=re.routine_id WHERE r.patient_id=?', (user['id'],)).fetchall()
        logs = c.execute(f'SELECT id,patient_id AS patient,exercise_id AS exercise,routine_id AS routine,date,pain,comment,author FROM logs WHERE patient_id IN ({placeholders}) ORDER BY date,created_at', ids).fetchall()
        messages = c.execute(f'SELECT id,patient_id AS patient,sender AS "from",text,at FROM messages WHERE patient_id IN ({placeholders}) ORDER BY at', ids).fetchall()
        owner_name = c.execute('SELECT name FROM users WHERE id=?', (owner,)).fetchone()[0]
        return {'patients': patients, 'exercises': [dict(e) for e in exercises], 'routines': routines, 'logs': [dict(l) for l in logs], 'messages': [dict(m) for m in messages], 'currentUser': {'id': user['id'], 'name': user['name'], 'role': user['role'], 'professionalName': owner_name}}

@app.post('/api/patients')
@app.put('/api/patients/{item_id}')
async def patients(request: Request, item_id: str = ''):
    data = await body(request)
    name, email, goal = text_value(data, 'name', 80), email_value(data), text_value(data, 'goal', 120)
    with connect() as c:
        user = current_user(request, c)
        professional(user)
        if item_id:
            linked(c, user, item_id)
        if c.execute('SELECT id FROM users WHERE email=? AND id<>?', (email, item_id)).fetchone():
            raise HTTPException(409, 'Este e-mail já está cadastrado.')
        if item_id:
            c.execute('UPDATE users SET name=?,email=? WHERE id=?', (name, email, item_id))
            c.execute('UPDATE patients SET goal=? WHERE id=?', (goal, item_id))
        else:
            password = text_value(data, 'password', 200)
            if len(password) < 6:
                raise HTTPException(422, 'Use uma senha com pelo menos 6 caracteres.')
            item_id = new_id()
            c.execute('INSERT INTO users VALUES (?,?,?,?,?)', (item_id, name, email, password_hash(password), 'patient'))
            c.execute('INSERT INTO patients VALUES (?,?,?,?)', (item_id, user['id'], goal, today()))
    return {'id': item_id}

@app.post('/api/exercises')
@app.put('/api/exercises/{item_id}')
async def exercises(request: Request, item_id: str = ''):
    data = await body(request)
    duration = data.get('duration')
    if type(duration) is not int or not 1 <= duration <= 180:
        raise HTTPException(422, 'A duração deve ser um inteiro de 1 a 180 minutos.')
    values = (text_value(data, 'name', 100), text_value(data, 'category', 50), duration, text_value(data, 'instructions', 1500), text_value(data, 'notes', 500, False))
    with connect() as c:
        user = current_user(request, c)
        professional(user)
        if item_id:
            if not c.execute('SELECT id FROM exercises WHERE id=? AND professional_id=?', (item_id, user['id'])).fetchone():
                raise HTTPException(404, 'Exercício não encontrado.')
            c.execute('UPDATE exercises SET name=?,category=?,duration=?,instructions=?,notes=? WHERE id=?', (*values, item_id))
        else:
            item_id = new_id()
            c.execute('INSERT INTO exercises VALUES (?,?,?,?,?,?,?)', (item_id, user['id'], *values))
    return {'id': item_id}

@app.post('/api/routines')
async def routines(request: Request):
    data = await body(request)
    start, end = date_value(data, 'start'), date_value(data, 'end')
    if end < start:
        raise HTTPException(422, 'O término deve ser igual ou posterior ao início.')
    frequency = text_value(data, 'frequency', 50)
    if frequency not in ('Diariamente', 'Segunda, quarta e sexta'):
        raise HTTPException(422, 'Frequência inválida.')
    exercises = data.get('exercises')
    if not isinstance(exercises, list) or not exercises or len(exercises) > 100 or any(not isinstance(e, str) for e in exercises) or len(set(exercises)) != len(exercises):
        raise HTTPException(422, 'Selecione exercícios válidos, sem repetição.')
    pid = text_value(data, 'patient', 100)
    notes = text_value(data, 'notes', 1000, False)
    with connect() as c:
        c.execute('BEGIN IMMEDIATE')
        user = current_user(request, c)
        professional(user)
        linked(c, user, pid)
        for eid in exercises:
            if not c.execute('SELECT id FROM exercises WHERE id=? AND professional_id=?', (eid, user['id'])).fetchone():
                raise HTTPException(422, 'Exercício indisponível.')
            if c.execute('SELECT r.id FROM routines r JOIN routine_exercises re ON r.id=re.routine_id WHERE r.patient_id=? AND re.exercise_id=? AND r.active=1 AND r.start<=? AND r.end>=?', (pid, eid, end, start)).fetchone():
                raise HTTPException(409, 'Já existe uma prescrição com este exercício nesse período. Encerre a anterior ou selecione outro.')
        rid = new_id()
        c.execute('INSERT INTO routines VALUES (?,?,?,?,?,?,?,?)', (rid, user['id'], pid, frequency, start, end, notes, 1))
        c.executemany('INSERT INTO routine_exercises VALUES (?,?)', [(rid, eid) for eid in exercises])
    return {'id': rid}

@app.post('/api/routines/{item_id}/end')
def end_routine(item_id: str, request: Request):
    with connect() as c:
        user = current_user(request, c)
        professional(user)
        row = c.execute('SELECT id FROM routines WHERE id=? AND professional_id=?', (item_id, user['id'])).fetchone()
        if not row:
            raise HTTPException(404, 'Prescrição não encontrada.')
        c.execute('UPDATE routines SET active=0 WHERE id=?', (item_id,))
    return {'ok': True}

@app.post('/api/logs')
async def logs(request: Request):
    data = await body(request)
    pain = data.get('pain')
    if type(pain) is not int or not 0 <= pain <= 10:
        raise HTTPException(422, 'A dor deve ser um número inteiro entre 0 e 10.')
    if data.get('completed') is not True:
        raise HTTPException(422, 'Confirme a realização da atividade.')
    rid, eid = text_value(data, 'routine', 100), text_value(data, 'exercise', 100)
    comment = text_value(data, 'comment', 1000, False)
    with connect() as c:
        c.execute('BEGIN IMMEDIATE')
        user = current_user(request, c)
        if user['role'] != 'patient':
            raise HTTPException(403, 'Apenas o paciente pode registrar sua atividade.')
        r = c.execute('SELECT r.* FROM routines r JOIN routine_exercises re ON re.routine_id=r.id WHERE r.id=? AND re.exercise_id=? AND r.patient_id=?', (rid, eid, user['id'])).fetchone()
        if not r or not r['active'] or not r['start'] <= today() <= r['end'] or (r['frequency'] != 'Diariamente' and date.fromisoformat(today()).weekday() not in (0, 2, 4)):
            raise HTTPException(403, 'Atividade indisponível para este paciente ou data.')
        if c.execute('SELECT id FROM logs WHERE routine_id=? AND exercise_id=? AND date=?', (rid, eid, today())).fetchone():
            raise HTTPException(409, 'Esta atividade já foi registrada hoje.')
        lid = new_id()
        c.execute('INSERT INTO logs VALUES (?,?,?,?,?,?,?,?,?)', (lid, user['id'], eid, rid, today(), pain, comment, user['name'], datetime.now(timezone.utc).isoformat()))
    return {'id': lid}

@app.post('/api/messages')
async def messages(request: Request):
    data = await body(request)
    pid, message = text_value(data, 'patient', 100), text_value(data, 'text', 1000)
    with connect() as c:
        user = current_user(request, c)
        link = linked(c, user, pid)
        mid = new_id()
        c.execute('INSERT INTO messages VALUES (?,?,?,?,?,?)', (mid, pid, link['professional_id'], user['role'], message, datetime.now(timezone.utc).isoformat()))
    return {'id': mid}

@app.get('/api/health')
def health():
    with connect() as c:
        c.execute('SELECT 1')
    return {'status': 'ok', 'database': 'sqlite'}

app.mount('/', StaticFiles(directory=ROOT / 'public', html=True), name='site')

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=int(os.environ.get('FISIO_PORT', '8766')))
