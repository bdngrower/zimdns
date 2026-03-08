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

        // Helper para extrair o IP com base em Regex mais seguro e strings sujas.
        const extractIp = (clientStr: string) => {
            if (!clientStr) return '';
            // Match para IPv4 ou IPv6 soltos no texto original:
            const ipMatch = clientStr.match(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/);
            if (ipMatch) return ipMatch[0];

            // Fallback velho: (ip) 
            const parenMatch = clientStr.match(/\((.*?)\)/);
            if (parenMatch && parenMatch[1]) {
                return parenMatch[1].trim();
            }
            return clientStr.trim();
        };

        const isClientMatch = (log: any, ips: Set<string>) => {
            const clientFieldValue = log.client || '';
            const clientIpFieldValue = log.client_ip || '';
            const extractedIp = extractIp(clientFieldValue);

            for (const validIp of Array.from(ips)) {
                if (
                    validIp === clientIpFieldValue ||
                    validIp === extractedIp ||
                    validIp === clientFieldValue ||
                    clientFieldValue.includes(validIp)
                ) {
                    return true;
                }
            }
            return false;
        };

        // Objeto para Tracking explícito do Frontend
        const _debug = {
            clientId,
            registeredOrigins: Array.from(validIps),
            rawQuerylogCount: allLogs.length,
            rawQuerylogSample: allLogs.slice(0, 3), // Pegar as tres primeiras pra printar na tela caso queiramos.
            extractedIpsSample: allLogs.slice(0, 10).map((l: any) => extractIp(l.client || '')),
            matchedLogsCount: 0
        };

        if (allLogs.length > 0) {
            console.log("🟢 ZIM DNS Debug - RAW QUERYLOG SAMPLE (Logs API):", JSON.stringify(allLogs[0], null, 2));
            console.log(" IPs Validos do Cliente:", Array.from(validIps).join(', '));
        }

        // Filtrar apenas originados pelos IPs do cliente atual
        const filteredLogs = allLogs.filter((log: any) => isClientMatch(log, validIps));

        _debug.matchedLogsCount = filteredLogs.length;

        console.log(` Matches encontrados: ${filteredLogs.length} / ${allLogs.length}`);

        return res.status(200).json({
            success: true,
            _debug,
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
