import { createClient } from '@supabase/supabase-js';

// Vercel Severless route para forçar trigger de sincronização de regras de 1 cliente.
export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { clientId } = req.body;
    if (!clientId) {
        return res.status(400).json({ error: 'Missing clientId' });
    }

    let supabase;
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''; // Em prod use SERVICE_ROLE_KEY pra bypassar RLS

    // Fallback pra contornar missing envs em dev test mode
    if (!supabaseUrl || !supabaseKey) {
        console.warn("Vercel (Backend): Variáveis VITE_SUPABASE_* ausentes localmente.");
        return res.status(500).json({ success: false, message: 'Faltam váriaveis de ambiente do Supabase.' });
    }

    try {
        supabase = createClient(supabaseUrl, supabaseKey);

        const adguardUrl = process.env.ADGUARD_API_URL;
        const adguardUser = process.env.ADGUARD_USERNAME;
        const adguardPass = process.env.ADGUARD_PASSWORD;

        if (!adguardUrl) throw new Error("ADGUARD_API_URL não configurado");

        // 1. Buscar status atual das policies do cliente
        const { data: policiesData, error: polErr } = await supabase
            .from('client_policies')
            .select('*')
            .eq('client_id', clientId)
            .eq('enabled', true);

        if (polErr) throw new Error("Erro ao buscar políticas: " + polErr.message);

        // 2. Buscar domínios dessas policies do catálogo
        let catalogRules: string[] = [];
        if (policiesData && policiesData.length > 0) {
            const policyNames = policiesData.map(p => p.policy_name);
            const { data: servicesData, error: srvErr } = await supabase
                .from('service_catalog')
                .select(`
                    name,
                    service_domains (
                        domain
                    )
                `);

            if (!srvErr && servicesData) {
                for (const svc of servicesData) {
                    // Match pela categoria abstrata pedida nos switches ("IA", "Streaming", "Redes Sociais", etc)
                    // Ou pelo match do nome. Simplificando: O Painel manda toggles nomeados de forma hardcoded (ex: "OpenAI / ChatGPT")
                    // Como no toggle o UX envia 'IA', 'Redes sociais' - vamos usar o campo "category" da tabela service_catalog para dar match
                    const matchingPolicyByName = policiesData.find(p => p.policy_name === svc.name);
                    const matchingPolicyByCategory = policiesData.find(p => p.policy_name === (svc as any).category);

                    if (matchingPolicyByName || matchingPolicyByCategory) {
                        const domains = (svc as any).service_domains?.map((d: any) => d.domain) || [];
                        domains.forEach((d: string) => {
                            catalogRules.push(`||${d}^`);
                        });
                    }
                }
            }
        }

        // 3. Buscar Regras Manuais (Block e Allow)
        const { data: manualData, error: manErr } = await supabase
            .from('manual_rules')
            .select('*')
            .eq('client_id', clientId)
            .eq('is_active', true);

        if (manErr) console.warn("Erro ao buscar regras manuais, prosseguindo sem elas...", manErr.message);

        let finalRulesSet = new Set(catalogRules);

        if (manualData) {
            manualData.forEach(mr => {
                // Formatação AdGuard: allow é @@||domain.com^ e block é ||domain.com^
                const adgRule = mr.type === 'allow' ? `@@||${mr.domain}^` : `||${mr.domain}^`;
                finalRulesSet.add(adgRule);
            });
        }

        const effectiveRules = Array.from(finalRulesSet);

        // 4. Enviar regras pro AdGuard usando o endpoint correto de SET
        const token = Buffer.from(`${adguardUser}:${adguardPass}`).toString('base64');

        const payload = {
            rules: effectiveRules
        };

        const agRes = await fetch(`${adguardUrl}/control/filtering/set_rules`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!agRes.ok) {
            const agErrorTxt = await agRes.text();
            throw new Error(`Falha API Adguard (HTTP ${agRes.status}): ${agErrorTxt}`);
        }

        // 5. Atualizar sucesso no client
        const now = new Date().toISOString();
        await supabase.from('clients').update({
            sync_status: 'success',
            last_sync_at: now,
            sync_error_message: null
        }).eq('id', clientId);

        return res.status(200).json({
            success: true,
            rulesCount: effectiveRules.length,
            message: 'Regras DNS sincronizadas com sucesso com o motor de filtragem AWS'
        });

    } catch (error: any) {
        console.error('DNS Sync Error:', error);

        // Atualizar falha
        if (supabase) {
            await supabase.from('clients').update({
                sync_status: 'error',
                sync_error_message: error?.message || 'Erro desconhecido ao comunicar com AdGuard',
                last_sync_at: new Date().toISOString()
            }).eq('id', clientId);
        }

        return res.status(200).json({
            success: false,
            message: error?.message || 'Erro interno ao sincronizar'
        });
    }
}
