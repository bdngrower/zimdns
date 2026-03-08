import { createClient } from '@supabase/supabase-js';

// Route to fetch global DNS statistics from the newly created dns_events table
export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ success: false, message: 'Missing Supabase variables.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // 1. Total events in the last 24h
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const { count: totalQueries, error: qErr } = await supabase
            .from('dns_events')
            .select('*', { count: 'exact', head: true })
            .gte('timestamp', yesterday.toISOString());

        // 2. Total blocked
        const { count: totalBlocked, error: bErr } = await supabase
            .from('dns_events')
            .select('*', { count: 'exact', head: true })
            .eq('action', 'blocked')
            .gte('timestamp', yesterday.toISOString());

        // 3. Top blocked domains (Approximated with RPC if it existed, for now using raw data to build a quick summary)
        // Ideal: a database View or RPC. We will fetch recent blocks and group them in memory for this endpoint if no RPC.
        const { data: recentBlocks, error: blocksErr } = await supabase
            .from('dns_events')
            .select('domain')
            .eq('action', 'blocked')
            .order('timestamp', { ascending: false })
            .limit(500);

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

        return res.status(200).json({
            success: true,
            stats: {
                totalQueries24h: totalQueries || 0,
                totalBlocked24h: totalBlocked || 0,
                topDomains
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
