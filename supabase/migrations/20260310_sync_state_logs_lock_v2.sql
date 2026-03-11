-- Migration: Adicionar lock especifico para ingestão de logs
-- Task ID: 1274

INSERT INTO sync_state (id, is_running, started_at)
VALUES (2, false, null)
ON CONFLICT (id) DO NOTHING;
