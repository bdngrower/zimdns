import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { clientId } = req.query;
    if (!clientId) {
        return res.status(400).json({ error: 'Missing clientId' });
    }

    // Declara variável para controle de lock
    let lockAcquired = false;
    const startedAt = new Date().toISOString();

    let supabase;
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ success: false, message: 'Faltam váriaveis de ambiente do Supabase.' });
    }

    try {
        supabase = createClient(supabaseUrl, supabaseKey);

        // ---------------------------------------------------------------
        // PASSO 0: Adquirir Lock Atômico para Ingestão de Logs (ID 2)
        // ---------------------------------------------------------------
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: lockData, error: lockErr } = await supabase
            .from('sync_state')
            .update({ is_running: true, started_at: startedAt })
            .eq('id', 2)
            .or(`is_running.eq.false,started_at.lt.${fiveMinutesAgo}`)
            .select();

        if (lockErr) {
            console.error("Erro ao adquirir lock de logs:", lockErr);
            return res.status(500).json({ success: false, message: 'Erro interno ao verificar concorrência de logs.' });
        }

        if (!lockData || lockData.length === 0) {
            console.warn(`[AdGuard Logs] Ingestão já está em execução. Abortando request para client ${clientId}.`);
            return res.status(409).json({ success: false, message: 'logs ingestion already running' });
        }

        lockAcquired = true;

        const adguardUrl = process.env.ADGUARD_API_URL;
        const adguardUser = process.env.ADGUARD_USERNAME;
        const adguardPass = process.env.ADGUARD_PASSWORD;

        if (!adguardUrl) throw new Error("ADGUARD_API_URL não configurado");

        // 1. Obter IPs atrelados a este cliente
        const { data: networks, error: netErr } = await supabase
            .from('client_networks')
            .select('value, resolved_ip, type')
            .eq('client_id', clientId)

        if (netErr) throw new Error("Erro ao buscar origens: " + netErr.message);

        const validIps = new Set<string>();
        if (networks) {
            networks.forEach((n: any) => {
                if (n.type === 'ip' && n.value) validIps.add(n.value);
                if (n.type === 'dyndns' && n.resolved_ip) validIps.add(n.resolved_ip);
            });
        }

        if (validIps.size === 0) {
            return res.status(200).json({
                success: true,
                logs: [],
                message: 'Nenhuma origem de rede válida associada ao cliente.',
                _debug: {
                    buildTag: "debug-logs-v4",
                    clientId,
                    sourceTableUsed: "client_networks",
                    networkRowsFound: networks ? networks.length : 0,
                    networkRowsRaw: networks || [],
                    dbError: netErr ? (netErr as any).message || netErr : null,
                    errorMessage: "No valid IPs found for client in database",
                    stepFailed: "fetch_networks"
                }
            });
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

        // Helper para extrair o device_id de tags tipo zimdns-dev-<uuid>
        const extractDeviceId = (clientStr: string) => {
            if (!clientStr) return null;
            const match = clientStr.match(/zimdns-dev-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
            return match ? match[1] : null;
        };

        const isClientMatch = (log: any, ips: Set<string>) => {
            const clientFieldValue = log.client || '';
            const clientIpFieldValue = log.client_ip || '';
            const extractedIp = extractIp(clientFieldValue);
            const taggedDeviceId = extractDeviceId(clientFieldValue);

            // Se tiver device_id tagueado, ja é um match imediato (veio do nosso proxy)
            if (taggedDeviceId) return true;

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
        const _debug: any = {
            buildTag: "debug-logs-v3-devid",
            clientId,
            sourceTableUsed: "client_networks",
            networkRowsFound: networks ? networks.length : 0,
            networkRowsRaw: networks || [],
            dbError: netErr ? (netErr as any).message || netErr : null,
            registeredOrigins: Array.from(validIps),
            rawLogCount: allLogs.length,
            rawSample: allLogs.slice(0, 3), 
            parsedIps: allLogs.slice(0, 10).map((l: any) => extractIp(l.client || '')),
            matchedCount: 0
        };

        if (allLogs.length > 0) {
            console.log("🟢 ZIM DNS Debug - RAW QUERYLOG SAMPLE:", JSON.stringify(allLogs[0], null, 2));
        }

        // Filtrar apenas originados pelos IPs do cliente atual ou que tenham tag do ZimDNS
        const filteredLogs = allLogs.filter((log: any) => isClientMatch(log, validIps));

        _debug.matchedCount = filteredLogs.length;

        // Padronizar a resposta para garantir que o front-end sempre encontre o Domínio
        const formattedLogs = filteredLogs.map((log: any) => {
            const devId = extractDeviceId(log.client || '');
            return {
                ...log,
                queriedDomain: log.question?.host || log.question?.name || log.question?.qname || log.host || 'Desconhecido',
                queryType: log.question?.type || '-',
                deviceId: devId
            };
        });

        // ==========================================
        // SaaS Telemetry Pipeline (Ingestion)
        // ==========================================
        const ingestionDebug = {
            attempted: false,
            eventsPrepared: 0,
            insertedCount: 0,
            supabaseModeUsed: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon',
            errors: [] as any[]
        };

        try {
            const crypto = await import('crypto');

            let totalQueriesToCount = 0;
            let totalBlockedToCount = 0;
            const logDateRaw = new Date().toISOString().split('T')[0];

            const dbEvents = formattedLogs.map((log: any) => {
                const timestamp = log.time;
                const domain = log.queriedDomain;
                const source_ip = extractIp(log.client_ip || log.client || '');
                const client_id = clientId;
                const device_id = log.deviceId || null;

                const action = log.reason === 'NotFiltered' || log.reason === '' ? 'processed' : 'blocked';

                totalQueriesToCount++;
                if (action === 'blocked') totalBlockedToCount++;

                const event_hash = crypto.createHash('sha256')
                    .update(`${timestamp}-${domain}-${source_ip}-${client_id}-${device_id || 'none'}`)
                    .digest('hex');

                return {
                    timestamp,
                    client_id,
                    domain,
                    query_type: log.queryType,
                    action,
                    rule: log.rule || log.reason || null,
                    source_ip,
                    latency_ms: Math.round(parseFloat(log.elapsedMs || 0)),
                    event_hash,
                    device_id
                };
            }).filter((ev: any) => ev.client_id !== null); // Mantemos todos, inclusive 'processed', para estatísticas precisas

            ingestionDebug.eventsPrepared = dbEvents.length;

            const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;
            const supabaseAdmin = createClient(supabaseUrl, adminKey);

            if (dbEvents.length > 0) {
                ingestionDebug.attempted = true;

                const { data: insertedData, error: ingestErr } = await supabaseAdmin
                    .from('dns_events')
                    .upsert(dbEvents, { onConflict: 'event_hash', ignoreDuplicates: true })
                    .select('id');

                if (ingestErr) {
                    console.error("🔴 ZIM DNS Telemetry Ingestion Error:", ingestErr);
                    ingestionDebug.errors.push(ingestErr);
                } else {
                    // Aqui está o segredo: insertedData contém APENAS os registros que não foram ignorados (novos)
                    ingestionDebug.insertedCount = insertedData ? insertedData.length : 0;

                    // Calculamos o real delta de queries total e blocked vindo de NOVOS registros
                    const newQueriesCount = insertedData ? insertedData.length : 0;
                    const newBlockedCount = insertedData ? insertedData.filter((d: any) => d.action === 'blocked').length : 0;

                    // 2. Daily Stats Aggregation Upsert (apenas se houver novos dados)
                    if (newQueriesCount > 0) {
                        const { data: existingStat } = await supabaseAdmin
                            .from('dns_stats_daily')
                            .select('id, queries_total, blocked_total')
                            .eq('client_id', clientId)
                            .eq('date', logDateRaw)
                            .maybeSingle();

                        const upsertStat = {
                            client_id: clientId,
                            date: logDateRaw,
                            queries_total: (existingStat?.queries_total || 0) + newQueriesCount,
                            blocked_total: (existingStat?.blocked_total || 0) + newBlockedCount
                        };

                        const { error: statErr } = await supabaseAdmin
                            .from('dns_stats_daily')
                            .upsert(upsertStat, { onConflict: 'client_id, date' });

                        if (statErr) {
                            console.error("🔴 ZIM DNS Daily Stats Update Error:", statErr);
                        }
                    }
                }
            }

        } catch (ingestionError: any) {
            console.error("🔴 ZIM DNS Telemetry Generic Pipeline Error:", ingestionError);
            ingestionDebug.errors.push(ingestionError.message || ingestionError);
        }

        // Incorpora os logs de debug no retorno
        _debug.ingestion = ingestionDebug;

        return res.status(200).json({
            success: true,
            _debug,
            logs: formattedLogs.slice(0, 150) // limite razoavel p/ o front
        });

    } catch (error: any) {
        console.error('DNS Logs Error:', error);
        return res.status(500).json({
            success: false,
            message: error?.message || 'Erro interno ao buscar logs',
            _debug: {
                buildTag: "debug-logs-v3",
                clientId,
                errorMessage: error?.message || 'Unknown error',
                stepFailed: "exception_catch"
            }
        });
    } finally {
        if (supabase && lockAcquired) {
            await supabase
                .from('sync_state')
                .update({ is_running: false, started_at: null })
                .eq('id', 2);
            console.log(`[AdGuard Logs] Ingestion Lock (ID 2) released.`);
        }
    }
}
