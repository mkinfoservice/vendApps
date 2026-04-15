# vendApps — Handoff Técnico

> Documento de onboarding para IA ou desenvolvedor. Reflete o estado atual do repositório (abril 2026).

---

## 1. Visão Geral

**vendApps** é uma plataforma SaaS **multi-tenant** de gestão comercial. Cada empresa recebe subdomínio próprio (`empresa.vendapps.com.br`) com catálogo online, PDV, painel admin, programa de fidelidade, emissão de NFC-e e integração WhatsApp — totalmente isolados por `CompanyId`.

**Repositório:** `https://github.com/mkinfoservice/vendApps`  
**Branch principal:** `main`  
**Backend (prod):** `https://vendapps.onrender.com` (Render — .NET + NeonDB PostgreSQL)  
**Frontend (prod):** Vercel — React SPA; subdomínio detectado em runtime

---

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Backend | ASP.NET Core .NET 8 + EF Core 8 + PostgreSQL (NeonDB) |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + Radix UI (shadcn) |
| Jobs | Hangfire 1.8 + PostgreSQL storage |
| Auth | JWT — roles: `admin`, `gerente`, `atendente`, `deliverer` |
| Realtime | SignalR — impressoras e balanças |
| Deploy | Render (backend) + Vercel (frontend) |
| State/Cache | TanStack Query (React Query) v5 |
| Ícones | Lucide React |

---

## 3. Multi-tenancy

- Slug do subdomínio resolvido em runtime em `catalog/api.ts` via `resolveCompanySlug()`
- Todos os dados filtrados por `CompanyId` (nunca cruza entre clientes)
- CORS automático para `*.vendapps.com.br` em `Program.cs:IsVendappsSubdomain()`
- JWT do admin carrega claim `companyId` → todos os controllers usam `Guid.Parse(User.FindFirstValue("companyId")!)`

**Empresas de demo (DbSeeder — idempotente por slug):**

| Slug | ID | Nome |
|---|---|---|
| `petshop-demo` | `11111111-...` | Petshop Demo |
| `suaempresa` | `22222222-...` | Sua Empresa |
| `novaempresa` | `33333333-...` | Empresa Teste |

---

## 4. Estrutura de Pastas (o que importa)

```
vendApps/
├── backend/Petshop.Api/
│   ├── Controllers/
│   │   ├── CatalogController.cs          GET /catalog/{slug}/products|categories
│   │   ├── PdvController.cs              PDV — venda, itens, pagamento, fidelidade
│   │   ├── ProductAddonsController.cs    CRUD adicionais + grupos de adicionais
│   │   ├── OrdersController.cs           Pedidos delivery (público + admin)
│   │   ├── WhatsAppWebhookController.cs  Webhook Meta/Evolution
│   │   ├── FiscalAdminController.cs      NFC-e manual / reprocessamento
│   │   └── ...
│   ├── Data/
│   │   ├── AppDbContext.cs               30+ DbSets
│   │   ├── DbSeeder.cs                   seed de empresas e catálogo
│   │   ├── AddonGroupSeeder.cs           classifica addons em grupos na inicialização
│   │   └── AddonSplitSeeder.cs           desmembra addons combinados ("A ou B" → A + B)
│   ├── Entities/
│   │   ├── Catalog/
│   │   │   ├── Product.cs
│   │   │   ├── ProductAddon.cs           campo IsDefault (pré-seleciona no stepper)
│   │   │   └── ProductAddonGroup.cs      grupos para fluxo step-by-step
│   │   ├── Customers/
│   │   │   ├── Customer.cs               Phone, CpfHash, PointsBalance
│   │   │   └── LoyaltyTransaction.cs     SaleOrderId + OrderId (PDV e delivery)
│   │   ├── Pdv/
│   │   │   └── SaleOrder.cs              venda PDV com CustomerId, CustomerPhone
│   │   └── ...
│   ├── Services/
│   │   ├── Customers/LoyaltyService.cs   EarnAsync, EarnForOrderAsync, RedeemAsync
│   │   ├── WhatsApp/
│   │   │   ├── WhatsAppNotificationService.cs
│   │   │   │     NotifySaleCompletedAsync       — NFC-e via WhatsApp
│   │   │   │     SendPdvLoyaltyComplementAsync  — pontos independente de NFC-e
│   │   │   │     TrySendLoyaltyDeliveredComplementAsync — delivery
│   │   │   └── WhatsAppClient.cs
│   │   ├── Fiscal/Jobs/FiscalQueueProcessorJob.cs
│   │   └── ...
│   ├── Migrations/                        migrações EF Core
│   └── Program.cs                         startup + safety nets SQL idempotentes
│
└── frontend/petshop-web/src/
    ├── features/
    │   ├── catalog/
    │   │   ├── api.ts                     fetchProducts + normalizeProductGroups()
    │   │   ├── queries.ts                 useProducts, useProduct
    │   │   ├── ProductAddonStepper.tsx    UI step-by-step de adicionais
    │   │   ├── useProductStepper.ts       hook — estado, validação, buildSynthetic()
    │   │   └── ProductQuickViewModal.tsx  modal desktop (usa stepper quando hasGroups)
    │   ├── cart/
    │   │   ├── cart.tsx                   CartProvider + useCart (NÃO alterar)
    │   │   └── CartSheet.tsx / CartSidebar.tsx
    │   └── pdv/
    │       ├── api.ts                     addItem, paySale, searchCustomer…
    │       └── PdvContext.tsx
    ├── pages/
    │   ├── pdv/PdvPage.tsx                PDV GoCoffee (AddonModal com stepper)
    │   ├── ProductDetail.tsx              página mobile (usa stepper quando hasGroups)
    │   ├── Checkout.tsx
    │   └── admin/
    │       ├── ProductForm.tsx            CRUD produto + adicionais flat
    │       └── ...
    └── components/
        └── Toast.tsx                      ToastProvider + useToast
```

