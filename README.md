# vendApps â€” Plataforma de GestÃ£o Comercial Multi-tenant

> **SaaS completo para negÃ³cios que vendem.** Do catÃ¡logo online ao PDV, do iFood ao WhatsApp, da comanda Ã  nota fiscal â€” tudo em um lugar, acessÃ­vel de qualquer dispositivo, sem instalaÃ§Ã£o.

---

## O que Ã© o vendApps?

O vendApps Ã© uma plataforma SaaS multi-tenant que centraliza toda a operaÃ§Ã£o de um negÃ³cio â€” food service, varejo ou serviÃ§os â€” em uma Ãºnica ferramenta. Cada cliente recebe seu prÃ³prio subdomÃ­nio (`suaempresa.vendapps.com.br`) com catÃ¡logo pÃºblico, painel administrativo e PDV completamente isolados.

A equipe acessa pelo celular ou computador. O cliente faz o pedido pelo link, pelo QR Code da mesa ou pelo iFood. Tudo entra no mesmo sistema, imprime na mesma impressora, aparece no mesmo painel.

---

## Como o vendApps transforma o seu negÃ³cio

### Antes
- CardÃ¡pio no papel ou no grupo de WhatsApp, desatualizado, sem foto
- Pedidos anotados em bloco, fÃ¡cil de errar e perder
- Pedido do iFood digitado manualmente no sistema interno
- Impressora sem automaÃ§Ã£o â€” barista precisa ser chamado o tempo todo
- Caixa fechado no feeling, sem saber o que entrou de verdade
- Nota fiscal emitida na mÃ£o, uma por uma
- Estoque no caderno, compra feita quando acaba

### Depois
- CatÃ¡logo digital atualizado em tempo real, com foto e preÃ§o correto
- Pedido do iFood entra direto no sistema â€” sem redigitar nada
- Comanda impressa automaticamente quando o pedido chega â€” barista jÃ¡ comeÃ§a
- Caixa fechado com relatÃ³rio completo em 1 clique
- NFC-e emitida automaticamente no fechamento de cada venda
- Estoque descontado a cada venda, alerta antes de acabar
- Tudo no celular, sem papel, sem planilha, sem adivinhaÃ§Ã£o

---

## Atualizacao Recente (abril 2026)

- Catalogo publico e catalogo de mesa no modo moderno agora usam o mesmo grid visual do PDV (cards compactos, badge de Top/adicionais, categorias em painel 2 colunas no desktop e chips `min-w-[150px]` no mobile).
- Responsividade otimizada para celular e tablet no modo moderno, reduzindo rolagem vertical excessiva.
- Mantidos os fluxos existentes de finalizacao (checkout delivery e fluxo de mesa) e isolamento por tenant via feature flag `modern_catalog_experience`.

---

## Funcionalidades

### CatÃ¡logo Online
- Vitrine pÃºblica responsiva, otimizada para mobile e para Google
- **ExperiÃªncia moderna opcional por tenant (feature flag):** layout em grade com categorias laterais, busca fixa, cards compactos e carrinho no padrÃ£o operacional (PDV/DAV), com foco em celular e tablet
- Categorias com filtro, busca em tempo real e banner rotativo configurÃ¡vel
- Carrinho persistente com controle de quantidade e subtotal ao vivo
- Checkout com auto-preenchimento de CEP (ViaCEP), mÃºltiplas formas de pagamento e cÃ¡lculo de troco
- NotificaÃ§Ã£o automÃ¡tica do pedido via WhatsApp com nÃºmero e resumo financeiro
- Identidade visual configurÃ¡vel por tenant: cor principal, logo e banner

### Autoatendimento por Mesa / QR Code
- QR Code Ãºnico por mesa â€” cliente escaneia e abre o cardÃ¡pio no prÃ³prio celular
- Pedido feito pelo cliente jÃ¡ entra automaticamente na fila da cozinha/barista
- IdentificaÃ§Ã£o do cliente por nÃºmero de telefone antes de fazer o pedido
- Suporte a pedidos com adicionais e observaÃ§Ãµes por item
- **Quando o catÃ¡logo moderno estÃ¡ ativo no tenant:** experiÃªncia de mesa com grid moderno e seleÃ§Ã£o de adicionais em step-by-step (mesmo mecanismo do PDV)
- Ideal para cafeterias, restaurantes, food courts e espaÃ§os de coworking

