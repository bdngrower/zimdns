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
        // 1. Total events in the last 24h
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        _debug.queryTimeWindow = yesterday.toISOString();

        const { count: totalQueries, error: qErr } = await supabase
            .from('dns_events')
            .select('*', { count: 'exact', head: true })
            .gte('timestamp', yesterday.toISOString());

        if (qErr) _debug.errors.push({ query: 'totalQueries', error: qErr });
        _debug.totalEventsRead = totalQueries || 0;

        // 2. Fetch raw events for time-series generation (Limited scale to represent chart)
        const { data: rawSeriesData, error: seriesErr } = await supabase
            .from('dns_events')
            .select('timestamp, action')
            .gte('timestamp', yesterday.toISOString())
            .order('timestamp', { ascending: true }) // Ascending for chronological charting
            .limit(5000); // Fetch up to 5k for reasonable memory grouping 

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
                    timeSeriesMap[hourKey].queries++;
                    if (ev.action === 'blocked') {
                        timeSeriesMap[hourKey].blocks++;
                    }
                }
            });
        }

        const chartSeries = Object.entries(timeSeriesMap).map(([time, data]) => ({
            time,
            queries: data.queries,
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

        let totalBlockedCount = 0;
        chartSeries.forEach(s => totalBlockedCount += s.blocks);
        _debug.blockedEventsRead = totalBlockedCount;

        return res.status(200).json({
            success: true,
            _debug,
            stats: {
                totalQueries24h: totalQueries || 0,
                totalBlocked24h: totalBlockedCount,
                topDomains,
                chartSeries
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
