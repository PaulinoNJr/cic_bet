PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  description TEXT,
  accent_color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  avatar_url TEXT,
  character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
  starting_balance INTEGER NOT NULL DEFAULT 1000 CHECK (starting_balance >= 0),
  is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  closes_at TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  base_multiplier REAL NOT NULL DEFAULT 1.50,
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled', 'cancelled')),
  winning_option_id TEXT REFERENCES bet_options(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS bet_options (
  id TEXT PRIMARY KEY,
  bet_id TEXT NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  odds_multiplier REAL NOT NULL DEFAULT 1.50,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS predictions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bet_id TEXT NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  bet_option_id TEXT NOT NULL REFERENCES bet_options(id) ON DELETE CASCADE,
  predicted_value TEXT NOT NULL DEFAULT 'Sem palpite informado',
  amount INTEGER NOT NULL CHECK (amount > 0),
  is_correct INTEGER CHECK (is_correct IN (0, 1) OR is_correct IS NULL),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, bet_id)
);

CREATE TABLE IF NOT EXISTS combos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stake INTEGER NOT NULL CHECK (stake > 0),
  bonus_multiplier REAL NOT NULL DEFAULT 1.00,
  final_odds REAL NOT NULL DEFAULT 1.00,
  potential_payout INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS combo_legs (
  id TEXT PRIMARY KEY,
  combo_id TEXT NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  bet_id TEXT NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  bet_option_id TEXT NOT NULL REFERENCES bet_options(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (combo_id, bet_id)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_bet_options_bet_id ON bet_options(bet_id);
CREATE INDEX IF NOT EXISTS idx_predictions_bet_id ON predictions(bet_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_combos_user_id ON combos(user_id);
CREATE INDEX IF NOT EXISTS idx_combo_legs_combo_id ON combo_legs(combo_id);
CREATE INDEX IF NOT EXISTS idx_combo_legs_bet_id ON combo_legs(bet_id);
