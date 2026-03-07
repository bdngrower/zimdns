/**
 * Serviço de Integração com o Motor DNS (AdGuard Home)
 * 
 * ATENÇÃO: 
 * Este arquivo representa a LÓGICA DE BACKEND (Serverless Functions / Vercel API Routes).
 * NUNCA deve ser executado no browser do cliente para não expor credenciais do AdGuard.
 * O frontend deve chamar uma API do Vercel, que por sua vez utiliza as funções abaixo.
 */

import { supabase } from './supabase';

/**
 * Interface de resposta padrão do nosso integrador
 */
export interface DnsSyncResponse {
    success: boolean;
    message: string;
    timestamp: string;
}

/**
 * 1. Calcula as regras efetivas do Tenant
 * Lê as categorias bloqueadas, serviços bloqueados e regras manuais (allowlist/blocklist)
 * e converte para uma lista única de domínios ou sintaxe compatível com AdGuard.
 */
export async function buildTenantEffectiveRules(tenantId: string) {
    // Lógica futura: 
    // 1. Fetch tenant_block_toggles -> Resolver para block_categories ou service_catalog
    // 2. Resolver domínios (category_domains e service_domains)
    // 3. Fetch manual_rules (block) e adicionar à lista
    // 4. Fetch manual_rules (allow) e tratar como exceção (no AdGuard '@@||dominio.com^')

    return {
        blocks: ['example.com', 'blocked.com'],
        allows: ['@@||exception.com^']
    };
}

/**
 * 2. Envia (Push) das regras para a API REST do AdGuard
 */
export async function pushRulesToAdGuard(tenantId: string, rules: { blocks: string[], allows: string[] }) {
    const ADGUARD_API_URL = process.env.ADGUARD_API_URL;
    const ADGUARD_USERNAME = process.env.ADGUARD_USERNAME;
    const ADGUARD_PASSWORD = process.env.ADGUARD_PASSWORD;

    if (!ADGUARD_API_URL) {
        throw new Error("Credenciais do AdGuard não configuradas no ambiente do servidor.");
    }

    // Auth Header: Basic base64(user:pass)
    // Lógica futura via node-fetch / axios:
    // POST ${ADGUARD_API_URL}/control/filtering/rules

    console.log(`Mock: Enviando regras do tenant ${tenantId} para AdGuard...`, rules);
    return true;
}

/**
 * 3. Função principal de orquestração: syncTenantDnsConfig
 * Chamada quando o botão "Sincronizar DNS Agora" for apertado ou automaticamente via Webhook/Trigger.
 */
export async function syncTenantDnsConfig(tenantId: string): Promise<DnsSyncResponse> {
    try {
        // 1. Construir lista efetiva
        const rules = await buildTenantEffectiveRules(tenantId);

        // 2. Enviar para AdGuard
        await pushRulesToAdGuard(tenantId, rules);

        // 3. Atualizar Status no Supabase para Success
        const now = new Date().toISOString();
        await supabase.from('tenants').update({
            sync_status: 'success',
            last_sync_at: now,
            sync_error_message: null
        }).eq('id', tenantId);

        // 4. Log de Auditoria
        await supabase.from('audit_logs').insert({
            tenant_id: tenantId,
            action: 'SYNC_DNS',
            entity_type: 'tenant',
            details: { status: 'success', rulesAplicadas: rules }
        });

        return { success: true, message: "Sincronização concluída com sucesso.", timestamp: now };
    } catch (error: any) {
        const errorMsg = error.message || "Erro desconhecido ao comunicar com AdGuard.";

        // Atualizar Status no Supabase para Error
        await supabase.from('tenants').update({
            sync_status: 'error',
            sync_error_message: errorMsg
        }).eq('id', tenantId);

        return { success: false, message: errorMsg, timestamp: new Date().toISOString() };
    }
}

/**
 * 4. Obtém o Status real do DNS (opcional se quiser consultar o AdGuard ao vivo)
 */
export async function getTenantDnsStatus(tenantId: string) {
    // Lógica de consultar se as regras no AdGuard correspondem ao banco
    return { isSynced: true };
}
