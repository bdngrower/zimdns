/**
 * POST /api/agent/heartbeat
 *
 * Recebe sinal de vida periódico (60s) do agente.
 * Atualiza last_seen_at no device e registra o heartbeat no histórico.
 *
 * Auth: Bearer device_token
 */
import { authenticateDevice, getServiceRoleClient, agentError } from './_agentAuth';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabase = getServiceRoleClient();

  try {
    const device = await authenticateDevice(req, supabase);

    const {
      agent_version,
      dns_stub_ok,
      doh_ok,
      doh_latency_ms,
      service_status,
      network_type,
      network_ssid,
      public_ip,
    } = req.body ?? {};

    const now = new Date().toISOString();

    // 1. Inserir no histórico de heartbeats (append-only)
    const { error: hbErr } = await supabase.from('device_heartbeats').insert({
      device_id: device.deviceId,
      client_id: device.clientId,
      agent_version: agent_version ?? null,
      dns_stub_ok: dns_stub_ok ?? null,
      doh_ok: doh_ok ?? null,
      doh_latency_ms: doh_latency_ms ?? null,
      service_status: service_status ?? null,
      network_type: network_type ?? null,
      network_ssid: network_ssid ?? null,
      public_ip: public_ip ?? null,
      received_at: now,
    });

    if (hbErr) {
      console.error('[heartbeat] HB Insert error:', hbErr);
      // Não falhar o request se apenas o log falhar
    }

    // 2. Atualizar last_seen_at no record do device (denormalização para performance)
    const { error: devErr } = await supabase
      .from('devices')
      .update({
        last_seen_at: now,
        agent_version: agent_version ?? undefined, // só atualiza se enviado
      })
      .eq('id', device.deviceId);

    if (devErr) {
      console.error('[heartbeat] Device Update error:', devErr);
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return agentError(res, err.statusCode ?? 500, err.message);
  }
}
