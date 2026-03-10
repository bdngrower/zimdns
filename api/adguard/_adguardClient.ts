/**
 * api/adguard/_adguardClient.ts
 *
 * Helper para gerenciar "Persistent Clients" no AdGuard Home via API.
 *
 * Usado pelo fluxo de sync para garantir que cada client do ZIM DNS
 * tenha um ClientID estável registrado no AdGuard, que é então utilizado
 * pelo DoH Proxy no path da URL: /dns-query/<adguard_client_id>
 *
 * === adguard_client_id — formato definitivo ===
 * "zimdns-" + UUID do client sem hífens (32 hex chars lowercase)
 * Exemplo: zimdns-a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6
 *
 * - Determinístico: calculado a partir do client.id (PK do banco), sem armazenamento extra
 * - Zero colisão prática: herda unicidade do UUID
 * - Estável: nunca muda enquanto o client_id não muda
 * - Legível: prefixo "zimdns-" identifica a origem na UI do AdGuard
 * - Compatível com AdGuard: lowercase alphanum + hífen (aceito no campo ids[])
 */

export interface AdGuardClientConfig {
  adguardUrl: string;
  authHeader: string;
}

export interface AdGuardPersistentClient {
  name: string;
  ids: string[];           // array de identifiers: IPs, MACs, ClientIDs
  use_global_settings: boolean;
  use_global_blocked_services: boolean;
  filtering_enabled: boolean;
  parental_enabled: boolean;
  safebrowsing_enabled: boolean;
  safesearch?: {
    enabled: boolean;
  };
  tags?: string[];
}

/**
 * Calcula o adguard_client_id estável para um client do ZIM DNS.
 * Formato: "zimdns-" + uuid sem hífens (32 chars hex lowercase)
 * Total: 39 chars. Sempre determinístico, nunca armazenado.
 */
export function toAdGuardClientId(clientId: string): string {
  const uuidNoDashes = clientId.replace(/-/g, '').toLowerCase();
  return `zimdns-${uuidNoDashes}`;
}

/**
 * Busca todos os persistent clients do AdGuard.
 */
async function listAdGuardClients(config: AdGuardClientConfig): Promise<any[]> {
  const res = await fetch(`${config.adguardUrl}/control/clients`, {
    headers: { Authorization: config.authHeader },
  });
  if (!res.ok) {
    throw new Error(`AdGuard GET /control/clients failed: HTTP ${res.status}`);
  }
  const body = await res.json();
  // AdGuard retorna { clients: [...], auto_clients: [...] }
  return body?.clients ?? [];
}

/**
 * Sincronização idempotente de um persistent client no AdGuard.
 *
 * Lógica:
 *   1. Lista clients existentes
 *   2. Procura se algum client já contém adguard_client_id no array ids[]
 *   3. Se não existe → POST /control/clients/add
 *   4. Se já existe (mesmo nome ou mesmo id) → POST /control/clients/update
 *
 * Garante que a operação seja safe para re-execuções (sync idempotente).
 *
 * @param clientId      UUID do client no ZIM DNS (clients.id)
 * @param clientName    Nome do client no ZIM DNS (clients.name) — usado como label no AdGuard
 * @param config        Credenciais AdGuard (URL + authHeader)
 * @returns             O adguard_client_id usado
 */
export async function syncAdGuardClient(
  clientId: string,
  clientName: string,
  config: AdGuardClientConfig,
): Promise<string> {
  const adguardClientId = toAdGuardClientId(clientId);

  const clientPayload: AdGuardPersistentClient = {
    name: `ZimDNS - ${clientName}`,
    ids: [adguardClientId],
    use_global_settings: false,
    use_global_blocked_services: true,
    filtering_enabled: true,
    parental_enabled: false,
    safebrowsing_enabled: false,
    tags: ['zimdns'],
  };

  // 1. Verificar se client já existe pelo adguard_client_id
  const existingClients = await listAdGuardClients(config);
  const existing = existingClients.find((c: any) =>
    Array.isArray(c.ids) && c.ids.includes(adguardClientId)
  );

  if (existing) {
    // 2a. Já existe — atualizar (idempotente)
    const updateRes = await fetch(`${config.adguardUrl}/control/clients/update`, {
      method: 'POST',
      headers: {
        Authorization: config.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: existing.name,  // name atual é usado como chave de lookup no update
        data: {
          ...clientPayload,
          name: `ZimDNS - ${clientName}`, // garante nome atualizado
        },
      }),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error(
        `AdGuard POST /control/clients/update failed for "${adguardClientId}": HTTP ${updateRes.status} — ${errText}`,
      );
    }
  } else {
    // 2b. Não existe — criar
    const addRes = await fetch(`${config.adguardUrl}/control/clients/add`, {
      method: 'POST',
      headers: {
        Authorization: config.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clientPayload),
    });

    if (!addRes.ok) {
      const errText = await addRes.text();
      // AdGuard retorna 400 "Client already exists" em race condition — tratar como sucesso
      if (addRes.status === 400 && errText.toLowerCase().includes('already exists')) {
        console.warn(
          `[AdGuard Sync] Client "${adguardClientId}" já existe (race condition ignorada).`,
        );
      } else {
        throw new Error(
          `AdGuard POST /control/clients/add failed for "${adguardClientId}": HTTP ${addRes.status} — ${errText}`,
        );
      }
    }
  }

  return adguardClientId;
}

/**
 * Monta o AdGuardClientConfig a partir das variáveis de ambiente.
 * Centraliza acesso às ENVs para evitar duplicação nos handlers.
 */
export function getAdGuardConfig(): AdGuardClientConfig {
  const adguardUrl = process.env.ADGUARD_API_URL ?? '';
  const adguardUser = process.env.ADGUARD_USERNAME ?? '';
  const adguardPass = process.env.ADGUARD_PASSWORD ?? '';

  if (!adguardUrl) throw new Error('ADGUARD_API_URL não configurado');

  const authHeader = `Basic ${Buffer.from(`${adguardUser}:${adguardPass}`).toString('base64')}`;
  return { adguardUrl, authHeader };
}
