import { createClient } from '@supabase/supabase-js';
import { 
    authenticateDevice, 
    getServiceRoleClient, 
    agentError, 
    sha256, 
    generateToken 
} from './_agentAuth.js';

export default async function handler(req: any, res: any) {
    const { action } = req.query;

    switch (action) {
        case 'config':
            return handleConfig(req, res);
        case 'enroll':
            return handleEnroll(req, res);
        case 'enrollment-tokens':
            return handleEnrollmentTokens(req, res);
        case 'heartbeat':
            return handleHeartbeat(req, res);
        case 'inventory':
            return handleInventory(req, res);
        case 'revoke':
            return handleRevoke(req, res);
        case 'telemetry':
            return handleTelemetry(req, res);
        default:
            return res.status(404).json({ error: `Action '${action}' not found` });
    }
}

// GET /api/agent/config
async function handleConfig(req: any, res: any) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
    const supabase = getServiceRoleClient();
    try {
        await authenticateDevice(req, supabase);
        return res.status(200).json({
            revoked: false,
            doh_url: process.env.ZIMDNS_DOH_URL ?? '',
            heartbeat_interval_seconds: 60,
            inventory_interval_seconds: 3600,
            config_poll_interval_seconds: 300,
        });
    } catch (err: any) {
        const status = err.statusCode ?? 500;
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

// POST /api/agent/enroll
async function handleEnroll(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const {
        enrollment_token, hostname, hardware_id, os_name, os_version,
        architecture, manufacturer, model, agent_version
    } = req.body ?? {};

    if (!enrollment_token || !hostname) {
        return res.status(400).json({ error: 'enrollment_token e hostname são obrigatórios' });
    }

    const supabase = getServiceRoleClient();
    try {
        const tokenHash = sha256(enrollment_token);
        const { data: tokenRow, error: tokenErr } = await supabase
            .from('enrollment_tokens')
            .select('*')
            .eq('token_hash', tokenHash)
            .maybeSingle();

        if (tokenErr) return res.status(500).json({ error: 'Erro interno ao validar token' });
        if (!tokenRow) return res.status(401).json({ error: 'Token inválido' });

        if (tokenRow.status === 'revoked') return res.status(410).json({ error: 'Token revogado' });
        if (tokenRow.status === 'consumed') return res.status(429).json({ error: 'Limite de usos atingido' });
        if (new Date(tokenRow.expires_at) < new Date()) {
            await supabase.from('enrollment_tokens').update({ status: 'expired' }).eq('id', tokenRow.id);
            return res.status(400).json({ error: 'Token expirado' });
        }

        const { raw: deviceTokenRaw, hash: deviceTokenHash, prefix: deviceTokenPrefix } = generateToken('tok_');
        const { data: device, error: deviceErr } = await supabase
            .from('devices')
            .insert({
                client_id: tokenRow.client_id,
                enrollment_token_id: tokenRow.id,
                device_token_hash: deviceTokenHash,
                device_token_prefix: deviceTokenPrefix,
                hostname, hardware_id, os_name, os_version,
                architecture, manufacturer, model, agent_version,
                client_policy_id: tokenRow.client_policy_id,
                status: 'active',
                last_seen_at: new Date().toISOString()
            })
            .select('id').single();

        if (deviceErr) return res.status(500).json({ error: 'Erro ao registrar device' });

        const newUsedCount = tokenRow.used_count + 1;
        const newStatus = (tokenRow.max_uses !== null && newUsedCount >= tokenRow.max_uses) ? 'consumed' : 'active';
        await supabase.from('enrollment_tokens').update({ used_count: newUsedCount, status: newStatus }).eq('id', tokenRow.id);

        return res.status(200).json({
            device_id: device.id,
            device_token: deviceTokenRaw,
            doh_url: process.env.ZIMDNS_DOH_URL ?? '',
            heartbeat_interval_seconds: 60,
            inventory_interval_seconds: 3600,
            config_poll_interval_seconds: 300,
        });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
}

// GET/POST /api/agent/enrollment-tokens
async function handleEnrollmentTokens(req: any, res: any) {
    const method = req.method?.toUpperCase();
    if (method === 'OPTIONS') return res.status(200).end();

    const supabase = getServiceRoleClient();
    try {
        if (method === 'GET') {
            const { client_id } = req.query;
            if (!client_id) return res.status(400).json({ error: 'client_id é obrigatório' });
            const { data, error } = await supabase
                .from('enrollment_tokens')
                .select('*')
                .eq('client_id', client_id)
                .order('created_at', { ascending: false });
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ tokens: data });
        }

        if (method === 'POST') {
            const { client_id, label, client_policy_id, expires_in_hours = 24, max_uses = 1, created_by } = req.body ?? {};
            if (!client_id) return res.status(400).json({ error: 'client_id é obrigatório' });
            const { raw, hash, prefix } = generateToken('bt_');
            const expiresAt = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000).toISOString();
            const { data, error } = await supabase.from('enrollment_tokens').insert({
                client_id, token_hash: hash, token_prefix: prefix, label, client_policy_id,
                expires_at: expiresAt, max_uses, status: 'active', created_by
            }).select('*').single();

            if (error) return res.status(500).json({ error: 'Erro ao criar token' });

            const appBaseUrl = process.env.ZIMDNS_APP_BASE_URL;
            if (!appBaseUrl) return res.status(500).json({ error: 'Configuração ZIMDNS_APP_BASE_URL ausente no servidor' });

            const bootstrapUrl = `${appBaseUrl.replace(/\/$/, '')}/api/agent/enroll?token=${raw}`;
            const installCommand = `zimdns-agent-setup.exe /SILENT /BOOTSTRAP_URL=${bootstrapUrl}`;

            return res.status(200).json({
                token_id: data.id, 
                enrollment_token: raw, 
                token_prefix: data.token_prefix,
                expires_at: data.expires_at, 
                max_uses: data.max_uses,
                bootstrap_url: bootstrapUrl,
                install_command: installCommand
            });
        }

        return res.status(405).json({ error: 'Method Not Allowed' });
    } catch (err: any) {
        console.error('[enrollment-tokens] error:', err);
        return res.status(500).json({ error: err.message });
    }
}

