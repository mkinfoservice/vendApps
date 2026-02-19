# Petshop - Projeto Fullstack

Aplicação fullstack para catálogo, checkout e gestão de pedidos com painel administrativo protegido por autenticação.

## Status
- Frontend e backend integrados.
- Fluxo de checkout funcional.
- Painel admin com login e proteção de rotas funcionando.
- Endpoints administrativos protegidos com JWT + role `admin`.

## Ajustes realizados hoje (11/02/2026)

### 1. Autenticação admin no backend
Arquivo: `backend/Petshop.Api/Controllers/AuthController.cs`
- Criado/ajustado endpoint `POST /auth/login`.
- Validação de credenciais via configuração `Jwt:AdminUser` e `Jwt:AdminPassword`.
- Geração de JWT com:
  - `ClaimTypes.Role = admin`
  - expiração de 8 horas
  - assinatura HMAC SHA256

### 2. Pipeline JWT e autorização na API
Arquivo: `backend/Petshop.Api/Program.cs`
- Configurado `AddAuthentication().AddJwtBearer(...)` com validação de issuer, audience, lifetime e chave.
- Definido `RoleClaimType` e `NameClaimType`.
- Ativado `UseAuthentication()` e `UseAuthorization()`.
- Política CORS para localhost/127.0.0.1 mantida para integração com frontend.

### 3. Proteção dos endpoints administrativos de pedidos
Arquivo: `backend/Petshop.Api/Controllers/OrdersController.cs`
- Endpoints administrativos protegidos com `[Authorize(Roles = "admin")]`:
  - `GET /orders`
  - `GET /orders/{idOrNumber}`
  - `PATCH /orders/{idOrNumber}/status`
- Fluxo público de criação de pedido (`POST /orders`) mantido.
- Regras de transição de status aplicadas para evitar pulo de etapas.

### 4. Login admin no frontend
Arquivo: `frontend/petshop-web/src/pages/admin/Login.tsx`
- Tela de login conectada ao backend (`/auth/login`).
- Salvamento do token após autenticar.
- Redirecionamento com `replace` para `/admin/orders`.
- Tratamento de loading/erros e envio por Enter.
- Se já autenticado, redireciona automaticamente para o painel.

### 5. Guard de rota para painel admin
Arquivo: `frontend/petshop-web/src/features/admin/auth/Guard.tsx`
- Implementado `AdminGuard` para bloquear acesso sem token.
- Redirecionamento para `/admin/login` quando não autenticado.

### 6. Cliente HTTP autenticado para área admin
Arquivos:
- `frontend/petshop-web/src/features/admin/auth/api.ts`
- `frontend/petshop-web/src/features/admin/auth/adminFetch.ts`
- `frontend/petshop-web/src/features/admin/orders/api.ts`

Ajustes:
- `login()` chama `POST /auth/login`.
- `adminFetch` injeta `Authorization: Bearer <token>`.
- Em `401`, remove token e força redirecionamento para login.
- APIs de pedidos admin consumindo endpoints protegidos.

### 7. Fluxo de checkout e envio para WhatsApp
Arquivo: `frontend/petshop-web/src/pages/Checkout.tsx`
- Validação de dados do cliente e endereço.
- Busca de endereço por CEP (ViaCEP).
- Revisão do pedido em modal antes de enviar.
- Criação do pedido no backend antes de abrir WhatsApp.
- Mensagem enviada no WhatsApp com número do pedido e resumo.

### 8. Melhorias de UX no carrinho
Arquivo: `frontend/petshop-web/src/features/cart/CartSheet.tsx`
- Ajustes visuais e de interação no carrinho lateral.
- Stepper de quantidade mais claro.
- CTA direto para checkout.

### 9. Estrutura de providers da aplicação
Arquivo: `frontend/petshop-web/src/main.tsx`
- `QueryClientProvider` ativo para queries/mutations.
- `CartProvider` envolvendo as rotas.

## Estrutura do projeto
- `backend/Petshop.Api`: API ASP.NET Core + EF Core + PostgreSQL.
- `frontend/petshop-web`: app React + Vite + TypeScript + Tailwind.
- `docker-compose.yml`: infraestrutura local.

## Requisitos
- .NET 8 SDK
- Node.js 18+
- PostgreSQL

## Configuração

### Backend
Arquivo: `backend/Petshop.Api/appsettings.Development.json`
- Ajustar:
  - `ConnectionStrings:Default`
  - `Jwt:Key`
  - `Jwt:AdminUser`
  - `Jwt:AdminPassword`
  - `Jwt:Issuer`
  - `Jwt:Audience`

### Frontend
Arquivo: `frontend/petshop-web/.env.local`
- Definir:
  - `VITE_API_URL=http://localhost:5082`

## Como rodar localmente

### 1. Backend
```powershell
cd backend/Petshop.Api
dotnet restore
dotnet run
```
API padrão: `http://localhost:5082`

### 2. Frontend
```powershell
cd frontend/petshop-web
npm install
npm run dev
```
Frontend padrão: `http://localhost:5173`

## Rotas principais

### Público (frontend)
- `/` catálogo
- `/checkout` finalização do pedido

### Admin (frontend)
- `/admin/login`
- `/admin/orders`
- `/admin/orders/:id`

### API
- `POST /auth/login` (admin)
- `POST /orders` (público)
- `GET /orders` (admin)
- `GET /orders/{idOrNumber}` (admin)
- `PATCH /orders/{idOrNumber}/status` (admin)

## Segurança aplicada
- JWT assinado no backend.
- Role `admin` exigida nos endpoints de gestão.
- Guard no frontend protegendo rotas do painel.
- Invalidação local de sessão ao receber `401`.

## Observações
- Como a pasta raiz não está com `.git`, o resumo de "ajustes de hoje" foi levantado pelos arquivos modificados em 11/02/2026.
- Build local do frontend foi gerado em `frontend/petshop-web/dist` no dia.
