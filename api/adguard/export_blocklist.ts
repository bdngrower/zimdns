import { createClient } from '@supabase/supabase-js';

// Vercel Serverless: Route read by AdGuard as a native filter subscription
export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { source } = req.query;

    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).send('! Missing DB Settings');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // ===========================================================
        // PASSO 1: Buscar total REAL do banco antes de paginar
        // Evita usar allDomains.length (que depende do lote carregado)
        // ===========================================================
        let countQuery = supabase
            .from('blocklist_domains')
            .select('*', { count: 'exact', head: true });

        if (source) {
            countQuery = countQuery.eq('blocklist_sources.name', source);
        } else {
            // Filtra apenas fontes habilitadas via join
            countQuery = (countQuery as any).eq('blocklist_sources.enabled', true);
        }

        const { count: totalCount, error: countError } = await supabase
            .from('blocklist_domains')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            console.error('Blocklist Export COUNT Error:', countError);
        }

        // ===========================================================
        // PASSO 2: Buscar todos os domínios via paginação
        // Loop simples (from-offset) como solicitado
        // ===========================================================
        const allDomains: string[] = [];
        const BATCH_SIZE = 10000;
        let from = 0;

        while (true) {
            let query = supabase
                .from('blocklist_domains')
                .select('domain, blocklist_sources!inner(name, enabled)')

            if (source) {
                query = query.eq('blocklist_sources.name', source).range(from, from + BATCH_SIZE - 1);
            } else {
                query = query.eq('blocklist_sources.enabled', true).range(from, from + BATCH_SIZE - 1);
            }

            const { data, error } = await query;

            if (error) {
                console.error(`Blocklist Export Pagination Error at from=${from}:`, error);
                return res.status(500).send(`! Database error at offset ${from}: ${error.message}`);
            }

            if (!data || data.length === 0) break;

            for (const row of data) {
                if (row.domain) {
                    // Remove prefixo wildcard *.  caso venha sujo
                    const clean = row.domain.replace(/^\*\./, '');
                    allDomains.push(clean);
                }
            }

            from += BATCH_SIZE;

            // Saída antecipada se retornou menos que o batch
            if (data.length < BATCH_SIZE) break;

            // Hard limit: 150 páginas x 10k = 1.5M domínios (cobre qualquer cenário)
            if (from > 1_500_000) break;
        }

        if (allDomains.length === 0) {
            return res.status(200).send('! No malicious domains cataloged yet.');
        }

        // ===========================================================
        // PASSO 3: Montar o payload no formato nativo do AdGuard
        // Header usa o COUNT real do banco, não o tamanho do array
        // ===========================================================
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=14400, stale-while-revalidate');

        const timestamp = new Date().toUTCString();
        // Usa totalCount do banco se disponível, senão usa tamanho do array como fallback
        const displayCount = totalCount ?? allDomains.length;

        let payload = `! Title: ZIM DNS Universal Threat Intelligence\n`;
        payload += `! Description: Consolidated Global Malware, Phishing & Ad Blocklist\n`;
        payload += `! Updated: ${timestamp}\n`;
        payload += `! Count: ${displayCount}\n`;
        payload += `!\n`;

        const domainsString = allDomains.map(domain => `||${domain}^`).join('\n');

        return res.status(200).send(payload + domainsString);

    } catch (err: any) {
        console.error('Blocklist Export Error:', err);
        return res.status(500).send(`! Internal Server Error: ${err.message}`);
    }
}
