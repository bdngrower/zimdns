/**
 * POST /api/agent/telemetry
 *
 * Recebe lote (batch) de eventos de telemetria operacional do agente.
 * Chamado periodicamente (ex: a cada 5min) ou sob demanda.
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

    const { events } = req.body ?? {};

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(200).json({ ok: true, message: 'Nenhum evento processado' });
    }

    // Limitar batch para evitar overload (ex: máx 100 eventos)
    const batch = events.slice(0, 100).map((ev: any) => ({
      device_id: device.deviceId,
      client_id: device.clientId,
      event_type: ev.event_type,
      severity: ev.severity ?? 'info',
      message: ev.message ?? null,
      details: ev.details ?? {},
      occurred_at: ev.occurred_at ?? new Date().toISOString(),
      received_at: new Date().toISOString(),
    }));

    const { error: telErr } = await supabase
      .from('device_telemetry_events')
      .insert(batch);

    if (telErr) {
      console.error('[telemetry] Batch Insert error:', telErr);
      return res.status(500).json({ error: 'Erro ao processar eventos de telemetria' });
    }

    return res.status(200).json({
      ok: true,
      count: batch.length,
    });
  } catch (err: any) {
    return agentError(res, err.statusCode ?? 500, err.message);
  }
}
