-- ZIM DNS Seed Data

-- 1. Inserir Categorias Básicas (Grupos Principais)
INSERT INTO block_categories (id, name, description, icon) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Inteligência Artificial', 'Ferramentas de IA Generativa e Chatbots', 'bot'),
    ('00000000-0000-0000-0000-000000000002', 'Redes Sociais', 'Plataformas de interação social', 'users'),
    ('00000000-0000-0000-0000-000000000003', 'Fóruns e Comunidades', 'Fóruns de discussão e comunidades online', 'message-square'),
    ('00000000-0000-0000-0000-000000000004', 'Vídeo e Streaming', 'Serviços de áudio e vídeo', 'play-circle'),
    ('00000000-0000-0000-0000-000000000005', 'Mensageria e Comunicação', 'Aplicativos de chat e videoconferência', 'message-circle'),
    ('00000000-0000-0000-0000-000000000006', 'Jogos e Entretenimento', 'Plataformas de jogos online', 'gamepad-2'),
    ('00000000-0000-0000-0000-000000000007', 'Segurança e Conteúdo Sensível', 'Pornografia, Malware, Apostas', 'shield-alert'),
    ('00000000-0000-0000-0000-000000000008', 'Produtividade', 'Storage, Uploads e Safe Search', 'briefcase');

-- 2. Inserir Subcategorias / Toggles Genéricos na Category Domains
-- Para as categorias genéricas de Segurança
INSERT INTO block_categories (id, name, description, icon) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Pornografia', 'Sites de conteúdo adulto', 'alert-triangle'),
    ('22222222-2222-2222-2222-222222222222', 'Malware/Phishing', 'Bloqueio de sites maliciosos', 'shield-alert'),
    ('55555555-5555-5555-5555-555555555555', 'Apostas', 'Sites de jogos de azar e apostas esportivas', 'dices');

INSERT INTO category_domains (category_id, domain) VALUES
    ('11111111-1111-1111-1111-111111111111', 'pornhub.com'),
    ('11111111-1111-1111-1111-111111111111', 'xvideos.com'),
    ('55555555-5555-5555-5555-555555555555', 'bet365.com');

-- 3. Inserir Serviços (Granulares) agrupados visualmente via React (usaremos o ID de category para agrupar no frontend se necessário, mas o painel lerá todos os serviços catalogados)
INSERT INTO service_catalog (id, name, description, icon) VALUES
    -- IAs
    ('a0000000-0000-0000-0000-000000000001', 'ChatGPT / OpenAI', 'Ecossistema OpenAI', 'bot'),
    ('a0000000-0000-0000-0000-000000000002', 'Claude / Anthropic', 'Modelos Claude AI', 'bot'),
    ('a0000000-0000-0000-0000-000000000003', 'Gemini / Google AI', 'Modelos Gemini e Bard', 'bot'),
    ('a0000000-0000-0000-0000-000000000004', 'Copilot / Microsoft', 'Microsoft Copilot', 'bot'),
    
    -- Redes Sociais
    ('b0000000-0000-0000-0000-000000000001', 'X / Twitter', 'Rede social X', 'twitter'),
    ('b0000000-0000-0000-0000-000000000002', 'Instagram', 'Rede social Meta', 'instagram'),
    ('b0000000-0000-0000-0000-000000000003', 'Facebook', 'Rede social Meta', 'facebook'),
    ('b0000000-0000-0000-0000-000000000004', 'TikTok', 'Vídeos curtos ByteDance', 'smartphone'),
    ('b0000000-0000-0000-0000-000000000005', 'LinkedIn', 'Rede profissional', 'linkedin'),

    -- Foruns / Comunidades
    ('c0000000-0000-0000-0000-000000000001', 'Reddit', 'Fórum gigante The Front Page', 'message-square'),
    ('c0000000-0000-0000-0000-000000000002', 'Discord', 'Acesso aos domínios do Discord', 'message-square'),
    
    -- Streaming
    ('d0000000-0000-0000-0000-000000000001', 'YouTube', 'Plataforma de vídeos', 'youtube'),
    ('d0000000-0000-0000-0000-000000000002', 'Netflix', 'Streaming de filmes', 'play-circle'),
    
    -- Mensageria
    ('e0000000-0000-0000-0000-000000000001', 'WhatsApp', 'Mensagens e Web', 'message-circle'),
    ('e0000000-0000-0000-0000-000000000002', 'Telegram', 'Aplicativo de mensagens', 'message-circle');

