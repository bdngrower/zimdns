import { createClient } from '@supabase/supabase-js';

// Heurísticas de detecção (palavras-chave em domínios que escaparam do block geral)
const HEURISTICS = [
    { keyword: 'facebook', service_id: 'b0000000-0000-0000-0000-000000000003' },
    { keyword: 'fbcdn', service_id: 'b0000000-0000-0000-0000-000000000003' },
    { keyword: 'fbsbx', service_id: 'b0000000-0000-0000-0000-000000000003' },
    { keyword: 'instagram', service_id: 'b0000000-0000-0000-0000-000000000002' },
    { keyword: 'whatsapp', service_id: 'e0000000-0000-0000-0000-000000000001' },
    { keyword: 'tiktok', service_id: 'b0000000-0000-0000-0000-000000000004' },
    { keyword: 'byteoversea', service_id: 'b0000000-0000-0000-0000-000000000004' }
];

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (
        process.env.NODE_ENV === 'production' &&
        req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
    ) {
        return res.status(401).json({ error: 'Unauthorized CRON execution' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Missing Supabase Configs' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Pega os eventos processados nas últimas 24h
    // Em produção o ideal é ter uma flag na tabela 'analyzed' boolean, para n rever a mesma linha. 
    // Para MVP, ordenamos por id desc com limit.
    const { data: events, error: evErr } = await supabase
        .from('dns_events')
        .select('*')
        .eq('action', 'processed')
        .order('created_at', { ascending: false })
        .limit(10000);

    if (evErr || !events) {
        return res.status(500).json({ error: 'Falha ao buscar logs', details: evErr });
    }

    let detectedCount = 0;

    for (const ev of events) {
        const domain = ev.domain.toLowerCase();

        // Checar heurística
        const matched = HEURISTICS.find(h => domain.includes(h.keyword));
        if (matched) {
            // Verificar se já não está bloqueado na base (tabela service_domains)
            const { data: existSrv, error: esErr } = await supabase
                .from('service_domains')
                .select('id')
                .eq('domain', domain)
                .eq('service_id', matched.service_id)
                .maybeSingle();

            if (!existSrv && !esErr) {
                // Insere em sugggested
                const { error: insErr } = await supabase
                    .from('suggested_domains')
                    .insert({
                        domain: domain,
                        service_id: matched.service_id,
                        client_id: ev.client_id, // mantemos o rastro pra ver quem vazou
                        status: 'pending'
                    });

                // Se falahou pq quebrou UNIQUE(domain, service_id), apenas ignora.
                if (!insErr) {
                    detectedCount++;
                }
            }
        }
    }

    return res.status(200).json({
        success: true,
        learned_domains: detectedCount,
        scanned_events: events.length
    });
}
