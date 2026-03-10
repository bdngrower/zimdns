/**
 * POST /api/agent/inventory
 *
 * Recebe snapshot completo de inventário do hardware e sistema operacional.
 * Chamado no enrollment e a cada 1h.
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

    const inventory = req.body ?? {};
    const now = new Date().toISOString();

    // 1. Inserir snapshot de inventário (histórico)
    const { error: snapErr } = await supabase.from('device_inventory_snapshots').insert({
      device_id: device.deviceId,
      client_id: device.clientId,
      hostname: inventory.hostname ?? null,
      os_name: inventory.os_name ?? null,
      os_version: inventory.os_version ?? null,
      architecture: inventory.architecture ?? null,
      manufacturer: inventory.manufacturer ?? null,
      model: inventory.model ?? null,
      cpu: inventory.cpu ?? null,
      ram_total_gb: inventory.ram_total_gb ?? null,
      disk_total_gb: inventory.disk_total_gb ?? null,
      disk_free_gb: inventory.disk_free_gb ?? null,
      hardware_id: inventory.hardware_id ?? null,
      agent_version: inventory.agent_version ?? null,
      snapshot_at: now,
    });

    if (snapErr) {
      console.error('[inventory] Snapshot Insert error:', snapErr);
    }

    // 2. Atualizar campos denormalizados no record do device para consulta rápida
    const { error: devErr } = await supabase
      .from('devices')
      .update({
        hostname: inventory.hostname ?? undefined,
        os_name: inventory.os_name ?? undefined,
        os_version: inventory.os_version ?? undefined,
        architecture: inventory.architecture ?? undefined,
        manufacturer: inventory.manufacturer ?? undefined,
        model: inventory.model ?? undefined,
        agent_version: inventory.agent_version ?? undefined,
        hardware_id: inventory.hardware_id ?? undefined,
        updated_at: now,
      })
      .eq('id', device.deviceId);

    if (devErr) {
      console.error('[inventory] Device Update error:', devErr);
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return agentError(res, err.statusCode ?? 500, err.message);
  }
}