// POST /api/agent/heartbeat
async function handleHeartbeat(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const supabase = getServiceRoleClient();
    try {
        const device = await authenticateDevice(req, supabase);
        const { agent_version, dns_stub_ok, doh_ok, doh_latency_ms, service_status, network_type, network_ssid, public_ip } = req.body ?? {};
        const now = new Date().toISOString();

        await supabase.from('device_heartbeats').insert({
            device_id: device.deviceId, client_id: device.clientId, agent_version,
            dns_stub_ok, doh_ok, doh_latency_ms, service_status, network_type, network_ssid, public_ip, received_at: now
        });

        await supabase.from('devices').update({ last_seen_at: now, agent_version: agent_version ?? undefined }).eq('id', device.deviceId);

        return res.status(200).json({ ok: true });
    } catch (err: any) {
        return agentError(res, err.statusCode ?? 500, err.message);
    }
}

// POST /api/agent/inventory
async function handleInventory(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const supabase = getServiceRoleClient();
    try {
        const device = await authenticateDevice(req, supabase);
        const inventory = req.body ?? {};
        const now = new Date().toISOString();

        await supabase.from('device_inventory_snapshots').insert({
            device_id: device.deviceId, client_id: device.clientId, hostname: inventory.hostname,
            os_name: inventory.os_name, os_version: inventory.os_version, architecture: inventory.architecture,
            manufacturer: inventory.manufacturer, model: inventory.model, cpu: inventory.cpu,
            ram_total_gb: inventory.ram_total_gb, disk_total_gb: inventory.disk_total_gb,
            disk_free_gb: inventory.disk_free_gb, hardware_id: inventory.hardware_id,
            agent_version: inventory.agent_version, snapshot_at: now
        });

        await supabase.from('devices').update({
            hostname: inventory.hostname, os_name: inventory.os_name, os_version: inventory.os_version,
            architecture: inventory.architecture, manufacturer: inventory.manufacturer, model: inventory.model,
            agent_version: inventory.agent_version, hardware_id: inventory.hardware_id, 
            updated_at: now, last_seen_at: now
        }).eq('id', device.deviceId);

        return res.status(200).json({ ok: true });
    } catch (err: any) {
        return agentError(res, err.statusCode ?? 500, err.message);
    }
}

// POST /api/agent/revoke
async function handleRevoke(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const { device_id } = req.body ?? {};
    if (!device_id) return res.status(400).json({ error: 'device_id é obrigatório' });

    const authHeader: string | undefined = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'JWT ausente' });

    const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
    });

    const { data: { user }, error: userErr } = await userSupabase.auth.getUser();
    if (userErr || !user) return res.status(401).json({ error: 'JWT inválido ou expirado' });

    const supabase = getServiceRoleClient();
    try {
        const { data: device } = await supabase.from('devices').select('*').eq('id', device_id).maybeSingle();
        if (!device) return res.status(404).json({ error: 'Device não encontrado' });
        if (device.status === 'revoked') return res.status(200).json({ ok: true });

        const now = new Date().toISOString();
        await supabase.from('devices').update({ status: 'revoked', revoked_at: now, revoked_by: user.id }).eq('id', device_id);

        await supabase.from('audit_logs').insert({
            client_id: device.client_id, user_id: user.id, action: 'device_revoked',
            entity_type: 'device', entity_id: device_id, details: { hostname: device.hostname, revoked_at: now }
        });

        return res.status(200).json({ ok: true });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
}

// POST /api/agent/telemetry
async function handleTelemetry(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const supabase = getServiceRoleClient();
    try {
        const device = await authenticateDevice(req, supabase);
        const { events } = req.body ?? {};
        if (!Array.isArray(events) || events.length === 0) return res.status(200).json({ ok: true });

        const batch = events.slice(0, 100).map((ev: any) => ({
            device_id: device.deviceId, client_id: device.clientId, event_type: ev.event_type,
            severity: ev.severity ?? 'info', message: ev.message, details: ev.details ?? {},
            occurred_at: ev.occurred_at ?? new Date().toISOString(),
            received_at: new Date().toISOString()
        }));

        const { error } = await supabase.from('device_telemetry_events').insert(batch);
        if (error) return res.status(500).json({ error: 'Erro ao processar telemetria' });

        return res.status(200).json({ ok: true, count: batch.length });
    } catch (err: any) {
        return agentError(res, err.statusCode ?? 500, err.message);
    }
}
