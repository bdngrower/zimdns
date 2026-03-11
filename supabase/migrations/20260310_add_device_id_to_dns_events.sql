-- Migration: Add device_id to dns_events with composite indexing
-- Date: 2026-03-10
-- Purpose: Enable endpoint-level DNS activity tracking while supporting legacy baseline.

-- 1. Adicionar coluna device_id (nullable por design para suportar Network Mode e dados legados)
ALTER TABLE public.dns_events 
ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES public.devices(id);

-- 2. Criar índice composto para performance em filtros de cliente + dispositivo
-- Este índice cobre:
--   - Busca por dispositivo específico dentro de um cliente (Filter: client_id, device_id)
--   - Busca legado/Network Mode (Filter: client_id, device_id IS NULL)
--   - Ordenação por tempo (timestamp desc)
CREATE INDEX IF NOT EXISTS idx_dns_events_client_device_ts 
ON public.dns_events (client_id, device_id, timestamp DESC);

-- NOTA: O device_id permanece opcional. Eventos sem este campo serão 
-- atribuídos ao contexto geral do cliente (Network Mode Baseline).
