import { createClient } from '@supabase/supabase-js';

// Vercel Cron Job: Sincroniza domínios de Blocklists Públicas Abertas
export default async function handler(req: any, res: any) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Basic Auth Check para cron-jobs locais/Vercel
    const authHeader = req.headers.authorization;
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ success: false, message: 'Missing DB keys' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const startTime = new Date();

    try {
        const { data: sources, error: srcErr } = await supabase
            .from('blocklist_sources')
            .select('id, name, url')
            .eq('enabled', true);

        if (srcErr) throw new Error(`Could not fetch sources: ${srcErr.message}`);
        if (!sources || sources.length === 0) {
            return res.status(200).json({ success: true, message: 'Nenhuma fonte ativa encontrada.' });
        }

        const consolidatedDomains = new Map<string, string>(); // domain -> source_id

        // Logs para o JSON final
        let totalRead = 0;
        let totalValid = 0;

        for (const source of sources) {
            let sourceRead = 0;
            let sourceValid = 0;

            try {
                console.log(`[Public Blocklist] Fetching ${source.name} from ${source.url} ...`);
                const startFetch = Date.now();
                const response = await fetch(source.url);
                if (!response.ok) {
                    console.error(`[Public Blocklist] Falha HTTP ao baixar ${source.name} (${response.status})`);
                    continue;
                }
                const text = await response.text();
                const lines = text.split('\n');

                for (let line of lines) {
                    sourceRead++;
                    line = line.trim();
                    // Ignora comentários, vazios e localhost (padrão em arquivos HOSTS)
                    if (!line || line.startsWith('#') || line.startsWith('!')) continue;

                    // Normaliza formato HOSTS (ex: "0.0.0.0 dominio.com" ou "127.0.0.1 dominio.com")
                    const parts = line.split(/\s+/);
                    let domain = '';
                    if (parts.length >= 2 && (parts[0] === '0.0.0.0' || parts[0] === '127.0.0.1')) {
                        domain = parts[1];
                    } else if (parts.length === 1) {
                        domain = parts[0];
                    }

                    // Normalização Rigorosa:
                    // 1. Remove formatação AdGuard explícita ex: ||domain^
                    // 2. Remove curingas globais redundantes que quebram o AdGuard exportador ex: *.dominio.com para virar só dominio.com
                    domain = domain.replace(/^\|\|/, '')
                        .replace(/\^$/, '')
                        .replace(/^\*\./, ''); // <--- REMOVE wildcard explicit prefix

                    if (domain && domain !== 'localhost' && domain.includes('.')) {
                        // Se bater duplicado entre duas listas, o Set (.has) rejeita
                        if (!consolidatedDomains.has(domain)) {
                            consolidatedDomains.set(domain, source.id);
                            sourceValid++;
                        }
                    }
                }

                totalRead += sourceRead;
                totalValid += sourceValid;

                console.log(`[Public Blocklist] Fonte ${source.name} finalizada. Lidos: ${sourceRead} | Válidos e Únicos: ${sourceValid}. Took: ${Date.now() - startFetch}ms`);

                // Marca o tracking
                await supabase.from('blocklist_sources').update({ last_sync: new Date().toISOString() }).eq('id', source.id);

            } catch (err: any) {
                console.error(`[Public Blocklist] Erro interno extraindo ${source.name}:`, err.message);
            }
        }

        // Inserção fatiada em lotes para evitar Load Timeout / ByteLimit
        const domainsArray = Array.from(consolidatedDomains.entries()).map(([domain, source_id]) => ({
            domain,
            source_id
        }));

        const CHUNK_SIZE = 1000;
        let insertedTotal = 0;
        let dbErrors = 0;

        const startInsert = Date.now();

        for (let i = 0; i < domainsArray.length; i += CHUNK_SIZE) {
            const chunk = domainsArray.slice(i, i + CHUNK_SIZE);
            const { error: insErr } = await supabase
                .from('blocklist_domains')
                .upsert(chunk, { onConflict: 'domain', ignoreDuplicates: true });

            if (insErr) {
                console.error(`[Public Blocklist] Erro no chunk offset ${i}:`, insErr);
                dbErrors++;
            } else {
                insertedTotal += chunk.length;
            }
        }

        return res.status(200).json({
            started: startTime.toISOString(),
            finished: new Date().toISOString(),
            sources_processed: sources.length,
            domains_read_total: totalRead,
            domains_normalized_unique: totalValid,
            domains_inserted_batch: insertedTotal,
            duplicates_ignored_by_ram: totalRead - totalValid,
            db_errors: dbErrors,
            elapsed_ms: Date.now() - startTime.getTime()
        });

    } catch (err: any) {
        console.error("DNS Blocklist Sync Error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
