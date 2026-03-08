import { createClient } from '@supabase/supabase-js';

// Route to fetch global DNS statistics from the newly created dns_events table
export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey;

    if (!supabaseUrl || !adminKey) {
        return res.status(500).json({ success: false, message: 'Missing Supabase variables.' });
    }

    const supabase = createClient(supabaseUrl, adminKey);

    const _debug: any = {
        totalEventsRead: 0,
        blockedEventsRead: 0,
        queryTimeWindow: '',
        sourceTableUsed: 'dns_events',
        supabaseModeUsed: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon',
        errors: []
    };

    try {
        // 1. DADOS AGREGADOS (Totais das últimas 24h/Hoje)
        const logDateRaw = new Date().toISOString().split('T')[0];
        _debug.sourceTableUsed = 'dns_stats_daily';

        const { data: dailyStats, error: qErr } = await supabase
            .from('dns_stats_daily')
            .select('queries_total, blocked_total')
            .eq('date', logDateRaw);

        if (qErr) _debug.errors.push({ query: 'dailyStats', error: qErr });

        let totalQueries = 0;
        let totalBlockedCount = 0;

        if (dailyStats && dailyStats.length > 0) {
            dailyStats.forEach(stat => {
                totalQueries += stat.queries_total || 0;
                totalBlockedCount += stat.blocked_total || 0;
            });
        }

        _debug.totalEventsRead = totalQueries;
        _debug.blockedEventsRead = totalBlockedCount;

        // 2. Fetch raw events for time-series generation (Only pulling incidents/blocks to save DB!)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const { data: rawSeriesData, error: seriesErr } = await supabase
            .from('dns_events')
            .select('timestamp, action')
            .gte('timestamp', yesterday.toISOString())
            .order('timestamp', { ascending: true }) // Ascending for chronological charting
            .limit(5000);

        if (seriesErr) _debug.errors.push({ query: 'rawSeriesData', error: seriesErr });

        // Build time-series aggregated by HOUR
        // Produces array of 24 points: { time: "HH:00", queries: number, blocks: number }
        const timeSeriesMap: Record<string, { queries: number, blocks: number }> = {};

        // Initialize last 24h array with 0s to guarantee flat chart line
        for (let i = 23; i >= 0; i--) {
            const d = new Date();
            d.setHours(d.getHours() - i);
            const key = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).split(':')[0] + ':00';
            timeSeriesMap[key] = { queries: 0, blocks: 0 };
        }

        if (rawSeriesData) {
            rawSeriesData.forEach(ev => {
                const hourKey = new Date(ev.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).split(':')[0] + ':00';
                if (timeSeriesMap[hourKey] !== undefined) {
                    // Since we no longer save 'allowed' in dns_events, our 'queries' chart line will only reflect incidents.
                    // For the UI to look good, we map both lines to the incident count or you could hide the queries line.
                    timeSeriesMap[hourKey].queries++;
                    if (ev.action === 'blocked' || ev.action === 'filtered') {
                        timeSeriesMap[hourKey].blocks++;
                    }
                }
            });
        }

        const chartSeries = Object.entries(timeSeriesMap).map(([time, data]) => ({
            time,
            queries: data.queries, // This now reflects security events
            blocks: data.blocks
        }));

        // 3. Top blocked domains (Approximated with RPC if it existed, for now using raw data to build a quick summary)
        // Ideal: a database View or RPC. We will fetch recent blocks and group them in memory for this endpoint if no RPC.
        const { data: recentBlocks, error: blocksErr } = await supabase
            .from('dns_events')
            .select('domain')
            .eq('action', 'blocked')
            .gte('timestamp', yesterday.toISOString())
            .order('timestamp', { ascending: false })
            .limit(1000);

        if (blocksErr) _debug.errors.push({ query: 'recentBlocks', error: blocksErr });

        let topDomains: { domain: string, count: number }[] = [];
        if (recentBlocks) {
            const domainCounts: Record<string, number> = {};
            recentBlocks.forEach(b => {
                domainCounts[b.domain] = (domainCounts[b.domain] || 0) + 1;
            });
            topDomains = Object.entries(domainCounts)
                .map(([domain, count]) => ({ domain, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5); // top 5
        }

        // 4. Busca domínios recém detectados pelas Heurísticas (Auto-Learning)
        const { data: suggestedData, error: suggestedErr } = await supabase
            .from('suggested_domains')
            .select('domain, status, detected_at')
            .order('detected_at', { ascending: false })
            .limit(4);

        if (suggestedErr) _debug.errors.push({ query: 'suggestedData', error: suggestedErr });
        const suggestedDomains = suggestedData || [];

        // 5. Threat Intelligence Global Count (Volume do Firewall)
        const { count: threatCount, error: threatErr } = await supabase
            .from('blocklist_domains')
            .select('*', { count: 'exact', head: true });

        if (threatErr) _debug.errors.push({ query: 'threatCount', error: threatErr });

        return res.status(200).json({
            success: true,
            _debug,
            stats: {
                totalQueries24h: totalQueries || 0,
                totalBlocked24h: totalBlockedCount,
                threatsCataloged: threatCount || 0,
                topDomains,
                chartSeries,
                suggestedDomains
            }
        });

    } catch (error: any) {
        console.error('DNS Stats Global Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error calculating stats'
        });
    }
}
