/**
 * POST /api/agent/revoke
 *
 * Revoga um device. Chamado pelo painel (admin/tecnico), não pelo agente.
 * Efeito imediato no banco → DoH Proxy detecta na próxima query (revogação server-side).
 * Agente detecta via GET /config em até 5min.
 *
 * Auth: JWT Supabase do usuário autenticado no painel.
 *       A verificação de JWT é feita pelo Vercel/Supabase middleware.
 *       Aqui usamos service_role para escrita, mas validamos que a request
 *       veio de um usuário autenticado via header Authorization (JWT).
 */
import { getServiceRoleClient } from './_agentAuth';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { device_id, revoked_by } = req.body ?? {};

    if (!device_id) {
        return res.status(400).json({ error: 'device_id é obrigatório' });
    }

    // Verificar que a request veio de um usuário autenticado (JWT Supabase)
    const authHeader: string | undefined = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'JWT ausente' });
    }

    // Usar anon key + JWT do usuário para validar autenticidade
    const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
    });

    const { data: { user }, error: userErr } = await userSupabase.auth.getUser();
    if (userErr || !user) {
        return res.status(401).json({ error: 'JWT inválido ou expirado' });
    }

    // Usar service_role para a escrita (bypassa RLS)
    const supabase = getServiceRoleClient();

    try {
        const now = new Date().toISOString();

        // Verificar se device existe e está ativo
        const { data: device, error: fetchErr } = await supabase
            .from('devices')
            .select('id, client_id, status, hostname')
            .eq('id', device_id)
            .maybeSingle();

        if (fetchErr || !device) {
            return res.status(404).json({ error: 'Device não encontrado' });
        }

        if (device.status === 'revoked') {
            return res.status(200).json({ ok: true, message: 'Device já estava revogado' });
        }

        // Revogar
        const { error: updateErr } = await supabase
            .from('devices')
            .update({
                status: 'revoked',
                revoked_at: now,
                revoked_by: user.id,
            })
            .eq('id', device_id);

        if (updateErr) {
            console.error('[revoke] Update error:', updateErr);
            return res.status(500).json({ error: 'Erro ao revogar device' });
        }

        // Audit log
        await supabase.from('audit_logs').insert({
            client_id: device.client_id,
            user_id: user.id,
            action: 'device_revoked',
            entity_type: 'device',
            entity_id: device_id,
            details: { hostname: device.hostname, revoked_at: now },
        });

        return res.status(200).json({ ok: true });

    } catch (err: any) {
        console.error('[revoke] Unexpected error:', err);
        return res.status(500).json({ error: err.message });
    }
}