-- 4. Inserir Domínios dos Serviços
INSERT INTO service_domains (service_id, domain) VALUES
    -- ChatGPT
    ('a0000000-0000-0000-0000-000000000001', 'openai.com'),
    ('a0000000-0000-0000-0000-000000000001', 'chatgpt.com'),
    ('a0000000-0000-0000-0000-000000000001', 'auth.openai.com'),
    ('a0000000-0000-0000-0000-000000000001', 'platform.openai.com'),
    -- Claude
    ('a0000000-0000-0000-0000-000000000002', 'claude.ai'),
    ('a0000000-0000-0000-0000-000000000002', 'anthropic.com'),
    -- Gemini
    ('a0000000-0000-0000-0000-000000000003', 'gemini.google.com'),
    ('a0000000-0000-0000-0000-000000000003', 'bard.google.com'),
    ('a0000000-0000-0000-0000-000000000003', 'ai.google.dev'),
    
    -- X 
    ('b0000000-0000-0000-0000-000000000001', 'x.com'),
    ('b0000000-0000-0000-0000-000000000001', 'twitter.com'),
    -- Categoria 2: Redes Sociais
    -- X / Twitter
    ('b0000000-0000-0000-0000-000000000001', 'twitter.com'),
    ('b0000000-0000-0000-0000-000000000001', 'x.com'),
    ('b0000000-0000-0000-0000-000000000001', 't.co'),
    ('b0000000-0000-0000-0000-000000000001', 'twimg.com'),
    ('b0000000-0000-0000-0000-000000000001', 'abs.twimg.com'),
    ('b0000000-0000-0000-0000-000000000001', 'pbs.twimg.com'),
    ('b0000000-0000-0000-0000-000000000001', 'video.twimg.com'),

    -- Instagram
    ('b0000000-0000-0000-0000-000000000002', 'instagram.com'),
    ('b0000000-0000-0000-0000-000000000002', 'cdninstagram.com'),
    ('b0000000-0000-0000-0000-000000000002', 'igcdn.com'),

    -- Facebook
    ('b0000000-0000-0000-0000-000000000003', 'facebook.com'),
    ('b0000000-0000-0000-0000-000000000003', 'fb.com'),
    ('b0000000-0000-0000-0000-000000000003', 'fbcdn.net'),
    ('b0000000-0000-0000-0000-000000000003', 'fbsbx.com'),
    ('b0000000-0000-0000-0000-000000000003', 'messenger.com'),
    ('b0000000-0000-0000-0000-000000000003', 'messengercdn.com'),
    ('b0000000-0000-0000-0000-000000000003', 'meta.com'),
    ('b0000000-0000-0000-0000-000000000003', 'm.facebook.com'),
    ('b0000000-0000-0000-0000-000000000003', 'fb.me'),

    -- TikTok
    ('b0000000-0000-0000-0000-000000000004', 'tiktok.com'),
    ('b0000000-0000-0000-0000-000000000004', 'tiktokcdn.com'),
    ('b0000000-0000-0000-0000-000000000004', 'tiktokv.com'),
    ('b0000000-0000-0000-0000-000000000004', 'byteoversea.com'),
    ('b0000000-0000-0000-0000-000000000004', 'ibytedtos.com'),
    ('b0000000-0000-0000-0000-000000000004', 'ibyteimg.com'),
    ('b0000000-0000-0000-0000-000000000004', 'musical.ly'),

    -- LinkedIn
    ('b0000000-0000-0000-0000-000000000005', 'linkedin.com'),
    ('b0000000-0000-0000-0000-000000000005', 'licdn.com'),

    -- Reddit
    ('c0000000-0000-0000-0000-000000000001', 'reddit.com'),
    ('c0000000-0000-0000-0000-000000000001', 'redd.it'),
    ('c0000000-0000-0000-0000-000000000001', 'redditmedia.com'),

    -- Discord
    ('c0000000-0000-0000-0000-000000000002', 'discord.com'),
    ('c0000000-0000-0000-0000-000000000002', 'discord.gg'),
    ('c0000000-0000-0000-0000-000000000002', 'discordapp.com'),
    ('c0000000-0000-0000-0000-000000000002', 'discordapp.net'),
    
    -- YouTube
    ('d0000000-0000-0000-0000-000000000001', 'youtube.com'),
    ('d0000000-0000-0000-0000-000000000001', 'youtu.be'),
    ('d0000000-0000-0000-0000-000000000001', 'ytimg.com'),
    ('d0000000-0000-0000-0000-000000000001', 'googlevideo.com'),
    
    -- WhatsApp
    ('e0000000-0000-0000-0000-000000000001', 'whatsapp.com'),
    ('e0000000-0000-0000-0000-000000000001', 'whatsapp.net'),
    ('e0000000-0000-0000-0000-000000000001', 'web.whatsapp.com'),
    ('e0000000-0000-0000-0000-000000000001', 'wa.me'),
    ('e0000000-0000-0000-0000-000000000001', 'mmg.whatsapp.net'),
    ('e0000000-0000-0000-0000-000000000001', 'dit.whatsapp.net'),
    ('e0000000-0000-0000-0000-000000000001', 'static.whatsapp.net'),
    ('e0000000-0000-0000-0000-000000000001', 'g.whatsapp.net'),
    ('e0000000-0000-0000-0000-000000000001', 'c.whatsapp.net'),
    ('e0000000-0000-0000-0000-000000000001', 'e.whatsapp.net'),
    ('e0000000-0000-0000-0000-000000000001', 'mms.whatsapp.net'),
    ('e0000000-0000-0000-0000-000000000001', 'media.whatsapp.net'),
    ('e0000000-0000-0000-0000-000000000001', 'pps.whatsapp.net');