### PDV â€” Ponto de Venda
- Interface otimizada para toque, com produtos organizados por categoria
- Busca instantÃ¢nea por nome, cÃ³digo interno ou cÃ³digo de barras
- Suporte nativo a leitor de cÃ³digo de barras USB e balanÃ§a integrada
- **SeleÃ§Ã£o de adicionais step-by-step:** fluxo guiado por grupos configurÃ¡veis (ex: Tipo de Leite â†’ Cobertura â†’ Extras) com radio/checkbox, barra de progresso e auto-avanÃ§o ao escolher opÃ§Ã£o Ãºnica
- Variantes de produto (P/M/G, quente/gelado, 200ml/400ml)
- SessÃ£o de caixa com abertura, sangria, suprimento e fechamento com relatÃ³rio
- MÃºltiplas formas de pagamento combinadas na mesma venda
- Cupom impresso automaticamente ao finalizar

### Atendimento TelefÃ´nico / BalcÃ£o
- Busca de cliente por telefone com histÃ³rico de pedidos e sugestÃ£o de recompra
- Montagem de pedido com adicionais, variantes e observaÃ§Ãµes
- CÃ¡lculo automÃ¡tico de totais e troco em tempo real

### ImpressÃ£o AutomÃ¡tica
- Comanda impressa assim que o pedido chega â€” do iFood, da mesa, do site ou do balcÃ£o
- ComunicaÃ§Ã£o em tempo real via WebSocket (SignalR) â€” sem delay, sem polling
- **PrintAgent (Windows):** worker service leve instalado localmente, conectado ao hub na nuvem; imprime silenciosamente sem dialog; suporta impressoras USB, serial, rede e Bluetooth (pareada com o PC)
- **Agente Mobile (Android/iPad):** tablet vira estaÃ§Ã£o de impressÃ£o sem instalar nada â€” modo Bluetooth (Web Bluetooth API, Chrome Android, totalmente silencioso) ou modo AirPrint/Navegador (compatÃ­vel com iPad via dialog nativo do iOS)
- Suporte a mÃºltiplas impressoras por empresa
- Pedido avanÃ§a para **Em preparo** automaticamente ao ser impresso
- ConfiguraÃ§Ãµes do agente mobile persistem no dispositivo â€” atendente pode trocar de turno sem reconfigurar

### IntegraÃ§Ã£o iFood
- Webhook recebe eventos do iFood e responde em menos de 1 segundo
- Novo pedido (PLACED) criado automaticamente no sistema â€” zero intervenÃ§Ã£o manual
- Status enviado de volta ao iFood em cada etapa: confirmado â†’ pronto â†’ saiu â†’ entregue
- Sync de cardÃ¡pio: preÃ§os e disponibilidade atualizados em lote (atÃ© 100 itens por requisiÃ§Ã£o)
- Suporte a mÃºltiplas lojas do mesmo cliente no iFood
- ConfiguraÃ§Ã£o em 3 campos: ClientId + ClientSecret + MerchantId

### WhatsApp
- NotificaÃ§Ã£o automÃ¡tica ao cliente quando o pedido Ã© criado ou atualizado
- **Complemento de fidelidade:** mensagem automÃ¡tica com pontos ganhos e saldo apÃ³s cada compra PDV (template configurÃ¡vel por empresa, independente de NFC-e)
- Webhook de entrada para receber e responder mensagens de clientes no painel
- Roteamento inteligente de conversas por empresa
- IdempotÃªncia garantida: cada notificaÃ§Ã£o Ã© enviada exatamente uma vez por evento

### GestÃ£o de Pedidos
- Painel em tempo real com todos os pedidos do dia por canal
- Filtros por status, canal (web, mesa, iFood, telefone) e perÃ­odo
- Timeline de status por pedido com timestamps precisos
- Detalhe completo: itens, adicionais, forma de pagamento, endereÃ§o e mapa
- Fluxo de status adaptado ao tipo de operaÃ§Ã£o: delivery (saiu para entrega) ou balcÃ£o/mesa (pronto para servir)

