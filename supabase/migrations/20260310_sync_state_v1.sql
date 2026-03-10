CREATE TABLE IF NOT EXISTS sync_state (
    id integer PRIMARY KEY,
    is_running boolean NOT NULL DEFAULT false,
    started_at timestamptz
);

INSERT INTO sync_state (id, is_running) VALUES (1, false) ON CONFLICT (id) DO NOTHING;
