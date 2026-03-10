/**
 * api/agent/_agentAuth.ts
 *
 * Shared authentication helper for all ZIM DNS Agent backend endpoints.
 *
 * All agent endpoints authenticate devices via Bearer token:
 *   Authorization: Bearer {device_token_raw}
 *
 * The device_token_raw is never stored in the DB.
 * The DB stores only device_token_hash = SHA-256(device_token_raw).
 *
 * This file also provides the shared Supabase service-role client,
 * which is required for all agent endpoints (they bypass RLS).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

export interface AuthenticatedDevice {
  deviceId: string;
  clientId: string;
  clientPolicyId: string | null;
}

/**
 * Cria cliente Supabase com service_role. Usado exclusivamente server-side.
 * SUPABASE_SERVICE_ROLE_KEY já está configurada nas envs do Vercel.
 */
export function getServiceRoleClient(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) throw new Error('Supabase service role envs ausentes');
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Calcula SHA-256 de uma string (hex lowercase).
 */
export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Gera um token de alta entropia com prefixo.
 * Retorna o valor raw (para o cliente) e o hash (para armazenamento).
 */
export function generateToken(prefix: 'bt_' | 'tok_'): { raw: string; hash: string; prefix: string } {
  const { randomBytes } = require('crypto');
  const raw = `${prefix}${randomBytes(32).toString('hex')}`;
  const hash = sha256(raw);
  return { raw, hash, prefix: raw.substring(0, 10) };
}

/**
 * Autentica uma requisição de agente via Bearer token.
 *
 * Extrai o token do header Authorization, calcula seu hash,
 * e faz lookup em devices WHERE device_token_hash = hash AND status = 'active'.
 *
 * @returns AuthenticatedDevice se válido
 * @throws  Error com mensagem descritiva se inválido/revogado/ausente
 */
export async function authenticateDevice(
  req: any,
  supabase: SupabaseClient,
): Promise<AuthenticatedDevice> {
  const authHeader: string | undefined = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Authorization header ausente ou inválido'), { statusCode: 401 });
  }

  const tokenRaw = authHeader.slice(7).trim();
  if (!tokenRaw) {
    throw Object.assign(new Error('Bearer token vazio'), { statusCode: 401 });
  }

  const tokenHash = sha256(tokenRaw);

  const { data: device, error } = await supabase
    .from('devices')
    .select('id, client_id, client_policy_id, status')
    .eq('device_token_hash', tokenHash)
    .maybeSingle();

  if (error) {
    throw Object.assign(new Error(`Erro ao autenticar device: ${error.message}`), { statusCode: 500 });
  }

  if (!device) {
    throw Object.assign(new Error('Device não encontrado ou token inválido'), { statusCode: 401 });
  }

  if (device.status === 'revoked') {
    throw Object.assign(new Error('Device revogado'), { statusCode: 403 });
  }

  if (device.status !== 'active') {
    throw Object.assign(new Error('Device inativo'), { statusCode: 403 });
  }

  return {
    deviceId: device.id,
    clientId: device.client_id,
    clientPolicyId: device.client_policy_id ?? null,
  };
}

/**
 * Wrapper de resposta de erro padronizado para endpoints de agente.
 */
export function agentError(res: any, statusCode: number, message: string) {
  return res.status(statusCode).json({ ok: false, error: message });
}
