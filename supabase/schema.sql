-- ZIM DNS Initial Schema

-- Enables uuid extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ROLES ENUM
CREATE TYPE user_role AS ENUM ('super_admin', 'tecnico', 'cliente');
CREATE TYPE rule_action AS ENUM ('allow', 'block');
CREATE TYPE entity_status AS ENUM ('active', 'inactive');
CREATE TYPE origin_type AS ENUM ('ip', 'dyndns');
CREATE TYPE origin_status AS ENUM ('active', 'error', 'pending');
CREATE TYPE sync_status_type AS ENUM ('pending', 'success', 'error');

-- 1. PROFILES
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'cliente',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CLIENTS (Antigo Tenants)
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    status entity_status DEFAULT 'active',
    primary_dns_ip TEXT, 
    secondary_dns_ip TEXT,
    notes TEXT,
    technical_id UUID REFERENCES profiles(id),
    last_sync_at TIMESTAMPTZ,
    sync_status sync_status_type DEFAULT 'pending',
    sync_error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CLIENT_NETWORKS (Identificação da rede do cliente)
CREATE TABLE client_networks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    type origin_type NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    resolved_ip TEXT,
    is_active BOOLEAN DEFAULT true,
    last_resolved_at TIMESTAMPTZ,
    resolution_status origin_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CLIENT_POLICIES (Toggles de bloqueio rápido)
CREATE TABLE client_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    policy_name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, policy_name)
);

-- 5. CLIENT_USERS (Para caso de clientes acessarem painel)
CREATE TABLE client_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role user_role DEFAULT 'cliente',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, user_id)
);

-- 6. SERVICE_CATALOG (Ex: YouTube, OpenAI)
CREATE TABLE service_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    status entity_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SERVICE_DOMAINS
CREATE TABLE service_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID REFERENCES service_catalog(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_id, domain)
);

-- 8. BLOCK_CATEGORIES  (Ex: Redes Sociais, Porno)
CREATE TABLE block_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    status entity_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. CATEGORY_DOMAINS
CREATE TABLE category_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES block_categories(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category_id, domain)
);

-- 10. MANUAL_RULES
CREATE TABLE manual_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    action rule_action NOT NULL,
    notes TEXT,
    status entity_status DEFAULT 'active',
    priority INTEGER DEFAULT 0,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. BLOCK_PAGES (Configuração visual de bloqueio)
CREATE TABLE block_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'Acesso Bloqueado',
    subtitle TEXT,
    description TEXT DEFAULT 'Este site foi bloqueado pela política de segurança da sua empresa. Caso precise de acesso, contate o administrador.',
    primary_color TEXT DEFAULT '#ef4444',
    button_text TEXT DEFAULT 'Voltar',
    button_url TEXT,
    footer_text TEXT,
    show_domain BOOLEAN DEFAULT true,
    show_reason BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id)
);

-- 12. DNS_EVENTS
CREATE TABLE dns_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    action rule_action NOT NULL,
    reason TEXT,
    client_ip TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. BLOCK_LOGS
CREATE TABLE block_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    policy_name TEXT,
    client_ip TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. AUDIT_LOGS
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. GLOBAL_SETTINGS
CREATE TABLE global_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adguard_api_url TEXT,
    last_connection_status origin_status DEFAULT 'pending',
    last_connection_check_at TIMESTAMPTZ,
    last_connection_error TEXT,
    environment TEXT DEFAULT 'production',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- UPDATE TIMESTAMPS TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_client_networks_updated_at BEFORE UPDATE ON client_networks FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_client_policies_updated_at BEFORE UPDATE ON client_policies FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_service_catalog_updated_at BEFORE UPDATE ON service_catalog FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_block_categories_updated_at BEFORE UPDATE ON block_categories FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_manual_rules_updated_at BEFORE UPDATE ON manual_rules FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_block_pages_updated_at BEFORE UPDATE ON block_pages FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_global_settings_updated_at BEFORE UPDATE ON global_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- RLS POLICIES (Básica)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Catalog reads are public for authenticated" ON service_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catalog domains are public for authenticated" ON service_domains FOR SELECT TO authenticated USING (true);
CREATE POLICY "Categories reads are public for authenticated" ON block_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Category domains reads are public for authenticated" ON category_domains FOR SELECT TO authenticated USING (true);
