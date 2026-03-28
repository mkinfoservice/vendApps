# vendApps — Plataforma de Vendas & Delivery

Plataforma SaaS fullstack multi-empresa para catálogo online, checkout via WhatsApp, gestão de pedidos, rotas de entrega, sincronização de produtos e enriquecimento de imagens em massa.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | ASP.NET Core .NET 8, EF Core 8, PostgreSQL |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Radix UI (shadcn) |
| State/Cache | TanStack Query (React Query) v5 |
| Auth | JWT — roles: `admin`, `deliverer` |
| Jobs | Hangfire 1.8 + PostgreSQL storage + Cronos 0.8 |
| Sync | CSV (CsvHelper), REST API, DB (plugável) |
| Imagens | LocalImageStorageProvider (interface pronta para S3/R2) |
| Geocoding | OpenRouteService (ORS) — otimização de rotas |
| Scripts | Python 3.11 — Tkinter, Pillow, Requests, DDGS |
| Deploy Backend | Render (https://vendapps.onrender.com) |
| Deploy Frontend | Vercel |

---

## Funcionalidades

### Catálogo Público (cliente)
- Listagem de produtos e categorias por empresa via slug (`/catalog/{companySlug}`)
- Busca por nome e filtro por categoria
- Carrinho persistido em localStorage com controle de quantidade e subtotal em tempo real
- Checkout completo: nome, telefone, CEP com auto-fill (ViaCEP), forma de pagamento (PIX / cartão na entrega / dinheiro), cálculo de troco
- Criação do pedido no banco antes do disparo para WhatsApp com número e resumo financeiro
- Layout mobile-first responsivo

### Painel Administrativo (`/admin`)
- Login com JWT — sessão de 8 horas, logout automático ao receber 401
- **Dashboard** — métricas operacionais e financeiras em tempo real
- **Pedidos** — listagem paginada, filtros por status e busca, detalhe completo, alteração de status com regras de transição
- **Produtos** — CRUD completo:
  - Slug auto-gerado a partir do nome
  - Preço, custo e margem (calculada automaticamente)
  - Estoque por unidade (UN, KG, L etc.)
  - Código interno e código de barras (EAN)
  - NCM
  - Histórico de preços por produto
  - Log de alterações por campo
  - Upload de múltiplas imagens (até 10 MB/imagem)
  - Ativar/desativar inline na listagem
  - Clone de produto
  - Soft delete (proteção se houver pedidos vinculados)
- **Enriquecimento de imagens** — buscador manual com picker visual por produto
- **Rotas** — planejamento e acompanhamento de rotas de entrega com ORS
- **Financeiro** — relatórios e métricas financeiras
- **Hangfire Dashboard** em `/admin/hangfire` (dev only)

### App Entregador (`/deliverer`)
- Login com telefone + PIN (hash BCrypt)
- Visualização da rota atribuída com todas as paradas
- Atualização de status por parada: Entregue / Tentativa / Problema
- Botões de navegação (Google Maps / Waze) com endereço da parada
- Interface mobile-first otimizada para uso em campo

### Sync de Produtos (Hangfire)
- Sincronização agendada (cron configurável) ou manual por empresa
- **Conectores:** CSV (CsvHelper), REST API (qualquer endpoint), DB (MySQL, PostgreSQL, SQL Server, Firebird via ADO.NET)
- Hash SHA-256 por produto para detectar mudanças e evitar updates desnecessários
- Política de merge configurável por empresa: `PreferExternal` / `PreferInternal`
- Mapeamento de campos configurável para APIs com nomes diferentes (`title` → Name, `price` → PriceCents etc.)
- Schema discovery para fontes DB: lista tabelas e colunas com amostras de dados
- Trilha de auditoria completa: `ProductChangeLog` e `ProductPriceHistory`
- Visualização de jobs, itens processados e retentativa via painel admin

### Multiempresa (Multi-tenant)
- Toda entidade de catálogo possui `CompanyId` (Guid)
- Catálogo público acessa por slug: `GET /catalog/{slug}/products`
- JWT do admin carrega claim `companyId` — dados completamente isolados por empresa
- CORS automático para `*.vendapps.com.br`
- Subdomínio detectado em runtime pelo frontend

---

## Agentes Locais (.NET Worker Services)

### PrintAgent (`agent/PrintAgent/`)
Serviço Windows que conecta impressoras locais (físicas) ao sistema na nuvem.
- Escuta a API por jobs de impressão pendentes
- Imprime cupons/pedidos silenciosamente sem diálogo de confirmação
- Suporte a múltiplas impressoras locais
- Autenticação com a API via token JWT
- Instalação como serviço Windows via scripts `.bat` e PowerShell (`INSTALAR.bat` / `DESINSTALAR.bat`)
- Configurável via `appsettings.json` (URL da API, intervalo de polling, impressora padrão)

### ScaleAgent (`agent/ScaleAgent/`)
Serviço Windows que integra balanças de peso ao sistema.
- Integração com balança **Filizola** via porta serial (RS-232)
- Lê peso em tempo real e sincroniza com a API
- Worker service .NET com polling configurável
- Autenticação com a API via token JWT
- Configurável via `appsettings.json` (porta COM, baud rate, URL da API)

---

## Scripts de Enriquecimento de Imagens (`scripts/`)

Ferramenta para adicionar imagens em massa a catálogos com milhares de SKUs sem foto. Roda na máquina local para evitar bloqueios de IP que afetam servidores cloud.

### `enrich_images_gui.py` — Interface Desktop (Tkinter)

App desktop visual para enriquecimento manual e automático de imagens.

**Funcionalidades:**
- **Carregar da API** — busca todos os produtos sem imagem diretamente da API
- **Abrir CSV** — carrega lista exportada de produtos
- **Exportar CSV** — exporta lista de produtos sem imagem para arquivo local
- **⚡ Automático** — processa todos os produtos automaticamente: busca e aplica a primeira imagem encontrada, pula os que não tiver, mostra progresso em tempo real, pode ser interrompido a qualquer momento
- **Modo manual** — exibe grid de até 12 imagens por produto para escolha visual, campo de busca editável (não afeta o banco), botão Pular
- Aplica imagem diretamente via API — atualiza o banco na hora, aparece no catálogo imediatamente
- Status visual na lista: ✓ aplicado / ⏭ pulado / em branco = pendente

**Cascata de busca de imagens:**
1. Mercado Livre API (melhor qualidade para produtos brasileiros)
2. Bing Images com `site:mercadolivre.com.br {query}`
3. DuckDuckGo Images com mesmo `site:` query
4. Fallback: Bing/DDG com query geral e variações do nome
5. Cache em memória por query normalizada para evitar rate limit

**Pré-processamento:** função `_simplify()` remove dosagens e unidades (mg, ml, g, kg, caps etc.) antes de buscar, melhorando relevância.

### `enrich_images.py` — CLI (linha de comando)

```bash
# Exportar produtos sem imagem para CSV
python enrich_images.py export --token SEU_JWT --output produtos.csv

# Processar CSV em lote (aplicação automática)
python enrich_images.py batch --token SEU_JWT --csv produtos.csv
python enrich_images.py batch --token SEU_JWT --csv produtos.csv --delay 2 --start 150

# Processar um único produto
python enrich_images.py single --token SEU_JWT --id UUID --name "Ração Golden"

# Remover todas as imagens (ambiente de testes)
python enrich_images.py clear --token SEU_JWT
```

**Instalação das dependências:**
```bash
cd scripts
pip install -r requirements.txt
```

**Gerar executável `.exe`:**
```bash
build_exe.bat
```

---

## Arquitetura

```
vendApps/
├── backend/
│   └── Petshop.Api/                    ← Monolito ASP.NET Core
│       ├── Controllers/
│       │   ├── AuthController.cs
│       │   ├── CatalogController.cs
│       │   ├── OrdersController.cs
│       │   ├── DashboardController.cs
│       │   ├── FinanceiroController.cs
│       │   ├── RoutesController.cs
│       │   ├── DeliverersController.cs
│       │   ├── DelivererPortalController.cs
│       │   ├── AdminProductsController.cs
│       │   ├── AdminProductSourcesController.cs
│       │   ├── AdminProductSyncController.cs
│       │   └── CatalogEnrichmentController.cs
│       ├── Entities/
│       │   ├── Catalog/       Company, Brand, ProductVariant, ProductImage
│       │   ├── Sync/          ExternalSource, Snapshot, SyncJob, SyncItem
│       │   ├── Delivery/      Deliverer, Route, RouteStop, enums
│       │   └── Audit/         ProductChangeLog, ProductPriceHistory
│       ├── Models/            Product, Category, Order, OrderItem...
│       ├── Data/              AppDbContext, DbSeeder
│       ├── Services/
│       │   ├── Sync/          ProductSyncService, ConnectorFactory, Connectors/
│       │   └── Images/        IImageStorageProvider, LocalImageStorageProvider
│       └── wwwroot/product-images/   ← imagens locais (gitignore)
│
├── frontend/
│   └── petshop-web/                    ← React + Vite
│       └── src/
│           ├── features/
│           │   ├── admin/     auth, products, orders, routes, dashboard, financeiro, enrichment
│           │   ├── catalog/   api, queries, ProductCard, CategoryTile
│           │   ├── cart/      CartContext, CartSheet, CartSidebar
│           │   └── deliverer/ auth, components
│           ├── pages/
│           │   ├── admin/     Dashboard, Orders, Products, Routes, Financeiro...
│           │   └── deliverer/ Login, Home, RouteDetail
│           └── App.tsx        Catálogo público
│
├── agent/
│   ├── PrintAgent/                     ← Impressão silenciosa local (.NET Worker)
│   └── ScaleAgent/                     ← Balança Filizola serial (.NET Worker)
│
└── scripts/
    ├── enrich_images.py                ← CLI de enriquecimento de imagens
    ├── enrich_images_gui.py            ← GUI desktop de enriquecimento
    ├── requirements.txt
    └── build_exe.bat                   ← Gera .exe com PyInstaller
```

---

## API — Endpoints

### Público
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/auth/login` | Login admin |
| `POST` | `/auth/deliverer/login` | Login entregador |
| `POST` | `/orders` | Criar pedido (cliente) |
| `GET` | `/catalog/{slug}/products` | Listar produtos |
| `GET` | `/catalog/{slug}/categories` | Listar categorias |

### Admin — Pedidos
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/orders` | Listar paginado com filtros |
| `GET` | `/orders/{id}` | Detalhe do pedido |
| `PATCH` | `/orders/{id}/status` | Alterar status |

### Admin — Produtos
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/admin/products` | Listar (page, search, categoryId, active) |
| `POST` | `/admin/products` | Criar |
| `GET` | `/admin/products/{id}` | Detalhe (com images + variants) |
| `PUT` | `/admin/products/{id}` | Editar |
| `PATCH` | `/admin/products/{id}/toggle-status` | Ativar/desativar |
| `DELETE` | `/admin/products/{id}` | Soft delete |
| `POST` | `/admin/products/{id}/clone` | Clonar |
| `POST` | `/admin/products/{id}/images` | Upload imagem (multipart, 10MB) |
| `DELETE` | `/admin/products/{id}/images/{imgId}` | Excluir imagem |
| `GET` | `/admin/products/{id}/price-history` | Histórico de preços |
| `GET` | `/admin/products/{id}/changelogs` | Log de alterações |

### Admin — Enriquecimento de Imagens
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/admin/enrichment/image-search` | Buscar imagens por barcode |
| `PUT` | `/admin/enrichment/products/{id}/image` | Aplicar imagem a um produto |
| `DELETE` | `/admin/enrichment/clear-all-images` | Remover todas as imagens |
| `GET` | `/admin/enrichment/review/images` | Listar candidatas de imagem |
| `POST` | `/admin/enrichment/review/images/{id}/approve` | Aprovar candidata |
| `POST` | `/admin/enrichment/review/images/{id}/reject` | Rejeitar candidata |

### Admin — Sync de Produtos
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/admin/product-sources` | Listar fontes |
| `POST` | `/admin/product-sources` | Criar fonte |
| `PUT` | `/admin/product-sources/{id}` | Editar |
| `DELETE` | `/admin/product-sources/{id}` | Excluir |
| `POST` | `/admin/product-sources/{id}/test-connection` | Testar conexão |
| `POST` | `/admin/products/sync` | Disparar sync manual |
| `GET` | `/admin/products/sync/jobs` | Listar jobs |
| `GET` | `/admin/products/sync/jobs/{id}` | Detalhe do job |
| `POST` | `/admin/products/sync/jobs/{id}/retry` | Retentar job |

### Admin — Rotas e Entregadores
| Método | Rota | Descrição |
|---|---|---|
| `GET/POST` | `/routes` | Listar / Criar rota |
| `GET/PUT/DELETE` | `/routes/{id}` | Detalhe / Editar / Excluir |
| `POST` | `/routes/{id}/start` | Iniciar rota |
| `POST` | `/routes/{id}/complete` | Concluir rota |
| `GET/POST` | `/deliverers` | Listar / Criar entregador |
| `PUT/DELETE` | `/deliverers/{id}` | Editar / Excluir |

### Entregador
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/deliverer/route` | Rota ativa do entregador |
| `PATCH` | `/deliverer/stops/{stopId}` | Atualizar status da parada |

---

## Rotas do Frontend

| Rota | Descrição |
|---|---|
| `/` | Catálogo público |
| `/checkout` | Finalização do pedido |
| `/admin/login` | Login do administrador |
| `/admin` | Dashboard |
| `/admin/orders` | Lista de pedidos |
| `/admin/orders/:id` | Detalhe do pedido |
| `/admin/products` | Lista de produtos |
| `/admin/products/new` | Criar produto |
| `/admin/products/:id` | Editar produto |
| `/admin/routes` | Lista de rotas |
| `/admin/routes/planner` | Planejador de rotas |
| `/admin/routes/:id` | Detalhe da rota |
| `/admin/financeiro` | Painel financeiro |
| `/deliverer/login` | Login do entregador |
| `/deliverer` | Home do entregador |
| `/deliverer/route/:id` | Rota ativa do entregador |

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
docker-compose up -d
```

### 2. Backend
```bash
cd backend/Petshop.Api
dotnet restore
dotnet run
# API: http://localhost:5082
# Hangfire: http://localhost:5082/admin/hangfire
```

Na primeira execução o `DbSeeder` cria automaticamente empresa, categorias e produtos de exemplo.

### 3. Frontend
```bash
cd frontend/petshop-web
npm install
npm run dev
# http://localhost:5173
```

### 4. Scripts Python
```bash
cd scripts
pip install -r requirements.txt
python enrich_images_gui.py   # interface desktop
```

---

## Infraestrutura de Produção

| Serviço | Plataforma | Detalhes |
|---|---|---|
| Backend | Render | `https://vendapps.onrender.com` — .NET + NeonDB |
| Frontend | Vercel | React SPA com rewrite + `.npmrc` legacy-peer-deps |
| Banco | NeonDB | PostgreSQL serverless |

**Env vars Render:** `ConnectionStrings__Default`, `Jwt__Key`, `Jwt__Issuer`, `Jwt__Audience`, `Jwt__AdminUser`, `Jwt__AdminPassword`, `Jwt__CompanyId`, `ENABLE_SWAGGER`

**Env vars Vercel:** `VITE_API_URL=https://vendapps.onrender.com`

---

## Empresas demo (seed automático)

| Slug | ID | Descrição |
|---|---|---|
| `petshop-demo` | `11111111-...` | 5 produtos de exemplo |
| `suaempresa` | `22222222-...` | 10 produtos |
| `novaempresa` | `33333333-...` | 10 produtos |

---

## Segurança

- JWT assinado com HMAC SHA256, expiração de 8 horas
- Role `admin` obrigatória em todos os endpoints administrativos
- Role `deliverer` obrigatória nos endpoints do app de entrega
- Guard no frontend redirecionando para login em rotas protegidas
- Token invalidado localmente ao receber `401`
- PIN do entregador armazenado como hash BCrypt
- CORS wildcard automático para `*.vendapps.com.br`
- Imagens de produtos limitadas a 10 MB

---

## Pacotes NuGet notáveis

| Pacote | Uso |
|---|---|
| Hangfire.AspNetCore + Hangfire.PostgreSql | Agendamento de jobs |
| CsvHelper 33 | Conector CSV |
| Cronos 0.8 | Parse de expressões cron |
| BCrypt.Net-Next | Hash de PIN dos entregadores |

---

## Observações

- Banco criado/migrado automaticamente na inicialização (`dotnet run`)
- Seeder idempotente — só insere se os dados ainda não existirem
- Para recriar do zero: apague o banco e rode `dotnet run`
- O diretório `wwwroot/product-images/` é criado automaticamente
- Hangfire scheduler roda a cada minuto verificando fontes agendadas
- Scripts Python rodam na máquina local (IP residencial) para contornar bloqueios WAF de APIs externas
