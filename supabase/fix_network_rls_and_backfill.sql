-- 1. POLÍTICAS RLS FALTANTES (Permitir CRUD para usuários autenticados no MVP)
-- Isso evita o erro 403 silencioso nas inserções das dependências do cliente

CREATE POLICY "Enable all for authenticated users on client_networks" 
ON client_networks FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for authenticated users on client_policies" 
ON client_policies FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for authenticated users on block_pages" 
ON block_pages FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for authenticated users on manual_rules" 
ON manual_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. BACKFILL / MIGRAÇÃO DE ORIGENS DE REDE E POLÍTICAS INICIAIS
-- Migra o IP antigo da tabela clients para client_networks, apenas se não existir.

INSERT INTO client_networks (client_id, type, value, description)
SELECT id, 'ip', primary_dns_ip, 'Rede Principal (Migrada)'
FROM clients
WHERE primary_dns_ip IS NOT NULL 
AND primary_dns_ip != ''
AND NOT EXISTS (
    SELECT 1 FROM client_networks WHERE client_networks.client_id = clients.id
);

-- Migra eventuais block_pages se não houver
INSERT INTO block_pages (client_id, title)
SELECT id, 'Acesso Bloqueado'
FROM clients
WHERE NOT EXISTS (
    SELECT 1 FROM block_pages WHERE block_pages.client_id = clients.id
);
