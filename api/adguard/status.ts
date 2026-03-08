export default async function handler(req: any, res: any) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const apiUrl = process.env.ADGUARD_API_URL;
        const username = process.env.ADGUARD_USERNAME;
        const password = process.env.ADGUARD_PASSWORD;

        if (!apiUrl || !username || !password) {
            return res.status(500).json({
                success: false,
                message: 'Variáveis de ambiente do AdGuard não configuradas no Vercel (API_URL, USERNAME, PASSWORD).'
            });
        }

        // Criar o token de Basic Auth
        const authToken = Buffer.from(`${username}:${password}`).toString('base64');
        const startTime = Date.now();

        // Faz o request para o endpoint de status real do AdGuard
        const response = await fetch(`${apiUrl}/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${authToken}`,
                'Content-Type': 'application/json',
            }
        });

        const ms = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({
                success: false,
                message: `Falha na autenticação ou indisponibilidade (HTTP ${response.status}).`,
                details: errorText,
                ms
            });
        }

        const data = await response.json();

        // Retornar os parâmetros solicitados: running, dns_addresses, version
        return res.status(200).json({
            success: true,
            message: 'Conectado ao AdGuard Home com sucesso.',
            running: data.running || false,
            dns_addresses: data.dns_addresses || ['Desconhecido'],
            version: data.version || 'Desconhecida',
            ms
        });

    } catch (error: any) {
        console.error('AdGuard Connection Test Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro de rede ao tentar contactar o servidor.',
            details: error?.message || 'Unknown Error'
        });
    }
}
