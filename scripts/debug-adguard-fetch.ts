import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const adguardUrl = process.env.ADGUARD_API_URL;
const adguardUser = process.env.ADGUARD_USERNAME;
const adguardPass = process.env.ADGUARD_PASSWORD;

console.log("Supabase e Adguard ENVs validadas:", !!supabaseUrl, !!adguardUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function runDevCheck() {
    // 1. Pegar um cliente que sabemos que existe:
    const { data: nets } = await supabase.from('client_networks').select('client_id, value').limit(1);
    if (!nets || nets.length === 0) {
        console.log("Nenhum client_network encontrado.");
        return;
    }

    // Simular que estamos pesquisando o cliente da listagem (pegar o primeiro pra testar).
    const clientId = nets[0].client_id;
    const ipValidToTest = nets[0].value;
    console.log(`\n\n--- INICIANDO TESTE DO CLIENTE ${clientId} com IP ${ipValidToTest} ---`);

    const token = Buffer.from(`${adguardUser}:${adguardPass}`).toString('base64');
    const agRes = await fetch(`${adguardUrl}/control/querylog?limit=1000`, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${token}`, 'Accept': 'application/json' }
    });

    const agData = await agRes.json();
    const allLogs = agData.data || [];

    console.log(`Logs brutos do AdGuard extraídos: ${allLogs.length}`);
    if (allLogs.length > 0) {
        console.log("\nRAW SAMPLE (1º log do adguard):\n", JSON.stringify(allLogs[0], null, 2));

        const extractIp = (clientStr: string) => {
            if (!clientStr) return '';
            const ipMatch = clientStr.match(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/);
            if (ipMatch) return ipMatch[0];
            const parenMatch = clientStr.match(/\((.*?)\)/);
            if (parenMatch && parenMatch[1]) return parenMatch[1].trim();
            return clientStr.trim();
        };

        const ipsValidSet = new Set([ipValidToTest]);

        console.log("\n--- TESTANDO EXTRAÇÃO DE IP DOS 5 PRIMEIROS LOGS ---");
        allLogs.slice(0, 5).forEach((log: any, idx: number) => {
            const rawClient = log.client;
            const extracted = extractIp(log.client);
            console.log(`[Item ${idx}] Raw client: ${rawClient} -> IP Extraído: ${extracted}`);
        });

        const isClientMatch = (log: any, ips: Set<string>) => {
            const clientFieldValue = log.client || '';
            const clientIpFieldValue = log.client_ip || '';
            const extractedIp = extractIp(clientFieldValue);

            for (const validIp of Array.from(ips)) {
                if (
                    validIp === clientIpFieldValue ||
                    validIp === extractedIp ||
                    validIp === clientFieldValue ||
                    clientFieldValue.includes(validIp)
                ) {
                    return true;
                }
            }
            return false;
        };

        const matchedLogs = allLogs.filter((log: any) => isClientMatch(log, ipsValidSet));

        console.log(`\nTotal Final: O cliente ${ipValidToTest} teve MATCH com ${matchedLogs.length} reqs de um total de ${allLogs.length}`);

        if (matchedLogs.length > 0) {
            console.log("\nDados de Telemetria Finais:");
            console.log("- Status: ATIVO");
            console.log("- Último acesso:", matchedLogs[0].time);
        }
    }
}

runDevCheck();
