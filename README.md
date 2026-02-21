# vendApps

Plataforma fullstack para catálogo, checkout, pedidos, roteirização de entregas e operação administrativa.

## Status Atual (21/02/2026)

- Backend e frontend integrados.
- Catálogo público com busca e filtro por categoria.
- Checkout com criação de pedido e envio para WhatsApp.
- Painel admin com autenticação JWT (`role=admin`).
- Portal do entregador com autenticação JWT (`role=deliverer`).
- Planejamento de rotas com preview A/B, geocoding com fallback e links de navegação.
- Módulo de produtos ativo (CRUD, imagens, histórico de preço e changelog).

## Em Andamento

- Consolidação do módulo de sincronização de produtos no frontend admin.
- Fluxos mobile dedicados para operação de entregador (além da interface web).

## Stack

- Backend: ASP.NET Core (.NET 8), EF Core, PostgreSQL, Hangfire, JWT.
- Frontend: React 19, Vite, TypeScript, React Query, Tailwind CSS.
- Infra local: Docker Compose (PostgreSQL + Redis).

## Estrutura

```text
.
|- backend/
|  |- Petshop.Api/
|  |- tests/
|- frontend/
|  |- petshop-web/
|- docker-compose.yml
|- vendApps.sln
```

## Pré-requisitos

- .NET SDK 8
- Node.js 18+
- Docker

## Configuração

### Docker (banco/redis)

```powershell
docker compose up -d
```

Serviços esperados:
- PostgreSQL em `localhost:5432` (`petshop_db`)
- Redis em `localhost:6379`

### Backend

Arquivo: `backend/Petshop.Api/appsettings.Development.json`

Validar:
- `ConnectionStrings:Default`
- `Jwt:Issuer` (`vendApps.Api`)
- `Jwt:Audience` (`vendApps.Admin`)
- `Jwt:Key`
- `Jwt:AdminUser`
- `Jwt:AdminPassword`
- `Jwt:CompanyId`

Obs.: em Development o `DbSeeder` executa automaticamente e aplica migrations na inicialização.

### Frontend

Arquivo: `frontend/petshop-web/.env.local`

```env
VITE_API_URL=http://localhost:5082
VITE_COMPANY_SLUG=petshop-demo
```

## Como Rodar

### Backend

```powershell
cd backend/Petshop.Api
dotnet restore
dotnet run
```

- API: `http://localhost:5082`
- Swagger: `http://localhost:5082/swagger`
- Hangfire (dev): `http://localhost:5082/admin/hangfire`

### Frontend

```powershell
cd frontend/petshop-web
npm install
npm run dev
```

- Frontend: `http://localhost:5173`

## Rotas Frontend

- Público:
  - `/`
  - `/checkout`
- Admin:
  - `/admin/login`
  - `/admin`
  - `/admin/orders`
  - `/admin/orders/:id`
  - `/admin/routes`
  - `/admin/routes/planner`
  - `/admin/routes/:routeId`
  - `/admin/financeiro`
  - `/admin/products`
  - `/admin/products/:id`
- Entregador:
  - `/deliverer/login`
  - `/deliverer`
  - `/deliverer/route/:routeId`

## Principais Endpoints da API

- Auth:
  - `POST /auth/login`
  - `POST /auth/deliverer/login`
- Catálogo:
  - `GET /catalog/{companySlug}/categories`
  - `GET /catalog/{companySlug}/products`
- Pedidos:
  - `POST /orders` (público)
  - `GET /orders` (admin)
  - `GET /orders/{idOrNumber}` (admin)
  - `PATCH /orders/{idOrNumber}/status` (admin)
  - `POST /orders/geocode-missing` (admin)
  - `POST /orders/{idOrNumber}/reprocess-geocoding` (admin)
- Rotas:
  - `POST /routes/preview` (admin)
  - `POST /routes` (admin)
  - `GET /routes` (admin)
  - `GET /routes/{routeId}` (admin)
  - `GET /routes/{routeId}/navigation` (admin)
- Entregadores:
  - `GET /deliverers` (admin)
  - `POST /deliverers` (admin)
  - `PATCH /deliverers/{id}/active` (admin)
  - `PATCH /deliverers/{id}/pin` (admin)
- Portal entregador:
  - `GET /deliverer/me/active-route`
  - `GET /deliverer/routes/{routeId}`
  - `PATCH /deliverer/routes/{routeId}/start`
  - `PATCH /deliverer/routes/{routeId}/stops/{stopId}/delivered`
  - `PATCH /deliverer/routes/{routeId}/stops/{stopId}/fail`
  - `PATCH /deliverer/routes/{routeId}/stops/{stopId}/skip`
  - `GET /deliverer/routes/{routeId}/navigation/next`

## Credenciais de Desenvolvimento

Arquivo: `backend/Petshop.Api/appsettings.Development.json`

- Admin:
  - Usuário: `admin`
  - Senha: `admin123`

Entregador: depende de cadastro + PIN via endpoints admin.

## Observações

- O slug padrão da empresa seedada em dev é `petshop-demo`.
- Se catálogo aparecer vazio, primeiro valide `VITE_COMPANY_SLUG` no frontend.
- Upload de imagens de produtos é servido por `backend/Petshop.Api/wwwroot/product-images/`.
