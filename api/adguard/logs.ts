import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { clientId } = req.query;
    if (!clientId) {
        return res.status(400).json({ error: 'Missing clientId' });
    }

    let supabase;
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ success: false, message: 'Faltam váriaveis de ambiente do Supabase.' });
    }

    try {
        supabase = createClient(supabaseUrl, supabaseKey);

        const adguardUrl = process.env.ADGUARD_API_URL;
        const adguardUser = process.env.ADGUARD_USERNAME;
        const adguardPass = process.env.ADGUARD_PASSWORD;

        if (!adguardUrl) throw new Error("ADGUARD_API_URL não configurado");

        // 1. Obter IPs atrelados a este cliente
        const { data: networks, error: netErr } = await supabase
            .from('client_networks')
            .select('value, resolved_ip, type')
            .eq('client_id', clientId)
            .eq('is_active', true);

        if (netErr) throw new Error("Erro ao buscar origens: " + netErr.message);

        const validIps = new Set<string>();
        if (networks) {
            networks.forEach(n => {
                if (n.type === 'ip' && n.value) validIps.add(n.value);
                if (n.type === 'dyndns' && n.resolved_ip) validIps.add(n.resolved_ip);
            });
        }

        if (validIps.size === 0) {
            return res.status(200).json({ success: true, logs: [], message: 'Nenhuma origem de rede válida associada ao cliente.' });
        }

        const token = Buffer.from(`${adguardUser}:${adguardPass}`).toString('base64');
        const agRes = await fetch(`${adguardUrl}/control/querylog?limit=1000`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${token}`,
                'Accept': 'application/json'
            }
        });

        if (!agRes.ok) {
            const agErrorTxt = await agRes.text();
            throw new Error(`Falha API Adguard Log (HTTP ${agRes.status}): ${agErrorTxt}`);
        }

        const logData = await agRes.json();
        const allLogs = logData.data || [];

        // Helper para extrair o IP do formato "host (IP)"
        const extractIp = (clientStr: string) => {
            if (!clientStr) return '';
            const match = clientStr.match(/\((.*?)\)/);
            if (match && match[1]) {
                return match[1].trim();
            }
            return clientStr.trim();
        };

        // Filtrar apenas originados pelos IPs do cliente atual
        // Formato log adguard pode ser: "189.55.16.97" ou "bd371061.virtua.com.br (189.55.16.97)"
        const filteredLogs = allLogs.filter((log: any) => validIps.has(extractIp(log.client)));

        return res.status(200).json({
            success: true,
            logs: filteredLogs.slice(0, 150) // limite razoavel p/ o front
        });

    } catch (error: any) {
        console.error('DNS Logs Error:', error);
        return res.status(500).json({
            success: false,
            message: error?.message || 'Erro interno ao buscar logs'
        });
    }
}
