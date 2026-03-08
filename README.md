# ZIM DNS Manager

ZIM DNS Manager é um painel SaaS multi-tenant desenvolvido com React, Vite e Supabase, desenhado para provedores e técnicos gerenciarem políticas de bloqueio de DNS de seus clientes usando o [AdGuard Home] como motor de resolução.

## 🚀 Tecnologias

- **Frontend:** React 18, TypeScript, Tailwind CSS v4, Lucide React, Zustand, React Router.
- **Backend (Dados & Auth):** Supabase (PostgreSQL + Row-Level Security).
- **Backend (Integração DNS):** Serverless API Route na nuvem.
- **DNS Engine:** AdGuard Home (Hospedado isoladamente na AWS/VPS em nuvem).

---

## 🛠 Como Executar Localmente

### 1. Configuração do Supabase
Crie um projeto no [Supabase](https://supabase.com).
Vá no editor SQL do Supabase e execute os seguintes arquivos (nesta ordem):
1. `supabase/schema.sql` (Cria a estrutura de tabelas, tipos e RLS)
2. `supabase/seed.sql` (Insere categorias de IA, Redes Sociais, Streaming, etc. e Tenants de exemplo)

### 2. Configurando o Frontend
Clone o repositório e instale as dependências:
```bash
npm install
```

Crie um arquivo `.env` na raiz do projeto com as suas credenciais do Supabase e do Servidor DNS AdGuard AWS que as rotas *Serverless API* conversarão:
```env
# Banco de Dados
VITE_SUPABASE_URL=sua_url_aqui
VITE_SUPABASE_ANON_KEY=sua_key_aqui

# Integração DNS API (AdGuard Home na AWS/VPS)
ADGUARD_API_URL=http://<IP_DO_SERVIDOR_DNS_AWS>
ADGUARD_USERNAME=admin
ADGUARD_PASSWORD=senha
```

Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

---

## 🔒 Arquitetura e Segurança do Motor DNS (AdGuard Home)

O motor DNS que executa os bloqueios reais (AdGuard Home) fica isolado numa instância na nuvem (ex: AWS EC2). O **painel web (ZIM DNS)** possui toda a lógica de negócio, categorização de clientes (Tenants) e catálogo de serviços. 

**Importante: O AdGuard NÃO armazena lógica de tenant, apenas regras cruas agrupadas por "Clients" (IPs).**

### Fluxo de Sincronização
Para não expor credenciais do motor DNS no navegador, a aplicação utiliza uma camada backend restrita (`src/lib/dnsIntegrationService.ts`):
1. O técnico configura os Switches ou permite Domínios no ZIM DNS Manager.
2. Ao realizar alguma alteração, é feito log do Supabase (`audit_logs`) e o status do cliente vai para "Pendente".
3. Uma função serverless lê do banco regras efetivas do provedor, formata para a API do AdGuard e despacha as regras via interface REST. (Protegida por variáveis de ambiente `ADGUARD_API_URL` e senhas da API).

### Restrições de Segurança (Importante)
A interface de administração bruta HTTP (Painel Original) alojado no servidor externo **NUNCA deve ficar exposta publicamente**. O ZIM DNS abstrai isso.
1. **Firewall Inbound (Security Groups):**
   - Público Total (0.0.0.0/0): Liberar apenas DNS em `UDP 53`, `TCP 53`, `TCP 853`.
   - Restrito / Privado: Bloquear as portas WEB (80/3000) de admin do AdGuard para a internet ampla e liberar *somente* para o(s) IP(s) associados ao Worker/Vercel do painel ZIM DNS ou a VPN da Diretoria.
2. O Painel principal do AdGuard servirá aos administradores somente em casos de trouble-shooting em baixo nível ou manutenção do servidor. Todo onboarding corre via ZIM DNS.

---
*Projeto gerado e documentado usando IA para arquitetura base limpa e resiliente.*
