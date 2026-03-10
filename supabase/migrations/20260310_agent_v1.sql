-- ==========================================================================
-- ZIM DNS Agent v1 — Migration (v2.0 — corrigida)
-- Criado em: 2026-03-10
-- Aplicar via Supabase MCP, não pelo SQL Editor manual.
--
-- Tabelas: enrollment_tokens, devices, device_heartbeats,
--          device_inventory_snapshots, device_telemetry_events
--
-- device_dns_logs: NÃO incluída nesta migration — programada para v1.1.
-- O log DNS por device é gerado server-side pelo DoH Proxy, não pelo agente.
-- ==========================================================================

-- ENUMs
CREATE TYPE device_status AS ENUM ('active', 'revoked', 'inactive');

CREATE TYPE telemetry_event_type AS ENUM (
  'dns_status_change',
  'doh_status_change',
  'network_change',
  'bypass_attempt',
  'agent_error',
  'service_restart',
  'policy_applied'
);

-- ==========================================================================
-- 1. ENROLLMENT_TOKENS
-- Bootstrap tokens temporários gerados pelo admin no painel.
-- SEGURANÇA: token_hash = SHA-256 do token real.
--            token_prefix = primeiros 10 chars para auditoria/log (sem valor secreto).
--            O token real NUNCA é armazenado em texto claro.
-- ==========================================================================
CREATE TABLE enrollment_tokens (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token_hash       TEXT NOT NULL UNIQUE,   -- SHA-256(token_real)
  token_prefix     TEXT NOT NULL,           -- ex: "bt_a1b2c3ef" — apenas para auditoria
  label            TEXT,                    -- ex: "Deploy Escola Municipal X"
  client_policy_id UUID REFERENCES client_policies(id) ON DELETE SET NULL,
  -- FK estrutural. NULL = device herda policies gerais do client.
  expires_at       TIMESTAMPTZ NOT NULL,
  max_uses         INTEGER DEFAULT 1,       -- NULL = ilimitado
  used_count       INTEGER DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'active', -- active | consumed | revoked | expired
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================================
-- 2. DEVICES
-- Dispositivos enrollados com credencial própria.
-- SEGURANÇA: device_token_hash = SHA-256 do token real.
--            device_token_prefix = primeiros 10 chars para auditoria.
--            O token real NUNCA é armazenado em texto claro.
-- POLICY: client_policy_id é FK estrutural para client_policies.
--         NULL = device herda policies gerais do client (comportamento v1).
--         Preenchido = override de policy por device (habilitado em v1.1+).
-- ==========================================================================
CREATE TABLE devices (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id             UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  enrollment_token_id   UUID REFERENCES enrollment_tokens(id) ON DELETE SET NULL,
  device_token_hash     TEXT NOT NULL UNIQUE,  -- SHA-256(token_real)
  device_token_prefix   TEXT NOT NULL,          -- primeiros 10 chars para auditoria
  hostname              TEXT NOT NULL,
  hardware_id           TEXT,                   -- Serial / UUID de hardware/BIOS
  os_name               TEXT,
  os_version            TEXT,
  architecture          TEXT,
  manufacturer          TEXT,
  model                 TEXT,
  agent_version         TEXT,
  client_policy_id      UUID REFERENCES client_policies(id) ON DELETE SET NULL,
  status                device_status NOT NULL DEFAULT 'active',
  last_seen_at          TIMESTAMPTZ,
  enrolled_at           TIMESTAMPTZ DEFAULT NOW(),
  revoked_at            TIMESTAMPTZ,
  revoked_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================================
-- 3. DEVICE_HEARTBEATS (append-only)
-- Tier 2: Saúde operacional — dns_stub_ok, doh_ok, doh_latency_ms, service_status
-- Tier 3: Contexto de rede — network_type, network_ssid, public_ip
--   [SENSÍVEL] Tier 3 exposto no painel apenas para super_admin e tecnico.
--   Retenção sugerida: 30 dias.
-- ==========================================================================
CREATE TABLE device_heartbeats (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agent_version   TEXT,
  -- Tier 2: Saúde operacional
  dns_stub_ok     BOOLEAN,
  doh_ok          BOOLEAN,
  doh_latency_ms  INTEGER,
  service_status  TEXT,                -- running | degraded | stopped
  -- Tier 3: Contexto de rede (sensível)
  network_type    TEXT,                -- wifi | ethernet | cellular | vpn | unknown
  network_ssid    TEXT,
  public_ip       TEXT,
  received_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================================
-- 4. DEVICE_INVENTORY_SNAPSHOTS
-- Tier 1: Inventário de hardware e OS. Baixo risco de privacidade.
-- Enviado na primeira conexão e a cada 1h ou sob demanda via config.
-- ==========================================================================
CREATE TABLE device_inventory_snapshots (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id      UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  hostname       TEXT,
  os_name        TEXT,
  os_version     TEXT,
  architecture   TEXT,
  manufacturer   TEXT,
  model          TEXT,
  cpu            TEXT,
  ram_total_gb   NUMERIC(8,2),
  disk_total_gb  NUMERIC(8,2),
  disk_free_gb   NUMERIC(8,2),
  hardware_id    TEXT,
  agent_version  TEXT,
  snapshot_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================================
-- 5. DEVICE_TELEMETRY_EVENTS
-- Eventos operacionais do agente. Batch de até 100 por request.
-- Retenção sugerida: 90 dias.
-- ==========================================================================
CREATE TABLE device_telemetry_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  event_type  telemetry_event_type NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'info',  -- info | warn | error | critical
  message     TEXT,
  details     JSONB,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================================
-- ÍNDICES
-- ==========================================================================
CREATE INDEX idx_enrollment_tokens_client_id ON enrollment_tokens(client_id);
CREATE INDEX idx_enrollment_tokens_status ON enrollment_tokens(status);

CREATE INDEX idx_devices_client_id ON devices(client_id);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_last_seen_at ON devices(last_seen_at DESC);

CREATE INDEX idx_device_heartbeats_device_id ON device_heartbeats(device_id);
CREATE INDEX idx_device_heartbeats_received_at ON device_heartbeats(received_at DESC);

CREATE INDEX idx_device_inventory_snapshots_device_id ON device_inventory_snapshots(device_id);
CREATE INDEX idx_device_inventory_snapshots_snapshot_at ON device_inventory_snapshots(snapshot_at DESC);

CREATE INDEX idx_device_telemetry_events_device_id ON device_telemetry_events(device_id);
CREATE INDEX idx_device_telemetry_events_occurred_at ON device_telemetry_events(occurred_at DESC);

-- ==========================================================================
-- TRIGGER updated_at
-- ==========================================================================
CREATE TRIGGER tr_devices_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ==========================================================================
-- RLS
-- Todos os endpoints de agente usam o backend server-side com service_role_key,
-- que bypassa RLS. As políticas abaixo protegem acesso do painel (usuário autenticado).
-- ==========================================================================
ALTER TABLE enrollment_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_telemetry_events ENABLE ROW LEVEL SECURITY;

-- Helper: retorna client_ids acessíveis ao usuário autenticado
-- (técnico responsável OU membro via client_users)
CREATE OR REPLACE FUNCTION accessible_client_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE AS $$
  SELECT id FROM clients WHERE technical_id = auth.uid()
  UNION
  SELECT client_id FROM client_users WHERE user_id = auth.uid()
$$;

CREATE POLICY "Select enrollment_tokens by client" ON enrollment_tokens
  FOR SELECT TO authenticated USING (client_id IN (SELECT accessible_client_ids()));

CREATE POLICY "Select devices by client" ON devices
  FOR SELECT TO authenticated USING (client_id IN (SELECT accessible_client_ids()));

CREATE POLICY "Select device_heartbeats by client" ON device_heartbeats
  FOR SELECT TO authenticated USING (client_id IN (SELECT accessible_client_ids()));

CREATE POLICY "Select device_inventory_snapshots by client" ON device_inventory_snapshots
  FOR SELECT TO authenticated USING (client_id IN (SELECT accessible_client_ids()));

CREATE POLICY "Select device_telemetry_events by client" ON device_telemetry_events
  FOR SELECT TO authenticated USING (client_id IN (SELECT accessible_client_ids()));
