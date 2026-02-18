CREATE TABLE IF NOT EXISTS reference_views (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  user_id TEXT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  fingerprint_id TEXT NOT NULL,
  deck_name TEXT NULL,
  alpha_code TEXT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS card_interactions (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  user_id TEXT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  fingerprint_id TEXT NOT NULL,
  deck_name TEXT NULL,
  card_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL,
  phase TEXT NULL,
  action TEXT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS phase_logs (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  user_id TEXT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  fingerprint_id TEXT NOT NULL,
  deck_name TEXT NULL,
  batch_id TEXT NULL,
  phase TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_results (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  user_id TEXT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  fingerprint_id TEXT NOT NULL,
  deck_name TEXT NULL,
  card_id TEXT NOT NULL,
  batch_id TEXT NULL,
  is_correct BOOLEAN NOT NULL,
  phase TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS card_timing (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  user_id TEXT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  fingerprint_id TEXT NOT NULL,
  deck_name TEXT NULL,
  card_id TEXT NOT NULL,
  time_to_flip_ms INTEGER NOT NULL CHECK (time_to_flip_ms >= 0),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loop_metrics (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  user_id TEXT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  fingerprint_id TEXT NOT NULL,
  deck_name TEXT NULL,
  card_id TEXT NOT NULL,
  batch_id TEXT NULL,
  attempts_count INTEGER NOT NULL CHECK (attempts_count >= 0),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_abandons (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  user_id TEXT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  fingerprint_id TEXT NOT NULL,
  deck_name TEXT NULL,
  batch_id TEXT NULL,
  phase TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mastery_logs (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  user_id TEXT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  fingerprint_id TEXT NOT NULL,
  deck_name TEXT NULL,
  card_id TEXT NOT NULL,
  marked_known BOOLEAN NOT NULL DEFAULT TRUE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reference_views_alpha_timestamp
  ON reference_views(alpha_code, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_card_interactions_card_timestamp
  ON card_interactions(card_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_phase_logs_phase_timestamp
  ON phase_logs(phase, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_results_card_phase_timestamp
  ON quiz_results(card_id, phase, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_card_timing_card_timestamp
  ON card_timing(card_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_loop_metrics_card_timestamp
  ON loop_metrics(card_id, timestamp DESC);
