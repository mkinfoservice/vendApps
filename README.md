# vendApps — Plataforma de Gestão Comercial Multi-tenant

> **SaaS completo para negócios que vendem.** Do catálogo online ao PDV, do iFood ao WhatsApp, da comanda à nota fiscal — tudo em um lugar, acessível de qualquer dispositivo, sem instalação.

---

## O que é o vendApps?

O vendApps é uma plataforma SaaS multi-tenant que centraliza toda a operação de um negócio — food service, varejo ou serviços — em uma única ferramenta. Cada cliente recebe seu próprio subdomínio (`suaempresa.vendapps.com.br`) com catálogo público, painel administrativo e PDV completamente isolados.

A equipe acessa pelo celular ou computador. O cliente faz o pedido pelo link, pelo QR Code da mesa ou pelo iFood. Tudo entra no mesmo sistema, imprime na mesma impressora, aparece no mesmo painel.

---

## Como o vendApps transforma o seu negócio

### Antes
- Cardápio no papel ou no grupo de WhatsApp, desatualizado, sem foto
- Pedidos anotados em bloco, fácil de errar e perder
- Pedido do iFood digitado manualmente no sistema interno
- Impressora sem automação — barista precisa ser chamado o tempo todo
- Caixa fechado no feeling, sem saber o que entrou de verdade
- Nota fiscal emitida na mão, uma por uma
- Estoque no caderno, compra feita quando acaba

### Depois
- Catálogo digital atualizado em tempo real, com foto e preço correto
- Pedido do iFood entra direto no sistema — sem redigitar nada
- Comanda impressa automaticamente quando o pedido chega — barista já começa
- Caixa fechado com relatório completo em 1 clique
- NFC-e emitida automaticamente no fechamento de cada venda
- Estoque descontado a cada venda, alerta antes de acabar
- Tudo no celular, sem papel, sem planilha, sem adivinhação

---

## Funcionalidades

### Catálogo Online
- Vitrine pública responsiva, otimizada para mobile e para Google
- Categorias com filtro, busca em tempo real e banner rotativo configurável
- Carrinho persistente com controle de quantidade e subtotal ao vivo
- Checkout com auto-preenchimento de CEP (ViaCEP), múltiplas formas de pagamento e cálculo de troco
- Notificação automática do pedido via WhatsApp com número e resumo financeiro
- Identidade visual configurável por tenant: cor principal, logo e banner

### Autoatendimento por Mesa / QR Code
- QR Code único por mesa — cliente escaneia e abre o cardápio no próprio celular
- Pedido feito pelo cliente já entra automaticamente na fila da cozinha/barista
- Identificação do cliente por número de telefone antes de fazer o pedido
- Suporte a pedidos com adicionais e observações por item
- Ideal para cafeterias, restaurantes, food courts e espaços de coworking

### PDV — Ponto de Venda
- Interface otimizada para toque, com produtos organizados por categoria
- Busca instantânea por nome, código interno ou código de barras
- Suporte nativo a leitor de código de barras USB e balança integrada
- Adicionais de produto configuráveis (ponto do café, tamanho, extras)
- Variantes de produto (P/M/G, quente/gelado, 200ml/400ml)
- Sessão de caixa com abertura, sangria, suprimento e fechamento com relatório
- Múltiplas formas de pagamento combinadas na mesma venda
- Cupom impresso automaticamente ao finalizar

### Atendimento Telefônico / Balcão
- Busca de cliente por telefone com histórico de pedidos e sugestão de recompra
- Montagem de pedido com adicionais, variantes e observações
- Cálculo automático de totais e troco em tempo real

### Impressão Automática
- Comanda impressa assim que o pedido chega — do iFood, da mesa, do site ou do balcão
- Comunicação em tempo real via WebSocket (SignalR) — sem delay, sem polling
- Agente de impressão leve instalado localmente, conectado ao hub na nuvem
- Suporte a múltiplas impressoras por empresa
- Pedido avança para **Em preparo** automaticamente ao ser impresso

### Integração iFood
- Webhook recebe eventos do iFood e responde em menos de 1 segundo
- Novo pedido (PLACED) criado automaticamente no sistema — zero intervenção manual
- Status enviado de volta ao iFood em cada etapa: confirmado → pronto → saiu → entregue
- Sync de cardápio: preços e disponibilidade atualizados em lote (até 100 itens por requisição)
- Suporte a múltiplas lojas do mesmo cliente no iFood
- Configuração em 3 campos: ClientId + ClientSecret + MerchantId

### WhatsApp
- Notificação automática ao cliente quando o pedido é criado ou atualizado
- Webhook de entrada para receber e responder mensagens de clientes no painel
- Roteamento inteligente de conversas por empresa

### Gestão de Pedidos
- Painel em tempo real com todos os pedidos do dia por canal
- Filtros por status, canal (web, mesa, iFood, telefone) e período
- Timeline de status por pedido com timestamps precisos
- Detalhe completo: itens, adicionais, forma de pagamento, endereço e mapa
- Fluxo de status adaptado ao tipo de operação: delivery (saiu para entrega) ou balcão/mesa (pronto para servir)

### Gestão de Clientes e Fidelidade
- Cadastro automático na primeira compra por telefone
- Histórico completo de pedidos e ticket médio por cliente
- Programa de fidelidade configurável: pontos por real gasto
- Resgate de pontos no checkout e no balcão
- Relatório de clientes mais fiéis, frequência e LTV

