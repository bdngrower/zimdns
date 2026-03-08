export default async function handler(req: any, res: any) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const apiUrlRaw = process.env.ADGUARD_API_URL;
        const username = process.env.ADGUARD_USERNAME;
        const password = process.env.ADGUARD_PASSWORD;

        if (!apiUrlRaw || !username || !password) {
            console.error('[AdGuard API] Variáveis de ambiente incompletas');
            return res.status(500).json({
                success: false,
                connected: false,
                message: 'Variáveis de ambiente do AdGuard não configuradas.'
            });
        }

        // Garantir que ADGUARD_API_URL não tenha /control no final nem / extra
        const cleanUrl = apiUrlRaw.replace(/\/control\/?$/, '').replace(/\/$/, '');
        const targetUrl = `${cleanUrl}/control/status`;

        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        const startTime = Date.now();

        console.log(`[AdGuard API] GET -> ${targetUrl}`);

        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
            }
        });

        const ms = Date.now() - startTime;

        console.log(`[AdGuard API] Resposta: HTTP ${response.status} (${ms}ms)`);

        if (response.status === 401) {
            console.error('[AdGuard API] Falha de Autenticação (401)');
            return res.status(401).json({
                success: false,
                connected: false,
                message: 'Erro de autenticação: usuário ou senha inválidos.',
                ms
            });
        }

        if (response.status === 404) {
            console.error('[AdGuard API] Endpoint Incorreto (404)');
            return res.status(404).json({
                success: false,
                connected: false,
                message: 'Erro de conexão: endpoint incorreto ou não encontrado.',
                ms
            });
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AdGuard API] Erro HTTP ${response.status}:`, errorText);
            return res.status(response.status).json({
                success: false,
                connected: false,
                message: `Falha na comunicação (HTTP ${response.status}).`,
                details: errorText,
                ms
            });
        }

        const data = await response.json();

        return res.status(200).json({
            success: true,
            connected: true,
            message: 'Conexão OK',
            running: data.running,
            version: data.version,
            dns_port: data.dns_port,
            http_port: data.http_port,
            protection_enabled: data.protection_enabled,
            dns_addresses: data.dns_addresses,
            ms
        });

    } catch (error: any) {
        console.error('[AdGuard API] Erro de rede ou indisponibilidade:', error);
        return res.status(500).json({
            success: false,
            connected: false,
            message: 'Erro de rede ou indisponibilidade do servidor.',
            details: error?.message || 'Unknown Error'
        });
    }
}
