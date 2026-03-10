import { createClient } from '@supabase/supabase-js';
import { syncAdGuardClient, getAdGuardConfig, toAdGuardClientId } from './_adguardClient.js';

// Vercel Severless route para forçar trigger de sincronização de regras de 1 cliente.
// Estendido com sincronização do AdGuard Persistent Client (ClientID para uso no DoH Proxy).
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
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
        console.warn("Vercel (Backend): Variáveis VITE_SUPABASE_* ausentes localmente.");
        return res.status(500).json({ success: false, message: 'Faltam váriaveis de ambiente do Supabase.' });
    }

    // Declara variável para controle de lock
    let lockAcquired = false;

    try {
        supabase = createClient(supabaseUrl, supabaseKey);
        const startedAt = new Date().toISOString();

        // ---------------------------------------------------------------
        // PASSO 0: Adquirir Lock Global Atômico
        // ---------------------------------------------------------------
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: lockData, error: lockErr } = await supabase
            .from('sync_state')
            .update({ is_running: true, started_at: startedAt })
            .eq('id', 1)
            .or(`is_running.eq.false,started_at.lt.${fiveMinutesAgo}`)
            .select();

        if (lockErr) {
            console.error("Erro ao adquirir lock de sync:", lockErr);
            return res.status(500).json({ success: false, message: 'Erro interno ao verificar concorrência.' });
        }

        if (!lockData || lockData.length === 0) {
            console.warn(`[AdGuard Sync] Sync global já está em execução. Abortando request para client ${clientId}.`);
            return res.status(409).json({ success: false, message: 'Um sync global já está em andamento. Tente novamente em instantes.' });
        }
        
        lockAcquired = true;

        const adguardConfig = getAdGuardConfig();

        // ---------------------------------------------------------------
        // PASSO 1: Sincronizar o Persistent Client no AdGuard Home
        //
        // Garante que o client do ZIM DNS tenha os identificadores
        // registrados no AdGuard (ClientID e IPs públicos da rede).
        // ---------------------------------------------------------------

        const { data: clientData, error: clientErr } = await supabase
            .from('clients')
            .select('id, name, primary_dns_ip')
            .eq('id', clientId)
            .single();

        if (clientErr || !clientData) {
            throw new Error(`Client não encontrado: ${clientErr?.message || 'null'}`);
        }

        let adguardClientId: string;
        try {
            const publicIps = clientData.primary_dns_ip ? [clientData.primary_dns_ip] : [];
            adguardClientId = await syncAdGuardClient(clientData.id, clientData.name, adguardConfig, publicIps);
            console.log(`[AdGuard Sync] Persistent Client sincronizado: ${adguardClientId}`);
        } catch (clientSyncErr: any) {
            console.error(`[AdGuard Sync] Falha ao sincronizar Persistent Client: ${clientSyncErr.message}`);
            adguardClientId = toAdGuardClientId(clientId);
        }

        // ---------------------------------------------------------------
        // PASSO 2: Buscar serviços e domínios do catálogo
        // ---------------------------------------------------------------
        const { data: servicesData, error: srvErr } = await supabase
            .from('service_catalog')
            .select(`
                name,
                category,
                service_domains (
                    domain
                )
            `);
        
        if (srvErr) throw new Error("Erro ao buscar catálogo de serviços: " + srvErr.message);

        // ---------------------------------------------------------------
        // PASSO 3: Buscar TODAS as políticas ativas de TODOS os clientes
        // ---------------------------------------------------------------
        const { data: allPolicies, error: polErr } = await supabase
            .from('client_policies')
            .select('client_id, policy_name')
            .eq('enabled', true);

        if (polErr) throw new Error("Erro ao buscar políticas globais: " + polErr.message);

        // ---------------------------------------------------------------
        // PASSO 4: Buscar TODAS as regras manuais de TODOS os clientes
        // ---------------------------------------------------------------
        const { data: allManualRules, error: manErr } = await supabase
            .from('manual_rules')
            .select('client_id, domain, type')
            .eq('is_active', true);

        if (manErr) throw new Error("Erro ao buscar regras manuais globais: " + manErr.message);

        // ---------------------------------------------------------------
        // PASSO 5: Construir o Mapa de Regras (Multi-tenancy via $client)
        // ---------------------------------------------------------------
        
        // Estrutura: rule_string -> Set of client_tags
        const ruleToClients = new Map<string, Set<string>>();

        // 1. Processar políticas do catálogo
        if (allPolicies && servicesData) {
            for (const policy of allPolicies) {
                const clientTag = toAdGuardClientId(policy.client_id);
                
                // Encontrar serviços que correspondem a essa política (por nome ou categoria)
                const matchingServices = servicesData.filter(s => 
                    s.name === policy.policy_name || s.category === policy.policy_name
                );

                for (const svc of matchingServices) {
                    const domains = (svc as any).service_domains?.map((d: any) => d.domain) || [];
                    for (const domain of domains) {
                        const ruleBase = `||${domain}^`;
                        if (!ruleToClients.has(ruleBase)) {
                            ruleToClients.set(ruleBase, new Set());
                        }
                        ruleToClients.get(ruleBase)!.add(clientTag);
                    }
                }
            }
        }

        // 2. Processar regras manuais
        if (allManualRules) {
            for (const rule of allManualRules) {
                const clientTag = toAdGuardClientId(rule.client_id);
                const prefix = rule.type === 'allow' ? '@@' : '';
                const ruleBase = `${prefix}||${rule.domain}^`;
                
                if (!ruleToClients.has(ruleBase)) {
                    ruleToClients.set(ruleBase, new Set());
                }
                ruleToClients.get(ruleBase)!.add(clientTag);
            }
        }

        // ---------------------------------------------------------------
        // PASSO 6: Gerar a lista final de regras formatadas para o AdGuard
        // ---------------------------------------------------------------
        const effectiveRules: string[] = [];
        for (const [ruleBase, clientTags] of ruleToClients.entries()) {
            const tags = Array.from(clientTags).join(',');
            effectiveRules.push(`${ruleBase}$client=${tags}`);
        }

        // ---------------------------------------------------------------
        // PASSO 7: Enviar regras ao AdGuard (Sobrescreve tudo)
        // ---------------------------------------------------------------
        const token = Buffer.from(
            `${process.env.ADGUARD_USERNAME}:${process.env.ADGUARD_PASSWORD}`
        ).toString('base64');
        const authHeader = `Basic ${token}`;

        const payload = { rules: effectiveRules };

        const agRes = await fetch(`${adguardConfig.adguardUrl}/control/filtering/set_rules`, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!agRes.ok) {
            const agErrorTxt = await agRes.text();
            throw new Error(`Falha API Adguard (HTTP ${agRes.status}): ${agErrorTxt}`);
        }

        // ---------------------------------------------------------------
        // PASSO 8: Pós-validação e Log
        // ---------------------------------------------------------------
        const checkRes = await fetch(`${adguardConfig.adguardUrl}/control/filtering/status`, {
            headers: { 'Authorization': authHeader }
        });
        const checkData = await checkRes.json();
        const serverRules = checkData.user_rules || [];

        const missingRules = effectiveRules.filter(r => !serverRules.includes(r));
        let finalStatusMsg = 'Aplicações sincronizadas globalmente com $client para multi-tenancy.';
        let statusDb = 'success';

        if (missingRules.length > 0) {
            finalStatusMsg = `Aviso: Sincronismo global incompleto (${missingRules.length} falhas).`;
            statusDb = 'warning';
        }

        const now = new Date().toISOString();
        const responsePayload = {
            total_global_rules: effectiveRules.length,
            status: agRes.status,
            validation: {
                applied: effectiveRules.length - missingRules.length,
                missing: missingRules.length
            }
        };

        // Atualizar status apenas para o cliente que disparou (ou talvez todos? por enquanto manter trigger)
        await supabase.from('clients').update({
            sync_status: statusDb,
            last_sync_at: now,
            sync_error_message: statusDb === 'warning' ? finalStatusMsg : null
        }).eq('id', clientId);

        await supabase.from('sync_logs').insert({
            client_id: clientId,
            request_payload: payload,
            response_payload: responsePayload,
            status: statusDb,
            rules_count: effectiveRules.length,
            started_at: startedAt,
            finished_at: now
        });

        return res.status(200).json({
            success: true,
            warning: statusDb === 'warning',
            rulesCount: effectiveRules.length,
            adguardClientId,
            message: finalStatusMsg
        });

    } catch (error: any) {
        console.error('DNS Sync Error:', error);

        const now = new Date().toISOString();
        const errMsg = error?.message || 'Erro desconhecido ao comunicar com AdGuard';

        if (supabase) {
            await supabase.from('clients').update({
                sync_status: 'error',
                sync_error_message: errMsg,
                last_sync_at: now
            }).eq('id', clientId);

            await supabase.from('sync_logs').insert({
                client_id: clientId,
                status: 'error',
                started_at: now,
                finished_at: now,
                error_message: errMsg
            });
        }

        return res.status(200).json({
            success: false,
            message: errMsg
        });
    } finally {
        if (supabase && lockAcquired) {
            await supabase
                .from('sync_state')
                .update({ is_running: false, started_at: null })
                .eq('id', 1);
            console.log(`[AdGuard Sync] Global Lock released.`);
        }
    }
}
