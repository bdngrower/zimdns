/**
 * POST /api/agent/enrollment-tokens
 *
 * Admin cria um bootstrap token para um client do ZIM DNS.
 * O token real é retornado UMA ÚNICA VEZ nesta resposta.
 * O banco armazena somente token_hash (SHA-256) e token_prefix (10 chars).
 *
 * Auth: JWT Supabase do usuário autenticado no painel.
 */
import { getServiceRoleClient, generateToken } from './_agentAuth';

export default async function handler(req: any, res: any) {
    if (req.method === 'GET') return handleGet(req, res);
    if (req.method === 'POST') return handlePost(req, res);
    return res.status(405).json({ error: 'Method Not Allowed' });
}

// POST — Gera novo enrollment token
async function handlePost(req: any, res: any) {
    const supabase = getServiceRoleClient();

    const {
        client_id,
        label,
        client_policy_id,
        expires_in_hours = 24,
        max_uses = 1,
        created_by,
    } = req.body ?? {};

    if (!client_id) {
        return res.status(400).json({ error: 'client_id é obrigatório' });
    }
    if (!Number.isInteger(expires_in_hours) || expires_in_hours < 1) {
        return res.status(400).json({ error: 'expires_in_hours inválido' });
    }

    try {
        const { raw, hash, prefix } = generateToken('bt_');

        const expiresAt = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabase.from('enrollment_tokens').insert({
            client_id,
            token_hash: hash,
            token_prefix: prefix,
            label: label ?? null,
            client_policy_id: client_policy_id ?? null,
            expires_at: expiresAt,
            max_uses: max_uses ?? 1,
            used_count: 0,
            status: 'active',
            created_by: created_by ?? null,
        }).select('id, token_prefix, expires_at, max_uses, status').single();

        if (error) {
            console.error('[enrollment-tokens] Insert error:', error);
            return res.status(500).json({ error: 'Erro ao criar enrollment token' });
        }

        const dohUrl = process.env.ZIMDNS_DOH_URL ?? '';
        const installCommand = `zimdns-agent-setup.exe /SILENT /BOOTSTRAP_URL=${dohUrl ? dohUrl.replace('/dns-query', '') : 'https://<doh-hostname>'}/api/agent/enroll?token=${raw}`;

        return res.status(200).json({
            token_id: data.id,
            enrollment_token: raw,       // ← retornado uma única vez
            token_prefix: data.token_prefix,
            expires_at: data.expires_at,
            max_uses: data.max_uses,
            install_command: installCommand,
        });
    } catch (err: any) {
        console.error('[enrollment-tokens] Unexpected error:', err);
        return res.status(500).json({ error: err.message });
    }
}

// GET — Lista tokens de um client
async function handleGet(req: any, res: any) {
    const supabase = getServiceRoleClient();
    const { client_id } = req.query;

    if (!client_id) {
        return res.status(400).json({ error: 'client_id é obrigatório' });
    }

    const { data, error } = await supabase
        .from('enrollment_tokens')
        .select('id, token_prefix, label, client_policy_id, expires_at, max_uses, used_count, status, created_by, created_at')
        .eq('client_id', client_id)
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ tokens: data });
}
