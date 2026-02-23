# vendApps — Plataforma de Vendas & Delivery

Plataforma fullstack multi-empresa para catálogo online, checkout, gestão de pedidos, rotas de entrega e painel administrativo completo.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | ASP.NET Core .NET 8 + EF Core + PostgreSQL |
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Auth | JWT (roles: `admin`, `deliverer`) |
| Jobs | Hangfire + PostgreSQL storage + Cronos |
| Sync | CSV / REST API / DB (via conector plugável) |
| Imagens | LocalImageStorageProvider (interface pronta para S3/R2) |

---

## Funcionalidades

### Público (cliente)
- **Catálogo** — listagem de categorias e produtos por empresa via slug (`/catalog/{companySlug}`)
- **Busca e filtro** por categoria
- **Carrinho** persistido em localStorage
- **Checkout** — validação, busca de CEP via ViaCEP, criação de pedido e abertura do WhatsApp com resumo

### Painel Admin (`/admin`)
- **Login** com JWT — sessão de 8 horas
- **Dashboard** — métricas operacionais e financeiras em tempo real
- **Pedidos** — listagem paginada, filtro por status, detalhe completo, alteração de status
- **Produtos** — CRUD completo com:
  - Slug auto-gerado a partir do nome
  - Preço, custo e margem (calculada automaticamente)
  - Estoque por unidade (UN, KG, L, etc.)
  - Código interno e código de barras
  - NCM
  - Upload de múltiplas imagens (10 MB/imagem)
  - Ativar/desativar inline na listagem
- **Rotas** — planejamento e acompanhamento de rotas de entrega
- **Financeiro** — relatórios e métricas financeiras
- **Hangfire Dashboard** em `/admin/hangfire` (apenas ambiente de desenvolvimento)

### App Entregador (`/deliverer`)
- Login com telefone + PIN
- Visualização da rota atribuída
- Atualização de status por parada (entregue, tentativa, problema)

### Sync de Produtos (Hangfire)
- Sincronização agendada (cron) ou manual por empresa
- Conectores: **CSV** (CsvHelper), **REST API** (IHttpClientFactory), **DB** (ADO.NET plugável: MySQL, PostgreSQL, SQL Server, Firebird)
- Hash SHA-256 por produto para detectar mudanças
- Política de merge configurável por empresa (`Company.SettingsJson`)
- Trilha de auditoria completa: `ProductChangeLog` e `ProductPriceHistory`
- **Mapeamento de campos configurável** no conector REST: suporta APIs com nomes de campo diferentes (ex: `title` → Name, `price` decimal → PriceCents centavos)
- **Preset FakeStore API** e suporte a qualquer API REST com envelope `data/items/products/results`
- **Schema discovery** para fontes de banco de dados: lista tabelas e colunas com amostras de dados
- Excluir fonte de sync pela UI (com confirmação)

---

## Arquitetura

```
petshop/
├── backend/
│   └── Petshop.Api/               # Monolito ASP.NET Core
│       ├── Controllers/           # Auth, Catalog, Orders, Admin (Products, Sources, Sync)
│       ├── Data/                  # AppDbContext + DbSeeder
│       ├── Entities/
│       │   ├── Catalog/           # Company, Brand, ProductVariant, ProductImage
│       │   ├── Sync/              # ExternalSource, Snapshot, SyncJob, SyncItem
│       │   └── Audit/             # ProductChangeLog, ProductPriceHistory
│       ├── Models/                # Product, Category, Order, OrderItem, Deliverer, Route...
│       ├── Services/
│       │   ├── Sync/              # IProductProvider, ConnectorFactory, ProductSyncService
│       │   │   └── Connectors/    # CsvProductProvider, RestApiProductProvider, DbProductProvider
│       │   └── Images/            # IImageStorageProvider, LocalImageStorageProvider
│       ├── Contracts/Admin/       # DTOs de request/response para área admin
│       ├── Migrations/            # EF Core (migração única: InitialProductModule)
│       └── wwwroot/
│           └── product-images/    # Imagens salvas localmente (ignorado no git)
└── frontend/
    └── petshop-web/               # React + Vite
        └── src/
            ├── features/
            │   ├── admin/
            │   │   ├── auth/      # adminFetch, Guard, login API
            │   │   ├── products/  # api.ts + queries.ts
            │   │   ├── orders/    # api.ts + queries.ts
            │   │   ├── routes/    # api.ts + queries.ts
            │   │   ├── dashboard/ # api.ts + queries.ts
            │   │   └── financeiro/
            │   ├── catalog/       # api.ts (catálogo público), queries.ts
            │   ├── cart/          # CartContext + CartSheet
            │   └── deliverer/     # auth, componentes do app de entrega
            ├── pages/
            │   ├── admin/         # Dashboard, OrdersList, OrderDetail, ProductsList,
            │   │                  # ProductForm, RoutesList, RouteDetail, RoutePlanner,
            │   │                  # Financeiro, Login
            │   └── deliverer/     # Login, Home, RouteDetail
            ├── components/
            │   ├── admin/         # AdminNav
            │   └── ui/            # ThemeToggle, Button, Badge, Input, Sheet...
            └── App.tsx            # Catálogo público (rota /)
```

---

## Multiempresa

Toda entidade de catálogo possui `CompanyId`. O catálogo público usa slug da empresa na URL:

```
GET /catalog/{companySlug}/products?categorySlug=racao&search=premium
GET /catalog/{companySlug}/categories
```

**Dados de desenvolvimento:**
- Company GUID: `11111111-0000-0000-0000-000000000001`
- Company slug: `petshop-demo`

---

## Requisitos

- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js 18+](https://nodejs.org/)
- [PostgreSQL 14+](https://www.postgresql.org/)

---

## Configuração

### Backend — `backend/Petshop.Api/appsettings.Development.json`

```json
{
  "ConnectionStrings": {
    "Default": "Host=localhost;Port=5432;Database=petshop;Username=postgres;Password=SUA_SENHA"
  },
  "Jwt": {
    "Key": "SUA_CHAVE_SECRETA_MINIMO_32_CHARS",
    "Issuer": "petshop-api",
    "Audience": "petshop-app",
    "AdminUser": "admin",
    "AdminPassword": "SUA_SENHA_ADMIN",
    "CompanyId": "11111111-0000-0000-0000-000000000001"
  }
}
```

### Frontend — `frontend/petshop-web/.env.local`

```env
VITE_API_URL=http://localhost:5082
VITE_COMPANY_SLUG=petshop-demo
```

---

## Como rodar localmente

### 1. Banco de dados

```bash
# Suba o PostgreSQL (ou use o docker-compose na raiz)
docker-compose up -d
```

### 2. Backend

```bash
cd backend/Petshop.Api
dotnet restore
dotnet run
```

A API sobe em `http://localhost:5082`.
Na primeira execução, o `DbSeeder` cria automaticamente a empresa de desenvolvimento, categorias e produtos de exemplo.

### 3. Frontend

```bash
cd frontend/petshop-web
npm install
npm run dev
```

O frontend sobe em `http://localhost:5173`.

---

## Rotas

### Frontend

| Rota | Descrição |
|---|---|
| `/` | Catálogo público |
| `/checkout` | Finalização do pedido |
| `/admin/login` | Login do administrador |
| `/admin` | Dashboard admin |
| `/admin/orders` | Lista de pedidos |
| `/admin/orders/:id` | Detalhe do pedido |
| `/admin/products` | Lista de produtos |
| `/admin/products/new` | Criar produto |
| `/admin/products/:id` | Editar produto |
| `/admin/routes` | Lista de rotas |
| `/admin/routes/planner` | Planejador de rotas |
| `/admin/routes/:id` | Detalhe da rota |
| `/admin/financeiro` | Painel financeiro |
| `/admin/hangfire` | Dashboard Hangfire (dev) |
| `/deliverer/login` | Login do entregador |
| `/deliverer` | Home do entregador |
| `/deliverer/route/:id` | Rota do entregador |

### API — Público

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/auth/login` | Login admin |
| `POST` | `/auth/deliverer/login` | Login entregador |
| `POST` | `/orders` | Criar pedido |
| `GET` | `/catalog/{slug}/products` | Listar produtos |
| `GET` | `/catalog/{slug}/categories` | Listar categorias |

### API — Admin (requer `Authorization: Bearer <token>`)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/orders` | Listar pedidos |
| `GET` | `/orders/:id` | Detalhe do pedido |
| `PATCH` | `/orders/:id/status` | Alterar status |
| `GET` | `/admin/products` | Listar produtos |
| `POST` | `/admin/products` | Criar produto |
| `GET` | `/admin/products/:id` | Detalhe do produto |
| `PUT` | `/admin/products/:id` | Editar produto |
| `PATCH` | `/admin/products/:id/toggle-status` | Ativar/desativar |
| `DELETE` | `/admin/products/:id` | Excluir permanentemente (protegido se houver pedidos vinculados) |
| `POST` | `/admin/products/:id/images` | Upload de imagem |
| `DELETE` | `/admin/products/:id/images/:imgId` | Excluir imagem |
| `GET` | `/admin/products/:id/price-history` | Histórico de preços |
| `GET` | `/admin/products/:id/changelogs` | Log de alterações |
| `POST` | `/admin/products/:id/clone` | Clonar produto |
| `GET` | `/admin/product-sources` | Listar fontes de sync |
| `POST` | `/admin/product-sources` | Criar fonte de sync |
| `PUT` | `/admin/product-sources/:id` | Editar fonte |
| `DELETE` | `/admin/product-sources/:id` | Excluir fonte |
| `POST` | `/admin/product-sources/:id/test-connection` | Testar conexão |
| `GET` | `/admin/product-sources/:id/db-schema/tables` | Listar tabelas do DB externo |
| `GET` | `/admin/product-sources/:id/db-schema/columns` | Listar colunas de uma tabela |
| `POST` | `/admin/products/sync` | Disparar sync manual |
| `GET` | `/admin/products/sync/jobs` | Listar jobs de sync |
| `GET` | `/admin/products/sync/jobs/:id` | Detalhe do job |
| `GET` | `/admin/products/sync/jobs/:id/items` | Itens do job |

---

## Pacotes NuGet notáveis

| Pacote | Versão | Uso |
|---|---|---|
| Hangfire.AspNetCore | 1.8.15 | Agendamento de jobs |
| Hangfire.PostgreSql | 1.20.9 | Storage do Hangfire |
| CsvHelper | 33.0.1 | Conector CSV |
| Cronos | 0.8.3 | Parse de expressões cron |
| BCrypt.Net-Next | — | Hash de PIN dos entregadores |

---

## Segurança

- JWT assinado com HMAC SHA256, expiração de 8 horas
- Role `admin` obrigatória em todos os endpoints administrativos
- Role `deliverer` obrigatória nos endpoints do app de entrega
- Guard no frontend redirecionando para login em rotas protegidas
- Token invalidado localmente ao receber `401`
- Imagens de produtos limitadas a 10 MB

---

## Observações de desenvolvimento

- O banco é criado/migrado automaticamente na inicialização (`dotnet run`)
- O seeder só insere dados se o banco estiver vazio
- Para recriar do zero: apague o banco e rode `dotnet run` novamente
- O diretório `wwwroot/product-images/` é criado automaticamente pelo provider
- O Hangfire scheduler roda a cada minuto verificando fontes de sync agendadas
