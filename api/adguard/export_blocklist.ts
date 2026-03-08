import { createClient } from '@supabase/supabase-js';

// Vercel Serverless: Route read by AdGuard as a native filter subscription
export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { source } = req.query;

    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''; // Read-only is fine here

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).send('! Missing DB Settings');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        let query = supabase.from('blocklist_domains').select('domain, blocklist_sources!inner(name, enabled)');

        // Se a chamada pedir um target isolado, puxa só ele. Se não, puxa o consolidado ativo todo.
        if (source) {
            query = query.eq('blocklist_sources.name', source);
        } else {
            query = query.eq('blocklist_sources.enabled', true);
        }

        const { data, error } = await query;

        if (error) {
            return res.status(500).send(`! Database error: ${error.message}`);
        }

        if (!data || data.length === 0) {
            return res.status(200).send('! No malicious domains cataloged yet.');
        }

        // Formata nativamente para o Motor de AdBlock (linha a linha, `||domain.com^`)
        // Utilizando headers em TXT plaintext
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=14400, stale-while-revalidate'); // 4 hours cache no CDN da Vercel

        const timestamp = new Date().toUTCString();
        let payload = `! Title: ZIM DNS Universal Threat Intelligence\n`;
        payload += `! Description: Consolidated Global Malware, Phishing & Ad Blocklist\n`;
        payload += `! Updated: ${timestamp}\n`;
        payload += `! Count: ${data.length}\n`;
        // Removed AdGuard specific tag to keep it clean format
        payload += `!\n`;

        const domainsString = data.map((row: any) => `||${row.domain}^`).join('\n');

        return res.status(200).send(payload + domainsString);

    } catch (err: any) {
        console.error("Blocklist Export Error:", err);
        return res.status(500).send(`! Internal Server Error: ${err.message}`);
    }
}
