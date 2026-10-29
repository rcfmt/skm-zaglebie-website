CREATE TABLE model_photos (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL UNIQUE,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 2),
  created_at TEXT NOT NULL,
  UNIQUE (model_id, position)
);

CREATE INDEX idx_model_photos_model ON model_photos(model_id, position);

INSERT INTO model_photos (id, model_id, storage_key, position, created_at)
SELECT id, id, cover_key, 0, created_at
FROM models
WHERE cover_key IS NOT NULL AND cover_key <> '';