### GestÃ£o de Clientes e Fidelidade
- Cadastro automÃ¡tico na primeira compra por telefone
- HistÃ³rico completo de pedidos e ticket mÃ©dio por cliente
- Programa de fidelidade configurÃ¡vel: pontos por real gasto
- IdentificaÃ§Ã£o por CPF **ou por telefone** â€” ambos acumulam pontos corretamente
- Resgate de pontos no checkout e no balcÃ£o
- NotificaÃ§Ã£o WhatsApp de pontos acumulados apÃ³s cada compra PDV, independente de NFC-e
- RelatÃ³rio de clientes mais fiÃ©is, frequÃªncia e LTV

### Fiscal â€” NFC-e
- EmissÃ£o automÃ¡tica de NFC-e no fechamento de venda no PDV
- ContingÃªncia offline: documentos emitidos sem internet, transmitidos depois
- ConfiguraÃ§Ã£o por caixa: CNPJ, CSC, sÃ©rie, certificado digital A1
- Suporte a Simples Nacional e Lucro Presumido
- Fila de reprocessamento automÃ¡tico para documentos rejeitados pela SEFAZ

### Estoque
- Desconto automÃ¡tico de estoque a cada venda PDV
- Entrada manual por recebimento de compra
- Ajuste e inventÃ¡rio com histÃ³rico de movimentaÃ§Ãµes
- Alertas de nÃ­vel mÃ­nimo por produto

### Compras e Fornecedores
- Cadastro de fornecedores com histÃ³rico de compras
- Pedido de compra com itens e preÃ§os acordados
- Recebimento que atualiza estoque e custo mÃ©dio automaticamente

### Financeiro
- LanÃ§amentos de receita e despesa categorizados
- ConciliaÃ§Ã£o automÃ¡tica com vendas do PDV
- RelatÃ³rio de fluxo de caixa por perÃ­odo

### Agenda de ServiÃ§os
- Agendamento com tipo de serviÃ§o, duraÃ§Ã£o estimada e responsÃ¡vel
- VisÃ£o de calendÃ¡rio por dia e semana
- ConfirmaÃ§Ã£o automÃ¡tica por WhatsApp

### ComissÃµes e Gorjetas
- ComissÃ£o por vendedor configurÃ¡vel individualmente
- Pool de gorjetas com distribuiÃ§Ã£o automÃ¡tica proporcional entre a equipe
- RelatÃ³rio mensal de comissÃµes com breakdown por funcionÃ¡rio

### GestÃ£o de CatÃ¡logo
- CRUD completo de produtos com foto, descriÃ§Ã£o, variantes e adicionais
- **Grupos de adicionais configurÃ¡veis:** organize adicionais em etapas (ex: Tipo de Leite â†’ Cobertura â†’ Extras) com seleÃ§Ã£o Ãºnica (radio) ou mÃºltipla (checkbox) por grupo
- ClassificaÃ§Ã£o automÃ¡tica na inicializaÃ§Ã£o: adicionais existentes sÃ£o organizados em grupos por padrÃ£o de nome sem intervenÃ§Ã£o manual
- Categorias com ordenaÃ§Ã£o personalizada e slug automÃ¡tico
- Enriquecimento automÃ¡tico: normalizaÃ§Ã£o de nomes e busca de imagens por cÃ³digo de barras (base Cosmos/Bluesoft)
- Sync bidirecional com sistemas externos via conectores CSV, REST ou banco de dados
- HistÃ³rico de alteraÃ§Ãµes e preÃ§os por produto

### DAV / OrÃ§amentos
- CriaÃ§Ã£o de orÃ§amento com itens e validade
- Envio do orÃ§amento por WhatsApp com resumo financeiro
- ConversÃ£o de orÃ§amento aprovado em pedido com 1 clique

### Rotas de Entrega
- Planejamento de rotas com otimizaÃ§Ã£o por OpenRouteService (ORS)
- App do entregador com atualizaÃ§Ãµes de status por parada
- NavegaÃ§Ã£o integrada com Google Maps e Waze
- Rastreamento em tempo real no painel admin

### App do Entregador

PWA mobile-first dedicado ao entregador â€” sem instalaÃ§Ã£o, acessÃ­vel pelo navegador do celular.

