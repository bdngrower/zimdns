/**
 * GET /api/agent/config
 *
 * Retorna a configuração atual do device para o agente.
 * Chamado periodicamente pelo agente (a cada 5min) para detectar:
 *   - mudança de doh_url (atualização dinâmica sem reinstalação)
 *   - revogação do device (revoked: true → agente encerra DNS stub)
 *
 * Auth: Bearer device_token
 */
import { authenticateDevice, getServiceRoleClient, agentError } from './_agentAuth';

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const supabase = getServiceRoleClient();

    try {
        const device = await authenticateDevice(req, supabase);

        const dohUrl = process.env.ZIMDNS_DOH_URL ?? '';

        return res.status(200).json({
            revoked: false,
            doh_url: dohUrl,
            heartbeat_interval_seconds: 60,
            inventory_interval_seconds: 3600,
            config_poll_interval_seconds: 300,
        });

    } catch (err: any) {
        // authenticateDevice lança com statusCode em casos de revogação
        const status = err.statusCode ?? 500;

        // Caso especial: device revogado - retornar 200 com revoked:true
        // para que o agente possa detectar e agir graciosamente
        if (status === 403 && err.message === 'Device revogado') {
            return res.status(200).json({
                revoked: true,
                doh_url: '',
                heartbeat_interval_seconds: 60,
                inventory_interval_seconds: 3600,
                config_poll_interval_seconds: 300,
            });
        }

        return agentError(res, status, err.message);
    }
}
