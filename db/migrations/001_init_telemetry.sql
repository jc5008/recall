CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  fingerprint_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ NULL,
  ip_address TEXT NULL,
  user_agent TEXT NULL,
  timezone TEXT NULL,
  language TEXT NULL,
  screen_width INTEGER NULL,
  screen_height INTEGER NULL,
  referrer_url TEXT NULL,
  utm_source TEXT NULL,
  utm_medium TEXT NULL,
  utm_campaign TEXT NULL
);

CREATE TABLE IF NOT EXISTS session_logs (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  user_id TEXT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  fingerprint_id TEXT NOT NULL,
  deck_name TEXT NULL,
  mode TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  user_id TEXT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  fingerprint_id TEXT NOT NULL,
  deck_name TEXT NULL,
  card_id TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  selected_answer_id TEXT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_timing (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  user_id TEXT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  fingerprint_id TEXT NOT NULL,
  deck_name TEXT NULL,
  card_id TEXT NOT NULL,
  time_to_answer_ms INTEGER NOT NULL CHECK (time_to_answer_ms >= 0),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS search_logs (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  user_id TEXT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  fingerprint_id TEXT NOT NULL,
  deck_name TEXT NULL,
  mode TEXT NOT NULL DEFAULT 'reference',
  search_term TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_fingerprint_id ON sessions(fingerprint_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_mode_timestamp ON session_logs(mode, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_card_timestamp ON quiz_attempts(card_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_timing_card_timestamp ON quiz_timing(card_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_term_timestamp ON search_logs(search_term, timestamp DESC);