---

## 5. Módulo de Adicionais (Addon Groups + Stepper)

### Entidades

**`ProductAddonGroup`** — grupo de opções de um produto:
- `SelectionType`: `"single"` (radio, auto-avança no stepper) ou `"multiple"` (checkbox)
- `IsRequired`, `MinSelections`, `MaxSelections`, `SortOrder`

**`ProductAddon`** — item dentro de um grupo:
- `AddonGroupId` — FK para o grupo (nulo = avulso legacy)
- `IsDefault` — pré-selecionado ao abrir o stepper (ex: Leite integral)

### Ordem dos grupos (padrão GoCoffee)

| Sort | Grupo | Tipo | Regra de nome |
|---|---|---|---|
| 0 | Sabor | single | `priceCents == 0` (Natural, Baunilha…) |
| 1 | Tipo de Leite | single | contém "leite", "lactose", "aveia", "integral" |
| 2 | Cobertura | single | contém "cobertura", "chantilly", "ganache" |
| 3 | Extras | multiple | demais adicionais pagos |

### Seeders de inicialização

1. **`AddonGroupSeeder`** — para cada produto com addons sem grupos: classifica e cria os grupos; marca `IsDefault = true` no primeiro do Tipo de Leite
2. **`AddonSplitSeeder`** — detecta addons com `" ou "` no nome (ex: `"Cobertura (caramelo ou chocolate)"`) e divide em registros individuais; original vira `IsActive = false`

Ambos são **idempotentes** — rodam a cada startup mas só atuam se houver pendências.

### Frontend — `normalizeProductGroups()`

Em `catalog/api.ts`: se o produto retornar da API sem grupos mas com addons flat, cria grupos sintéticos em memória com a mesma lógica de classificação do `AddonGroupSeeder`. Garante que o stepper apareça mesmo antes do Render reiniciar.

### Auto-avanço