**AutenticaÃ§Ã£o**
- Login por telefone + PIN (sem senha longa para facilitar o uso no campo)
- JWT com role `deliverer`, vinculado Ã  empresa pelo `CompanyId`
- SessÃ£o persistida no `localStorage`; redirecionamento automÃ¡tico ao abrir o app

**Tela Inicial â€” Minhas Rotas**
- Lista todas as rotas ativas atribuÃ­das ao entregador
- Exibe status da rota (Pendente / Em andamento / ConcluÃ­da), nÃºmero de paradas e endereÃ§o geral
- AtualizaÃ§Ã£o automÃ¡tica a cada **30 segundos** via polling (sem WebSocket)
- BotÃ£o "Iniciar Rota" muda o status de `Pendente` â†’ `Em andamento`

**Tela de Detalhe da Rota â€” NavegaÃ§Ã£o Stop-by-Stop**
- AtualizaÃ§Ã£o automÃ¡tica a cada **15 segundos**
- Exibe a **prÃ³xima parada** em destaque (`NextStopCard`) com nome do cliente, endereÃ§o e nÃºmero do pedido
- Lista todas as paradas com status individual (Pendente / PrÃ³xima / Entregue / Falhou / Ignorada)
- Barra de progresso com contagem de paradas concluÃ­das

**NavegaÃ§Ã£o Integrada**
- Dois botÃµes por parada: **Waze** e **Google Maps** â€” abrem o app nativo com destino preenchido
  - Waze: `waze://?ll={lat},{lon}&navigate=yes`
  - Google Maps: `https://www.google.com/maps/dir/?api=1&destination={lat},{lon}`
- Para rotas com mÃºltiplas paradas, o endpoint `/deliverer/routes/{routeId}/navigation/next` retorna URL com waypoints encadeados
- Coordenadas geocodificadas via OpenRouteService (ORS) com fallback Nominatim

**TransiÃ§Ãµes de Status por Parada**
- Cada parada comeÃ§a como `Pendente` â†’ backend avanÃ§a automaticamente a primeira para `Proxima`
- O entregador registra o desfecho de cada parada:
  - **Entregue** â€” pedido entregue com sucesso
  - **Falhou** â€” tentativa sem sucesso (abre `ReasonModal` para registrar motivo)
  - **Ignorada** â€” parada pulada (tambÃ©m requer motivo)
- Ao confirmar, o backend (`RouteStopTransitionService`) avanÃ§a automaticamente a prÃ³xima parada para `Proxima`
- Quando todas as paradas sÃ£o finalizadas, a rota muda automaticamente para `ConcluÃ­da`

**IntegraÃ§Ã£o com Pedidos**
- Cada parada estÃ¡ vinculada a um `Order`; ao marcar **Entregue**, o pedido muda para status `ENTREGUE`
- Ao marcar **Falhou/Ignorada**, o pedido volta para `PRONTO_PARA_ENTREGA`
- TransiÃ§Ã£o de status dispara notificaÃ§Ã£o WhatsApp automÃ¡tica ao cliente (quando configurado)
- QR Code por parada disponÃ­vel para confirmaÃ§Ã£o presencial de entrega

**Rastreamento no Painel Admin**
- Gestores acompanham todas as rotas em tempo real no painel administrativo
- VisÃ£o por entregador com mapa de paradas e status atualizado
- HistÃ³rico de tentativas e motivos de falha por parada

### Painel Master Admin
- VisÃ£o consolidada de todas as empresas da plataforma
- AtivaÃ§Ã£o e desativaÃ§Ã£o de features por tenant (feature flags)
- Feature flag `modern_catalog_experience` para habilitar/desabilitar o novo catÃ¡logo/carrinho pÃºblico por empresa, sem impacto nos demais tenants
- Log de auditoria de aÃ§Ãµes administrativas crÃ­ticas

---

## Stack TÃ©cnica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + Radix UI (shadcn) |
| Backend | ASP.NET Core 8 + EF Core 8 |
| Banco de Dados | PostgreSQL (NeonDB serverless em produÃ§Ã£o) |
| Realtime | SignalR (WebSocket) â€” impressÃ£o e balanÃ§a |
| Jobs agendados | Hangfire 1.8 + PostgreSQL |
| AutenticaÃ§Ã£o | JWT â€” roles: `admin`, `gerente`, `atendente`, `deliverer` |
| Deploy Frontend | Vercel (SPA + rewrite rules) |
| Deploy Backend | Render (Docker, auto-deploy via push) |
| Multi-tenant | SubdomÃ­nio detectado em runtime â†’ `CompanyId` isolado |

