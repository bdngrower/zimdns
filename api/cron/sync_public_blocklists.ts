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

        for (const source of sources) {
            try {
                console.log(`[Public Blocklist] Fetching ${source.name} from ${source.url} ...`);
                const response = await fetch(source.url);
                if (!response.ok) {
                    console.error(`[Public Blocklist] Falha HTTP ao baixar ${source.name} (${response.status})`);
                    continue;
                }
                const text = await response.text();
                const lines = text.split('\n');

                let count = 0;
                for (let line of lines) {
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

                    // Limpa sintaxe típica do AdGuard seletivo explícito (||domain^)
                    domain = domain.replace(/^\|\|/, '').replace(/\^$/, '');

                    if (domain && domain !== 'localhost' && domain.includes('.')) {
                        if (!consolidatedDomains.has(domain)) {
                            consolidatedDomains.set(domain, source.id);
                            count++;
                        }
                    }
                }
                console.log(`[Public Blocklist] Fonte ${source.name} extraída: ${count} domínios válidos únicos.`);

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

        for (let i = 0; i < domainsArray.length; i += CHUNK_SIZE) {
            const chunk = domainsArray.slice(i, i + CHUNK_SIZE);
            const { error: insErr } = await supabase
                .from('blocklist_domains')
                .upsert(chunk, { onConflict: 'domain', ignoreDuplicates: true });

            if (insErr) {
                console.error(`[Public Blocklist] Erro no chunk offset ${i}:`, insErr);
            } else {
                insertedTotal += chunk.length;
            }

            // Opcional throttle se o DB engasgar
            // await new Promise(r => setTimeout(r, 100));
        }

        // ----------------------------------------------------
        // Aciona Push Ativo para o AdGuard do Cliente Padrão 
        // ----------------------------------------------------
        console.log(`[Public Blocklist] Atualizando AdGuard Engine via Add_URL config...`);
        // Aqui nós faremos trigger para todos os edges, a grosso modo acionaremos o endpoint `sync.ts` caso haja necessidade
        // Mas o correto para lists abertas é criar a URI /api/adguard/export_blocklist e registrar como FilterUrl no AdGuard
        // Para simplificar, assumimos que o Firewall faz GET na URL e o CRON apenas prepara o DB.

        return res.status(200).json({
            success: true,
            totalUniqueProcessed: consolidatedDomains.size,
            totalInsertedOrChecked: insertedTotal
        });

    } catch (err: any) {
        console.error("DNS Blocklist Sync Error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
