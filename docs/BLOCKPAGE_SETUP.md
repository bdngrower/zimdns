# Configuração da Página de Bloqueio (Blockpage) End-to-End

Quando um usuário acessa um domínio bloqueado pelo ZIM DNS (AdGuard Home), o comportamento padrão do motor é retornar o IP `0.0.0.0` (NXDOMAIN), o que resulta no erro **"This site can't be reached"** no navegador.

Para redirecionar o usuário para a bela página `/blocked` do ZIM DNS, precisamos configurar o AdGuard para usar o modo **Custom IP**.

## O Problema Arquitetural (Serverless)
O ZIM DNS é hospedado na Vercel (ou outro provedor serverless). A Vercel depende do cabeçalho de Host HTTP (`Host: zimdns.vercel.app`) para rotear o tráfego. 
Se você colocar o IP direto da Vercel no AdGuard, o navegador do usuário vai tentar acessar `[IP DA VERCEL]` pedindo pelo host `youtube.com`. A Vercel não vai encontrar o YouTube nos seus servidores e retornará um erro 404/SSL da própria plataforma, quebrando a navegação antes de exibir a sua página `/blocked`.

## A Solução: Servidor Proxy "Catch-All" (Nginx)

Para fechar o fluxo de ponta a ponta, você precisa de um pequeno servidor **Nginx** (pode ser instalado na mesma máquina AWS onde roda o seu AdGuard Master). Este servidor vai interceptar todas as chamadas HTTP bloqueadas e fazer um redirecionamento limpo (HTTP 302) para a sua URL da Vercel, passando o domínio original no link.

### Passo 1: Instale o Nginx na sua máquina AWS (AdGuard)

```bash
sudo apt update
sudo apt install nginx -y
```

### Passo 2: Configure o Bloco "Catch-All"

Crie ou edite o arquivo padrão do Nginx:
```bash
sudo nano /etc/nginx/sites-available/default
```

Substitua todo o conteúdo por este bloco (Lembre-se de trocar `SEU_APP.vercel.app` pela sua URL de produção):

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    # Captura o dominio acessado pela variável $host
    server_name _;

    # Redireciona tudo para o painel ZIM DNS passando o host como query string
    return 302 https://SEU_APP.vercel.app/blocked?domain=$host;
}
```

*Nota sobre HTTPS: Interceptar HTTPS (porta 443) de domínios aleatórios geraria alerta de certificado inválido no navegador do usuário de qualquer forma (HSTS). O redirecionamento na porta 80 é o padrão prático para blockpages.*

### Passo 3: Reinicie o Nginx

```bash
sudo nginx -t
sudo systemctl restart nginx
```

### Passo 4: Ative no ZIM DNS

Agora que seu Nginx está rodando e redirecionando as URLs, acesse o painel **Configurações do Sistema** no ZIM DNS.
1. Localize a seção **Página de Bloqueio Personalizada**.
2. Insira o endereço de IP público desta sua máquina AWS/Nginx.
3. Clique em Aplicar.

O ZIM DNS mandará a instrução via API para o AdGuard:
- `blocking_mode = custom_ip`
- `blocking_ipv4 = SEU_IP_NGINX`

### Fluxo Final
1. Usuário tenta acessar `facebook.com`
2. AdGuard bloqueia e responde: `IP = SUAMAQUINA_AWS`
3. Navegador chama `http://SUAMAQUINA_AWS` (com host facebook.com)
4. Nginx intercepta e responde: `302 Redirect -> https://zimdns.vercel.app/blocked?domain=facebook.com`
5. Navegador exibe o escudo vermelho premium do ZIM DNS!