---

## IntegraÃ§Ãµes Externas

| ServiÃ§o | Finalidade |
|---|---|
| iFood Partner API | RecepÃ§Ã£o de pedidos via webhook + sync de cardÃ¡pio |
| WhatsApp (Evolution API) | NotificaÃ§Ãµes automÃ¡ticas e atendimento conversacional |
| ViaCEP | Preenchimento automÃ¡tico de endereÃ§o por CEP |
| Cosmos (Bluesoft) | Enriquecimento de catÃ¡logo por EAN/GTIN (base brasileira) |
| SEFAZ | EmissÃ£o de NFC-e em homologaÃ§Ã£o e produÃ§Ã£o |
| OpenRouteService (ORS) | OtimizaÃ§Ã£o de rotas e geocodificaÃ§Ã£o |
| Nominatim | GeocodificaÃ§Ã£o de endereÃ§os como fallback |

---

## Arquitetura

```
slug.vendapps.com.br
        â”‚
        â–¼
  Vercel (React SPA)          vendapps.onrender.com
     Vite + TS        â”€â”€â”€â”€â”€â”€â–º   ASP.NET Core 8
                                     â”‚
               â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
               â”‚                     â”‚                      â”‚
          NeonDB               Hangfire Jobs           SignalR Hub
        (PostgreSQL)          (sync, fiscal,         (impressoras,
       dados isolados          reprocessamento)         balanÃ§as)
        por CompanyId
```

**Multi-tenancy:** slug do subdomÃ­nio resolvido em runtime â†’ todos os dados filtrados por `CompanyId`. Zero cruzamento entre clientes.

**Plug-in de marketplace:** `IMarketplaceOrderIngester` e `IMarketplaceStatusCallback` permitem adicionar novos canais (Rappi, Uber Eats) sem alterar o core â€” implementar a interface e registrar no DI.

---

## Agentes Locais

### PrintAgent
Worker service .NET que conecta impressoras fÃ­sicas locais ao sistema na nuvem via SignalR. Imprime comandas silenciosamente sem diÃ¡logo de confirmaÃ§Ã£o. Instala como serviÃ§o Windows.

### ScaleAgent
Worker service .NET que integra balanÃ§as Filizola via porta serial (RS-232). Sincroniza peso em tempo real com o PDV via SignalR.

---

## InÃ­cio RÃ¡pido

### Backend
```bash
cd backend/Petshop.Api
# Configure appsettings.Development.json com a string de conexÃ£o PostgreSQL
dotnet run
# API: http://localhost:5082
# Swagger: http://localhost:5082/swagger
```

### Frontend
```bash
cd frontend/petshop-web
npm install
# .env.local: VITE_API_URL=http://localhost:5082
npm run dev
# http://localhost:5173
```

Na primeira execuÃ§Ã£o o `DbSeeder` cria empresa, categorias e produtos de exemplo automaticamente.

---

## VariÃ¡veis de Ambiente (ProduÃ§Ã£o)

**Backend (Render):**
```
ConnectionStrings__Default=postgresql://...
Jwt__Key=...
Jwt__Issuer=vendapps
Jwt__Audience=vendapps
Jwt__AdminUser=admin
Jwt__AdminPassword=...
Jwt__CompanyId=...
ENABLE_SWAGGER=false
```

**Frontend (Vercel):**
```
VITE_API_URL=https://vendapps.onrender.com
```

---

## Ativando a IntegraÃ§Ã£o iFood

1. No portal iFood Parceiro, gere **ClientId** e **ClientSecret**
2. Obtenha o **MerchantId** da loja
3. `POST /admin/marketplace` com as credenciais
4. Configure a URL do webhook no portal iFood:
   ```
   https://vendapps.onrender.com/webhooks/marketplace/{id-retornado}
   ```

---

## LicenÃ§a

Projeto proprietÃ¡rio â€” todos os direitos reservados.

