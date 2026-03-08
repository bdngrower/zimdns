import { createClient } from '@supabase/supabase-js';

// Mapeamento dos serviços para os repositórios fonte
const SOURCES = [
    {
        service_id: 'b0000000-0000-0000-0000-000000000003', // Facebook
        url: 'https://raw.githubusercontent.com/zangadoprojets/pi-hole-block-list/main/facebook.txt'
    },
    {
        service_id: 'b0000000-0000-0000-0000-000000000004', // TikTok
        url: 'https://raw.githubusercontent.com/zangadoprojets/pi-hole-block-list/main/tiktok.txt'
    },
    {
        service_id: 'e0000000-0000-0000-0000-000000000001', // WhatsApp
        url: 'https://raw.githubusercontent.com/zangadoprojets/pi-hole-block-list/main/whatsapp.txt'
    },
    {
        service_id: 'b0000000-0000-0000-0000-000000000006', // Todas as Redes (Agregado)
        url: 'https://raw.githubusercontent.com/gieljnssns/Social-media-Blocklists/master/social-media-blocklist.txt'
    }
];

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Cron verification security if running on Vercel
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
    let totalInserted = 0;

    for (const source of SOURCES) {
        console.log(`Buscando blocklist para service_id: ${source.service_id}...`);
        try {
            const resp = await fetch(source.url);
            if (!resp.ok) {
                console.error(`Falha ao acessar lista: ${source.url}`);
                continue;
            }

            const text = await resp.text();

            // Parse and clean domains
            const domainsSet = new Set<string>();
            const lines = text.split('\n');

            for (let line of lines) {
                line = line.trim();
                // Ignora comentários e linhas vazias
                if (!line || line.startsWith('#')) continue;

                // Remove comentários inline e extras "0.0.0.0"
                line = line.split('#')[0].trim();
                line = line.replace(/^0\.0\.0\.0\s+/, '').replace(/^127\.0\.0\.1\s+/, '').trim();

                if (line) {
                    domainsSet.add(line);
                }
            }

            const domainsArray = Array.from(domainsSet);
            console.log(`Encontrados ${domainsArray.length} domínios para inserir.`);

            // Inserir em chunks de 1000 para não quebrar o payload do Supabase/pg
            const CHUNK_SIZE = 1000;
            for (let i = 0; i < domainsArray.length; i += CHUNK_SIZE) {
                const chunk = domainsArray.slice(i, i + CHUNK_SIZE);
                const payload = chunk.map(d => ({
                    service_id: source.service_id,
                    domain: d
                }));

                const { error } = await supabase
                    .from('service_domains')
                    .upsert(payload, { onConflict: 'service_id, domain', ignoreDuplicates: true });

                if (error) {
                    console.error(`Erro ao inserir chunk:`, error);
                } else {
                    totalInserted += chunk.length;
                }
            }

        } catch (error) {
            console.error(`Exceção processando ${source.url}`, error);
        }
    }

    return res.status(200).json({ success: true, totalParsedOrIgnored: totalInserted, message: 'Cron job executado com sucesso e domínios normalizados.' });
}
