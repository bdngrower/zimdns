-- Migration para instanciar a tabela de eventos e telemetria (Fase 9)

CREATE TABLE IF NOT EXISTS public.dns_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    query_type TEXT,
    action TEXT NOT NULL,
    rule TEXT,
    source_ip TEXT,
    latency_ms INTEGER,
    event_hash TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dns_events_client_id ON public.dns_events(client_id);
CREATE INDEX idx_dns_events_timestamp ON public.dns_events(timestamp DESC);
CREATE INDEX idx_dns_events_action ON public.dns_events(action);

-- Enable RLS
ALTER TABLE public.dns_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Enable read access for all authenticated users" 
ON "public"."dns_events"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users (and the service role via API) to insert
CREATE POLICY "Enable insert for authenticated users only" 
ON "public"."dns_events"
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (true);

-- (Opcional/Limpeza) Garantir acesso da role anônima se usar pgtap/edge functions abertas, mas o ideal é que a Vercel opere usando service_role_key ao injetar.