No `ProductAddonStepper.tsx`: grupos `single` avançam automaticamente após seleção (delay 180ms para feedback visual). Grupos `multiple` e última etapa exigem clique manual em **Próximo**/**Adicionar**.

---

## 6. Programa de Fidelidade

### Fluxo PDV (`PdvController.Pay`)

1. Após `tx.CommitAsync()`, roda `EarnAsync` **antes** de enfileirar `FiscalQueueProcessorJob` (evita race condition onde o job fiscal dispara o WhatsApp antes de a transação de pontos existir)
2. Confirmação de identidade — dois caminhos:
   - **CPF digitado** → valida hash contra `Customer.CpfHash`
   - **Cliente buscado por telefone** (sem CPF digitado) → verifica que o cadastro tem `CpfHash` registrado (identidade confirmada pelo operador)
3. Enfileira `SendPdvLoyaltyComplementAsync` para todo cliente confirmado

### Fluxo Delivery (`LoyaltyService.EarnForOrderAsync`)

- `LoyaltyTransaction.OrderId` salvo → permite lookup no complemento WhatsApp

### WhatsApp — Complemento de Fidelidade

**`SendPdvLoyaltyComplementAsync(saleId)`** — método dedicado para PDV:
- Independente de NFC-e e de `SALE_COMPLETED`
- Fallback de telefone: usa `sale.CustomerPhone` ou `Customer.Phone` do cadastro
- Idempotência dupla: verifica `PDV_LOYALTY_COMPLEMENT` + `ENTREGUE_LOYALTY_COMPLEMENT` para não duplicar
- Template `card_transaction_alert_2`: `{{1}}`=firstName, `{{2}}`=earnedPoints, `{{3}}`=pointsBalance

**`TrySendLoyaltyDeliveredComplementAsync`** — para delivery (trigger: status `ENTREGUE`):
- Lookup de `earnedPoints` via `LoyaltyTransaction.OrderId`

---

## 7. PDV (`PdvPage.tsx`)

Interface GoCoffee:
- `AddonModal` — abre ao clicar em produto com `hasAddons = true`
  - Busca `/admin/products/{id}/addons` + `/admin/products/{id}/addon-groups` em paralelo
  - Se grupos existem → `ProductAddonStepper` com `--brand` sobrescrito pelo caramelo GoCoffee
  - Se sem grupos mas com addons → auto-wrap em grupos sintéticos (mesma lógica do `normalizeProductGroups`)
  - `handleStepperConfirm`: extrai addon IDs de `synthetic.id.split("__")[1].split("_")` e chama `addItem`
- Busca de cliente: por telefone (`searchCustomer`) ou CPF — ambos atribuem fidelidade

---

## 8. Fiscal (NFC-e)

- `FiscalQueueProcessorJob` processa a fila assíncrona via Hangfire
- Após autorização SEFAZ: enfileira `NotifySaleCompletedAsync` (comprovante WhatsApp)
- `NotifySaleCompletedAsync` → após envio bem-sucedido → `TrySendLoyaltyDeliveredComplementAsync` (via pedido espelho)
- **Importante**: o complemento de fidelidade PDV (`SendPdvLoyaltyComplementAsync`) é independente deste fluxo — chega mesmo quando o cliente não pede NFC-e

---

## 9. Banco de Dados e Safety Nets

Migrações padrão EF Core + blocos `ADD COLUMN IF NOT EXISTS` em `Program.cs` para garantir resiliência quando migrations são marcadas como aplicadas mas o DDL não rodou:

```sql
-- Exemplos de safety nets em Program.cs
ALTER TABLE "ProductAddons"
    ADD COLUMN IF NOT EXISTS "AddonGroupId" uuid,
    ADD COLUMN IF NOT EXISTS "IsDefault" boolean NOT NULL DEFAULT false;

ALTER TABLE "LoyaltyTransactions"
    ADD COLUMN IF NOT EXISTS "OrderId" uuid;

CREATE TABLE IF NOT EXISTS "ProductAddonGroups" (...);
```

**Tabelas principais do módulo de adicionais:**

| Tabela | Notas |
|---|---|
| `ProductAddons` | `AddonGroupId` (FK), `IsDefault`, `IsActive` |
| `ProductAddonGroups` | `ProductId`, `SelectionType`, `IsRequired`, `SortOrder` |
| `LoyaltyTransactions` | `SaleOrderId` (PDV), `OrderId` (delivery) |
| `WhatsAppMessageLogs` | `TriggerStatus` para idempotência de notificações |

---

## 10. Variáveis de Ambiente

**Backend (Render):**
```
ConnectionStrings__Default=postgresql://...
Jwt__Key / Jwt__Issuer / Jwt__Audience / Jwt__AdminUser / Jwt__AdminPassword / Jwt__CompanyId
ENABLE_SWAGGER=false
WhatsApp__LoyaltyComplement__Enabled=true
WhatsApp__LoyaltyComplement__TemplateName=card_transaction_alert_2
```

**Frontend (Vercel):**
```
VITE_API_URL=https://vendapps.onrender.com
```

---

## 11. Impressão Mobile (Android + iPad)

### Arquitetura

O sistema de impressão tem três camadas, todas conectadas ao mesmo hub SignalR `/hubs/print`:

| Camada | Plataforma | Mecanismo |
|---|---|---|
| `PrintAgent` (Windows service) | PC Windows | `System.Drawing.Printing` → impressora local (USB/rede/Bluetooth pareado) |
| Print Station (browser, flag `PRINT_STATION_KEY`) | Qualquer browser | `window.print()` → dialog do SO |
| **Mobile Agent** (browser, flag `MOBILE_AGENT_KEY`) | Tablet Android/iPad | Web Bluetooth ou `window.print()` + AirPrint |

### Arquivos do Agente Mobile

| Arquivo | Responsabilidade |
|---|---|
| `features/admin/print/escpos.ts` | Gerador de bytes ESC/POS (Uint8Array). Suporta papel 58 mm (32 col) e 80 mm (48 col). Sem deps externas. |
| `features/admin/print/mobilePrint.ts` | Lógica de despacho: `isMobileAgent()`, `connectBluetoothPrinter()`, `mobilePrint()`. Gerencia estado BLE da sessão. |
| `pages/admin/MobilePrintAgentPage.tsx` | Página `/app/impressao/mobile` — toggle de agente, seletor de modo, pairing BLE, teste de impressão, log. |

### Fluxo de dispatch (`usePrintListener.tsx`)

```
PrintOrder (SignalR)
        │
        ├─ isMobileAgent() → true  → mobilePrint(payload, jobId)
        │                                ├─ mode=bluetooth → sendViaBluetooth (ESC/POS via BLE)
        │                                └─ mode=browser  → window.print() → AirPrint/dialog
        │
        └─ isPrintStation() → true → window.print() (desktop)
```

### Web Bluetooth — Notas de compatibilidade

- Requer **Chrome no Android** (ou qualquer browser baseado em Chromium com BLE)
- **Safari/iOS não suporta** Web Bluetooth — usar modo "Navegador/AirPrint"
- O pairing ocorre via `navigator.bluetooth.requestDevice()` e exige gesto do usuário (clique)
- A referência ao dispositivo fica em memória; reconexão automática ao reconectar o GATT
- Tenta UUIDs de serviço de múltiplas marcas; fallback: percorre todos os serviços do dispositivo
- Envia bytes em chunks de 512 (MTU BLE) com delay de 20 ms entre chunks

### Configurações (localStorage, por dispositivo)

| Chave | Valores | Descrição |
|---|---|---|
| `vendapps_mobile_agent` | `"1"` / ausente | Agente ativo neste tablet |
| `vendapps_mobile_mode` | `"bluetooth"` / `"browser"` | Estratégia de impressão |
| `vendapps_mobile_paper` | `"58"` / `"80"` | Largura do papel em mm |

Configurações persistem entre sessões e trocas de turno — o atendente não precisa reconfigurar.

### Impressoras AirPrint compatíveis (modo browser/iPad)

Epson TM-m30II, Star mPOP, Star TSP100IV (com AirPrint habilitado), Brother PJ-722/PJ-723, e qualquer impressora que exponha AirPrint na rede local.

---

## 12. Padrões de Código

### Backend — Regra de ouro
- Loyalty e WhatsApp nunca derrubam a venda: sempre em `try { } catch { }` fora da transação principal
- Safety nets SQL idempotentes em `Program.cs` garantem colunas mesmo se migration foi pulada

### Frontend — Regras críticas (NÃO alterar sem análise)
- `cart.tsx` — CartProvider e `useCart`: contrato fixo
- `catalog/api.ts` — tipos `Product`, `ProductAddon`, `ProductAddonGroup`: alterações exigem atualizar backend e stepper
- `useProductStepper.ts` — `buildSynthetic()` codifica addon IDs no `synthetic.id` como `{productId}__{id1_id2_...}`; o PDV depende desse formato para extrair os IDs ao chamar `addItem`

### Frontend — Padrão de chamada admin
```typescript
import { adminFetch } from "@/features/admin/auth/adminFetch";
const groups = await adminFetch<AddonGroupRaw[]>(`/admin/products/${id}/addon-groups`);
```

---

## 13. Como Rodar Localmente

```bash
# Backend
cd backend/Petshop.Api
# criar appsettings.Development.json com ConnectionStrings__Default
dotnet run
# API: http://localhost:5082

# Frontend
cd frontend/petshop-web
npm install
# criar .env.local: VITE_API_URL=http://localhost:5082
npm run dev
# http://localhost:5173
```

Na primeira execução o `DbSeeder` + `AddonGroupSeeder` + `AddonSplitSeeder` rodam automaticamente.

---

## 14. Commits Recentes Relevantes

| Hash | Descrição |
|---|---|
| (atual) | feat: agente de impressão mobile — Web Bluetooth + AirPrint para Android/iPad |
| `8430a63` | fix: fidelidade ao buscar cliente por telefone (sem CPF digitado) |
| `559f70d` | feat: desmembrar addons combinados + auto-avanço em seleção única |
| `2a1f044` | feat: grupos de adicionais por prioridade + Leite Integral pré-selecionado |
| `413f91c` | fix: fidelidade independente de NFC-e + stepper para addons sem grupos |
| `f917849` | fix: race condition earnedPoints + stepper no PDV |
| `1d6d6ae` | fix: safety nets idempotentes OrderId + AddonGroups |
| `4186311` | feat: fluxo step-by-step para seleção de adicionais por grupo |
| `de151ec` | fix: earnedPoints zerados na notificação WhatsApp delivery |