-- 5. Inserir Tenants (Clientes Fictícios)
INSERT INTO tenants (id, name, contact_name, email, status) VALUES
    ('99999999-9999-9999-9999-999999999991', 'Empresa Alpha Ltda', 'João Silva', 'contato@alpha.com', 'active'),
    ('99999999-9999-9999-9999-999999999992', 'Escola Beta (Colégio)', 'Maria Souza', 'ti@escolabeta.edu.br', 'active');

-- 6. Inserir Origens de Rede dos Tenants
INSERT INTO tenant_network_origins (tenant_id, type, value, description) VALUES
    ('99999999-9999-9999-9999-999999999991', 'ip', '192.168.1.100', 'Matriz Alpha'),
    ('99999999-9999-9999-9999-999999999991', 'dyndns', 'alpha-filial.ddns.net', 'Filial Alpha'),
    ('99999999-9999-9999-9999-999999999992', 'ip', '10.0.0.50', 'Rede Alunos');

-- 7. Configurar Toggles de Bloqueio para a Empresa Alpha
INSERT INTO tenant_block_toggles (tenant_id, type, target_id) VALUES
    ('99999999-9999-9999-9999-999999999991', 'category', '11111111-1111-1111-1111-111111111111'), -- Bloqueia Pornografia genérica
    ('99999999-9999-9999-9999-999999999991', 'service', 'b0000000-0000-0000-0000-000000000004'); -- Bloqueia TikTok

-- 8. Inserir Regras Manuais
INSERT INTO manual_rules (tenant_id, domain, action, notes) VALUES
    ('99999999-9999-9999-9999-999999999991', 'site-suspeito.com', 'block', 'Solicitado pela diretoria'),
    ('99999999-9999-9999-9999-999999999992', 'educacional-games.com', 'allow', 'Liberado para aula de informática');

-- 9. Inserir Página de Bloqueio Customizada (Escola Beta)
INSERT INTO block_pages (tenant_id, title, subtitle, primary_color) VALUES
    ('99999999-9999-9999-9999-999999999992', 'Acesso Restrito', 'Rede da Escola Beta', '#1d4ed8');
