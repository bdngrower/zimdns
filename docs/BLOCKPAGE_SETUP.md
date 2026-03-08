# Configuração da Página de Bloqueio (Blockpage) End-to-End

Quando um usuário acessa um domínio bloqueado pelo ZIM DNS (AdGuard Home), o comportamento padrão do motor é retornar o IP `0.0.0.0` (NXDOMAIN), o que resulta no erro abstrato **"This site can't be reached"** no navegador.

Para redirecionar o usuário para a página visual `/blocked` do ZIM DNS, precisamos configurar o AdGuard para usar o modo **Custom IP**.

## O Ponto Cego do DNS (Portas 80 / 443)
O protocolo DNS serve apenas para traduzir um Nome (Ex: facebook.com) para um IP (Ex: 54.12.33.4). **O DNS NÃO retorna portas**.
Se o usuário digitou `http://facebook.com` no navegador, o navegador vai bater na **porta 80** do IP que o DNS retornou.
Portanto, é impossível usar algo como `http://MEU_IP:8081` diretamente no Custom IP do bloqueio DNS.

## O Problema Arquitetural (Serverless e SNI)
O ZIM DNS é hospedado na Vercel (ou outro provedor serverless). A Vercel usa o cabeçalho de Host HTTP (`Host: zimdns.vercel.app`) para rotear para as funções corretas.
Se você colocar o *IP direto da Vercel* no AdGuard, o navegador do usuário acessará a Vercel com o cabeçalho `Host: facebook.com`. A Vercel vai retornar um erro 404 (Domain Not Found), pois ela não reconhece esse domínio.

## A Solução Definitiva: Servidor Proxy "Catch-All" (Nginx)

Precisamos de um servidor Nginx, rodando em um IP público fixo e escutando **obrigatoriamente na porta 80**, para capturar esse tráfego e fazer um redirecionamento HTTP 302 explícito para a aplicação Vercel.

**💡 Boa Prática:** Instale este Nginx na própria máquina EC2 onde o AdGuard Home já opera.

### Passo 1: Libere a Porta 80 do AdGuard
Por padrão, o painel do AdGuard Home é instalado na porta 80. Precisamos liberar essa porta para o Nginx.
1. Edite o `AdGuardHome.yaml`.
2. Altere `bind_port: 80` para `bind_port: 3000` (ou 8080).
3. Reinicie o AdGuard.

### Passo 2: Instale o Nginx

```bash
sudo apt update
sudo apt install nginx -y
```

### Passo 3: Configure o Bloco "Catch-All" na porta 80

Edite o arquivo de configuração e delete tudo:
```bash
sudo nano /etc/nginx/sites-available/default
```

Insira este conteúdo substituindo a URL da Vercel pela sua URL em produção:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    # O "_" aceita qualquer host
    server_name _;

    # Redireciona tudo para o painel ZIM DNS passando o host como query string
    return 302 https://SEU_ZIM_APP.vercel.app/blocked?domain=$host;
}
```

*Nota sobre HTTPS (Porta 443): Bloqueios de sites modernos via HTTPS gerarão alerta de certificado SSL inválido (Sec_Error_Unknown_Issuer) independente da ferramenta, pois trata-se de um design de segurança do HSTS que não pode ser burlado de fora. A Blockpage em nível DNS captura e funciona de forma transparente primariamente sobre conexões HTTP plano ou onde o HSTS/HTTPS estrito não está em cache.*

### Passo 4: Reinicie o Nginx

```bash
sudo nginx -t
sudo systemctl restart nginx
```

### Passo 5: Ative no ZIM DNS

Acesse a UI web do ZIM DNS > **Configurações do Sistema**.
1. Localize a seção **Página de Bloqueio (UX)**.
2. Insira o IP público do seu servidor (Aquele que roda o novo Nginx, provavelmente a EC2 do AdGuard).
3. Clique em Aplicar IP.

O ZIM DNS registrará via API no AdGuard globalmente as chaves principais:
- `blocking_mode: custom_ip`
- `blocking_ipv4: [SEU_IP_DA_EC2]`

### Fluxo Ponta a Ponta Finalizado
1. Cliente tenta acessar `http://jogosonline.com`.
2. AdGuard bloqueia e responde o seu IP Customizado via DNS (`SEU_IP_DA_EC2`).
3. O Navegador bate na porta 80 do `SEU_IP_DA_EC2` pedindo `Host: jogosonline.com`.
4. Nginx intercepta (devido ao `default_server` e `_`) e envia um 302 Redirect.
5. ZIM DNS na Vercel recebe o redirecionamento com o argumento web em `https://zimdns.vercel.app/blocked?domain=jogosonline.com`.
6. O Shield Visual UI da sua marca aparece para o cliente na tela inteira.
