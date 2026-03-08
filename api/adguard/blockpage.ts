export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { blockpageIp } = req.body;

    const adguardUrl = process.env.ADGUARD_API_URL;
    const adguardUser = process.env.ADGUARD_USERNAME;
    const adguardPass = process.env.ADGUARD_PASSWORD;

    if (!adguardUrl) {
        return res.status(500).json({ success: false, message: 'ADGUARD_API_URL não configurado' });
    }

    try {
        const token = Buffer.from(`${adguardUser}:${adguardPass}`).toString('base64');
        const headers = {
            'Authorization': `Basic ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };

        // 1. Obter config atual para nao sobrescrever nada
        const getRes = await fetch(`${adguardUrl}/control/filtering/status`, { headers });
        if (!getRes.ok) {
            throw new Error(`Falha ao ler config do AdGuard (HTTP ${getRes.status})`);
        }

        const currentConfig = await getRes.json();

        // 2. Modificar propriedades de bloqueio
        const newMode = blockpageIp ? 'custom_ip' : 'default';
        const newIp = blockpageIp || '';

        const payload = {
            enabled: currentConfig.enabled ?? true,
            interval: currentConfig.interval ?? 24,
            blocking_ipv4: newIp,
            blocking_ipv6: currentConfig.blocking_ipv6 || '',
            blocking_mode: newMode
        };

        // 3. Salvar nova config
        const postRes = await fetch(`${adguardUrl}/control/filtering/config`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!postRes.ok) {
            const errTxt = await postRes.text();
            throw new Error(`Falha ao salvar config do AdGuard (HTTP ${postRes.status}): ${errTxt}`);
        }

        return res.status(200).json({
            success: true,
            message: 'Configuração da Blockpage atualizada no Motor DNS',
            blocking_mode: newMode,
            blocking_ipv4: newIp
        });

    } catch (error: any) {
        console.error('AdGuard Blockpage Config Error:', error);
        return res.status(500).json({
            success: false,
            message: error?.message || 'Erro interno ao configurar blockpage',
        });
    }
}
