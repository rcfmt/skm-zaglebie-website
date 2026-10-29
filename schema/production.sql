PRAGMA foreign_keys = ON;

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_key TEXT,
  google_picture_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  profile_public INTEGER NOT NULL DEFAULT 0 CHECK (profile_public IN (0, 1)),
  approved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  suppress_google_picture INTEGER NOT NULL DEFAULT 0 CHECK (suppress_google_picture IN (0, 1))
);

CREATE TABLE oauth_states (
  state_hash TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  return_to TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE models (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  manufacturer TEXT,
  scale TEXT,
  wingspan TEXT,
  weight TEXT,
  propulsion TEXT,
  motor_engine TEXT,
  esc TEXT,
  battery TEXT,
  propeller TEXT,
  radio TEXT,
  receiver TEXT,
  servos TEXT,
  equipment TEXT,
  description TEXT,
  cover_key TEXT,
  public_visible INTEGER NOT NULL DEFAULT 0 CHECK (public_visible IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  bec TEXT,
  battery_connector TEXT,
  receiver_power TEXT,
  ignition TEXT,
  fuel_system TEXT,
  exhaust_system TEXT,
  stabilization TEXT,
  telemetry TEXT,
  landing_gear TEXT,
  brakes TEXT,
  lighting TEXT,
  smoke_system TEXT,
  fpv_system TEXT,
  auxiliary_systems TEXT,
  build_type TEXT,
  design_source TEXT,
  construction_materials TEXT
);

CREATE TABLE model_photos (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL UNIQUE,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 2),
  created_at TEXT NOT NULL,
  UNIQUE (model_id, position)
);

CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  token_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  invited_by TEXT NOT NULL REFERENCES members(id),
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_oauth_states_expiry ON oauth_states(expires_at);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_models_member ON models(member_id, updated_at);
CREATE INDEX idx_models_public ON models(public_visible, updated_at);
CREATE INDEX idx_model_photos_model ON model_photos(model_id, position);
CREATE INDEX idx_invitations_email ON invitations(email, created_at);
CREATE INDEX idx_invitations_active ON invitations(expires_at, accepted_at, revoked_at);
