PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('professional','patient'))
);
CREATE TABLE IF NOT EXISTS patients (
 id TEXT PRIMARY KEY REFERENCES users(id), professional_id TEXT NOT NULL REFERENCES users(id),
 goal TEXT NOT NULL, since TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS exercises (
 id TEXT PRIMARY KEY, professional_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL,
 category TEXT NOT NULL, duration INTEGER NOT NULL CHECK(duration BETWEEN 1 AND 180),
 instructions TEXT NOT NULL, notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS routines (
 id TEXT PRIMARY KEY, professional_id TEXT NOT NULL REFERENCES users(id),
 patient_id TEXT NOT NULL REFERENCES patients(id), frequency TEXT NOT NULL,
 start TEXT NOT NULL, end TEXT NOT NULL CHECK(end>=start), notes TEXT NOT NULL DEFAULT '',
 active INTEGER NOT NULL CHECK(active IN (0,1))
);
CREATE TABLE IF NOT EXISTS routine_exercises (
 routine_id TEXT NOT NULL REFERENCES routines(id), exercise_id TEXT NOT NULL REFERENCES exercises(id),
 PRIMARY KEY(routine_id,exercise_id)
);
CREATE TABLE IF NOT EXISTS logs (
 id TEXT PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES patients(id),
 exercise_id TEXT NOT NULL REFERENCES exercises(id), routine_id TEXT NOT NULL REFERENCES routines(id),
 date TEXT NOT NULL, pain INTEGER NOT NULL CHECK(typeof(pain)='integer' AND pain BETWEEN 0 AND 10),
 comment TEXT NOT NULL DEFAULT '', author TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(routine_id,exercise_id,date)
);
CREATE TABLE IF NOT EXISTS messages (
 id TEXT PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES patients(id),
 professional_id TEXT NOT NULL REFERENCES users(id), sender TEXT NOT NULL CHECK(sender IN ('professional','patient')),
 text TEXT NOT NULL, at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS logs_patient_date ON logs(patient_id,date);
CREATE INDEX IF NOT EXISTS messages_patient ON messages(patient_id,at);
CREATE INDEX IF NOT EXISTS routines_patient ON routines(patient_id);
