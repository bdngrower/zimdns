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

    try {
        supabase = createClient(supabaseUrl, supabaseKey);
        const startedAt = new Date().toISOString();

        const adguardConfig = getAdGuardConfig();

        // ---------------------------------------------------------------
        // PASSO 0: Sincronizar o Persistent Client no AdGuard Home
        //
        // Garante que o client do ZIM DNS tenha um ClientID estável
        // registrado no AdGuard, used pelo DoH Proxy no path da URL:
        //   http://<adguard-interno>/dns-query/<adguard_client_id>
        //
        // adguard_client_id = "zimdns-" + client_uuid_sem_hifens
        // Operação idempotente: cria ou atualiza conforme necessário.
        // ---------------------------------------------------------------

        // Buscar o nome do client para uso no label do AdGuard
        const { data: clientData, error: clientErr } = await supabase
            .from('clients')
            .select('id, name')
            .eq('id', clientId)
            .single();

        if (clientErr || !clientData) {
            throw new Error(`Client não encontrado: ${clientErr?.message || 'null'}`);
        }

        let adguardClientId: string;
        try {
            adguardClientId = await syncAdGuardClient(clientData.id, clientData.name, adguardConfig);
            console.log(`[AdGuard Sync] Persistent Client sincronizado: ${adguardClientId}`);
        } catch (clientSyncErr: any) {
            // Falha no sync do client NÃO deve bloquear o sync de regras —
            // logar e continuar. O próximo sync tentará novamente.
            console.error(`[AdGuard Sync] Falha ao sincronizar Persistent Client: ${clientSyncErr.message}`);
            adguardClientId = toAdGuardClientId(clientId); // usar o slug calculado mesmo sem confirmação
        }

        // ---------------------------------------------------------------
        // PASSO 1: Buscar policies ativas do cliente
        // ---------------------------------------------------------------
        const { data: policiesData, error: polErr } = await supabase
            .from('client_policies')
            .select('*')
            .eq('client_id', clientId)
            .eq('enabled', true);

        if (polErr) throw new Error("Erro ao buscar políticas: " + polErr.message);

        // ---------------------------------------------------------------
        // PASSO 2: Buscar domínios do catálogo para as policies ativas
        // ---------------------------------------------------------------
        let catalogRules: string[] = [];
        if (policiesData && policiesData.length > 0) {
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

        // ---------------------------------------------------------------
        // PASSO 3: Buscar Regras Manuais (Block e Allow)
        // ---------------------------------------------------------------
        const { data: manualData, error: manErr } = await supabase
            .from('manual_rules')
            .select('*')
            .eq('client_id', clientId)
            .eq('is_active', true);

        if (manErr) console.warn("Erro ao buscar regras manuais, prosseguindo sem elas...", manErr.message);

        let finalRulesSet = new Set(catalogRules);

        if (manualData) {
            manualData.forEach(mr => {
                const adgRule = mr.type === 'allow' ? `@@||${mr.domain}^` : `||${mr.domain}^`;
                finalRulesSet.add(adgRule);
            });
        }

        const effectiveRules = Array.from(finalRulesSet);

        // ---------------------------------------------------------------
        // PASSO 4: Enviar regras ao AdGuard
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
        // PASSO 5: Pós-validação
        // ---------------------------------------------------------------
        const checkRes = await fetch(`${adguardConfig.adguardUrl}/control/filtering/status`, {
            headers: { 'Authorization': authHeader }
        });
        const checkData = await checkRes.json();
        const activeRules = checkData.user_rules || [];

        const missingRules = effectiveRules.filter((r: unknown) => typeof r === 'string' && !activeRules.includes(r));
        let finalStatusMsg = 'Aplicações validadas no AdGuard com sucesso!';
        let statusDb = 'success';

        if (missingRules.length > 0) {
            finalStatusMsg = `Aviso: ${missingRules.length} regras não constam como ativas na validação do motor.`;
            statusDb = 'warning';
        }

        // ---------------------------------------------------------------
        // PASSO 6: Atualizar status do client e gravar log de sync
        // ---------------------------------------------------------------
        const now = new Date().toISOString();

        const responsePayload = {
            adguard_client_id: adguardClientId,
            set_rules_status: agRes.status,
            validation: {
                applied: effectiveRules.length - missingRules.length,
                missing: missingRules.length
            },
            missing_examples: missingRules.slice(0, 3)
        };

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
    }
}
