/**
 * POST /api/agent/enroll
 *
 * Enrollment inicial do dispositivo. Consome o bootstrap token e emite
 * uma credencial permanente (device_token) para o device.
 *
 * O device_token_raw é retornado UMA ÚNICA VEZ nesta resposta.
 * O banco armazena somente device_token_hash (SHA-256).
 *
 * Auth: enrollment_token no body (sem JWT — agente ainda não tem credencial).
 */
import { getServiceRoleClient, generateToken, sha256 } from './_agentAuth';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const {
        enrollment_token,
        hostname,
        hardware_id,
        os_name,
        os_version,
        architecture,
        manufacturer,
        model,
        agent_version,
    } = req.body ?? {};

    if (!enrollment_token) {
        return res.status(400).json({ error: 'enrollment_token é obrigatório' });
    }
    if (!hostname) {
        return res.status(400).json({ error: 'hostname é obrigatório' });
    }

    const supabase = getServiceRoleClient();

    try {
        const tokenHash = sha256(enrollment_token);

        // 1. Buscar enrollment token pelo hash
        const { data: tokenRow, error: tokenErr } = await supabase
            .from('enrollment_tokens')
            .select('id, client_id, client_policy_id, status, expires_at, max_uses, used_count')
            .eq('token_hash', tokenHash)
            .maybeSingle();

        if (tokenErr) {
            console.error('[enroll] Token lookup error:', tokenErr);
            return res.status(500).json({ error: 'Erro interno ao validar token' });
        }

        if (!tokenRow) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        // 2. Validações de token
        if (tokenRow.status === 'revoked') {
            return res.status(410).json({ error: 'Token revogado' });
        }
        if (tokenRow.status === 'consumed') {
            return res.status(429).json({ error: 'Limite de usos do token atingido' });
        }
        if (new Date(tokenRow.expires_at) < new Date()) {
            // Atualizar status para expired
            await supabase.from('enrollment_tokens').update({ status: 'expired' }).eq('id', tokenRow.id);
            return res.status(400).json({ error: 'Token expirado' });
        }
        if (tokenRow.max_uses !== null && tokenRow.used_count >= tokenRow.max_uses) {
            await supabase.from('enrollment_tokens').update({ status: 'consumed' }).eq('id', tokenRow.id);
            return res.status(429).json({ error: 'Limite de usos do token atingido' });
        }

        // 3. Gerar device_token permanente
        const { raw: deviceTokenRaw, hash: deviceTokenHash, prefix: deviceTokenPrefix } = generateToken('tok_');

        // 4. Criar device
        const { data: device, error: deviceErr } = await supabase
            .from('devices')
            .insert({
                client_id: tokenRow.client_id,
                enrollment_token_id: tokenRow.id,
                device_token_hash: deviceTokenHash,
                device_token_prefix: deviceTokenPrefix,
                hostname,
                hardware_id: hardware_id ?? null,
                os_name: os_name ?? null,
                os_version: os_version ?? null,
                architecture: architecture ?? null,
                manufacturer: manufacturer ?? null,
                model: model ?? null,
                agent_version: agent_version ?? null,
                client_policy_id: tokenRow.client_policy_id ?? null,
                status: 'active',
                enrolled_at: new Date().toISOString(),
            })
            .select('id')
            .single();

        if (deviceErr) {
            console.error('[enroll] Device insert error:', deviceErr);
            return res.status(500).json({ error: 'Erro ao registrar device' });
        }

        // 5. Incrementar used_count / marcar consumed se atingiu limite
        const newUsedCount = tokenRow.used_count + 1;
        const newStatus = (tokenRow.max_uses !== null && newUsedCount >= tokenRow.max_uses)
            ? 'consumed'
            : 'active';

        await supabase.from('enrollment_tokens').update({
            used_count: newUsedCount,
            status: newStatus,
        }).eq('id', tokenRow.id);

        // 6. Audit log
        await supabase.from('audit_logs').insert({
            client_id: tokenRow.client_id,
            action: 'device_enrolled',
            entity_type: 'device',
            entity_id: device.id,
            details: { hostname, agent_version, enrollment_token_id: tokenRow.id },
        });

        const dohUrl = process.env.ZIMDNS_DOH_URL ?? '';

        return res.status(200).json({
            device_id: device.id,
            device_token: deviceTokenRaw,   // ← retornado uma única vez
            doh_url: dohUrl,
            heartbeat_interval_seconds: 60,
            inventory_interval_seconds: 3600,
            config_poll_interval_seconds: 300,
        });

    } catch (err: any) {
        console.error('[enroll] Unexpected error:', err);
        return res.status(500).json({ error: err.message });
    }
}