### Fiscal — NFC-e
- Emissão automática de NFC-e no fechamento de venda no PDV
- Contingência offline: documentos emitidos sem internet, transmitidos depois
- Configuração por caixa: CNPJ, CSC, série, certificado digital A1
- Suporte a Simples Nacional e Lucro Presumido
- Fila de reprocessamento automático para documentos rejeitados pela SEFAZ

### Estoque
- Desconto automático de estoque a cada venda PDV
- Entrada manual por recebimento de compra
- Ajuste e inventário com histórico de movimentações
- Alertas de nível mínimo por produto

### Compras e Fornecedores
- Cadastro de fornecedores com histórico de compras
- Pedido de compra com itens e preços acordados
- Recebimento que atualiza estoque e custo médio automaticamente

### Financeiro
- Lançamentos de receita e despesa categorizados
- Conciliação automática com vendas do PDV
- Relatório de fluxo de caixa por período

### Agenda de Serviços
- Agendamento com tipo de serviço, duração estimada e responsável
- Visão de calendário por dia e semana
- Confirmação automática por WhatsApp

### Comissões e Gorjetas
- Comissão por vendedor configurável individualmente
- Pool de gorjetas com distribuição automática proporcional entre a equipe
- Relatório mensal de comissões com breakdown por funcionário

### Gestão de Catálogo
- CRUD completo de produtos com foto, descrição, variantes e adicionais
- Categorias com ordenação personalizada e slug automático
- Enriquecimento automático: normalização de nomes e busca de imagens por código de barras (base Cosmos/Bluesoft)
- Sync bidirecional com sistemas externos via conectores CSV, REST ou banco de dados
- Histórico de alterações e preços por produto

### DAV / Orçamentos
- Criação de orçamento com itens e validade
- Envio do orçamento por WhatsApp com resumo financeiro
- Conversão de orçamento aprovado em pedido com 1 clique

### Rotas de Entrega
- Planejamento de rotas com otimização por OpenRouteService (ORS)
- App do entregador com atualizações de status por parada
- Navegação integrada com Google Maps e Waze
- Rastreamento em tempo real no painel admin

### Painel Master Admin
- Visão consolidada de todas as empresas da plataforma
- Ativação e desativação de features por tenant (feature flags)
- Log de auditoria de ações administrativas críticas

---

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + Radix UI (shadcn) |
| Backend | ASP.NET Core 8 + EF Core 8 |
| Banco de Dados | PostgreSQL (NeonDB serverless em produção) |
| Realtime | SignalR (WebSocket) — impressão e balança |
| Jobs agendados | Hangfire 1.8 + PostgreSQL |
| Autenticação | JWT — roles: `admin`, `gerente`, `atendente`, `deliverer` |
| Deploy Frontend | Vercel (SPA + rewrite rules) |
| Deploy Backend | Render (Docker, auto-deploy via push) |
| Multi-tenant | Subdomínio detectado em runtime → `CompanyId` isolado |

---

## Integrações Externas

| Serviço | Finalidade |
|---|---|
| iFood Partner API | Recepção de pedidos via webhook + sync de cardápio |
| WhatsApp (Evolution API) | Notificações automáticas e atendimento conversacional |
| ViaCEP | Preenchimento automático de endereço por CEP |
| Cosmos (Bluesoft) | Enriquecimento de catálogo por EAN/GTIN (base brasileira) |
| SEFAZ | Emissão de NFC-e em homologação e produção |
| OpenRouteService (ORS) | Otimização de rotas e geocodificação |
| Nominatim | Geocodificação de endereços como fallback |

---

## Arquitetura

```
slug.vendapps.com.br
        │
        ▼
  Vercel (React SPA)          vendapps.onrender.com
     Vite + TS        ──────►   ASP.NET Core 8
                                     │
               ┌─────────────────────┼──────────────────────┐
               │                     │                      │
          NeonDB               Hangfire Jobs           SignalR Hub
        (PostgreSQL)          (sync, fiscal,         (impressoras,
       dados isolados          reprocessamento)         balanças)
        por CompanyId
```

**Multi-tenancy:** slug do subdomínio resolvido em runtime → todos os dados filtrados por `CompanyId`. Zero cruzamento entre clientes.

**Plug-in de marketplace:** `IMarketplaceOrderIngester` e `IMarketplaceStatusCallback` permitem adicionar novos canais (Rappi, Uber Eats) sem alterar o core — implementar a interface e registrar no DI.

---

## Agentes Locais

### PrintAgent
Worker service .NET que conecta impressoras físicas locais ao sistema na nuvem via SignalR. Imprime comandas silenciosamente sem diálogo de confirmação. Instala como serviço Windows.

### ScaleAgent
Worker service .NET que integra balanças Filizola via porta serial (RS-232). Sincroniza peso em tempo real com o PDV via SignalR.

---

## Início Rápido

### Backend
```bash
cd backend/Petshop.Api
# Configure appsettings.Development.json com a string de conexão PostgreSQL
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

Na primeira execução o `DbSeeder` cria empresa, categorias e produtos de exemplo automaticamente.

---

## Variáveis de Ambiente (Produção)

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

## Ativando a Integração iFood

1. No portal iFood Parceiro, gere **ClientId** e **ClientSecret**
2. Obtenha o **MerchantId** da loja
3. `POST /admin/marketplace` com as credenciais
4. Configure a URL do webhook no portal iFood:
   ```
   https://vendapps.onrender.com/webhooks/marketplace/{id-retornado}
   ```

---

## Licença

Projeto proprietário — todos os direitos reservados.
