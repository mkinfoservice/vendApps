# vendApps â€” Handoff TÃ©cnico

> Documento de onboarding para IA ou desenvolvedor. Reflete o estado atual do repositÃ³rio (abril 2026).

---

## 1. VisÃ£o Geral

**vendApps** Ã© uma plataforma SaaS **multi-tenant** de gestÃ£o comercial. Cada empresa recebe subdomÃ­nio prÃ³prio (`empresa.vendapps.com.br`) com catÃ¡logo online, PDV, painel admin, programa de fidelidade, emissÃ£o de NFC-e e integraÃ§Ã£o WhatsApp â€” totalmente isolados por `CompanyId`.

**RepositÃ³rio:** `https://github.com/mkinfoservice/vendApps`  
**Branch principal:** `main`  
**Backend (prod):** `https://vendapps.onrender.com` (Render â€” .NET + NeonDB PostgreSQL)  
**Frontend (prod):** Vercel â€” React SPA; subdomÃ­nio detectado em runtime

---

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Backend | ASP.NET Core .NET 8 + EF Core 8 + PostgreSQL (NeonDB) |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + Radix UI (shadcn) |
| Jobs | Hangfire 1.8 + PostgreSQL storage |
| Auth | JWT â€” roles: `admin`, `gerente`, `atendente`, `deliverer` |
| Realtime | SignalR â€” impressoras e balanÃ§as |
| Deploy | Render (backend) + Vercel (frontend) |
| State/Cache | TanStack Query (React Query) v5 |
| Ãcones | Lucide React |

---

## 2.1 Atualizacao Recente (abril 2026)

- Grid do catalogo moderno (publico e mesa) alinhado ao padrao do PDV:
  - cards compactos com imagem quadrada, badge de Top e badge de adicionais;
  - grade responsiva densa (`3/4/5/4/5/6` colunas por breakpoint);
  - categorias em painel 2 colunas no desktop e chips `min-w-[150px]` no mobile.
- Fluxo funcional preservado:
  - produto com adicionais/variantes abre personalizacao;
  - produto simples adiciona rapidamente ao carrinho.
- Controle por tenant mantido via feature flag `modern_catalog_experience` (isolamento por `CompanyId`).

---

## 3. Multi-tenancy

- Slug do subdomÃ­nio resolvido em runtime em `catalog/api.ts` via `resolveCompanySlug()`
- Todos os dados filtrados por `CompanyId` (nunca cruza entre clientes)
- CORS automÃ¡tico para `*.vendapps.com.br` em `Program.cs:IsVendappsSubdomain()`
- JWT do admin carrega claim `companyId` â†’ todos os controllers usam `Guid.Parse(User.FindFirstValue("companyId")!)`

**Empresas de demo (DbSeeder â€” idempotente por slug):**

| Slug | ID | Nome |
|---|---|---|
| `petshop-demo` | `11111111-...` | Petshop Demo |
| `suaempresa` | `22222222-...` | Sua Empresa |
| `novaempresa` | `33333333-...` | Empresa Teste |

---

## 4. Estrutura de Pastas (o que importa)

```
vendApps/
â”œâ”€â”€ backend/Petshop.Api/
â”‚   â”œâ”€â”€ Controllers/
â”‚   â”‚   â”œâ”€â”€ CatalogController.cs          GET /catalog/{slug}/products|categories
â”‚   â”‚   â”œâ”€â”€ PdvController.cs              PDV â€” venda, itens, pagamento, fidelidade
â”‚   â”‚   â”œâ”€â”€ ProductAddonsController.cs    CRUD adicionais + grupos de adicionais
â”‚   â”‚   â”œâ”€â”€ OrdersController.cs           Pedidos delivery (pÃºblico + admin)
â”‚   â”‚   â”œâ”€â”€ WhatsAppWebhookController.cs  Webhook Meta/Evolution
â”‚   â”‚   â”œâ”€â”€ FiscalAdminController.cs      NFC-e manual / reprocessamento
â”‚   â”‚   â””â”€â”€ ...
â”‚   â”œâ”€â”€ Data/
â”‚   â”‚   â”œâ”€â”€ AppDbContext.cs               30+ DbSets
â”‚   â”‚   â”œâ”€â”€ DbSeeder.cs                   seed de empresas e catÃ¡logo
â”‚   â”‚   â”œâ”€â”€ AddonGroupSeeder.cs           classifica addons em grupos na inicializaÃ§Ã£o
â”‚   â”‚   â””â”€â”€ AddonSplitSeeder.cs           desmembra addons combinados ("A ou B" â†’ A + B)
â”‚   â”œâ”€â”€ Entities/
â”‚   â”‚   â”œâ”€â”€ Catalog/
â”‚   â”‚   â”‚   â”œâ”€â”€ Product.cs
â”‚   â”‚   â”‚   â”œâ”€â”€ ProductAddon.cs           campo IsDefault (prÃ©-seleciona no stepper)
â”‚   â”‚   â”‚   â””â”€â”€ ProductAddonGroup.cs      grupos para fluxo step-by-step
â”‚   â”‚   â”œâ”€â”€ Customers/
â”‚   â”‚   â”‚   â”œâ”€â”€ Customer.cs               Phone, CpfHash, PointsBalance
â”‚   â”‚   â”‚   â””â”€â”€ LoyaltyTransaction.cs     SaleOrderId + OrderId (PDV e delivery)
â”‚   â”‚   â”œâ”€â”€ Pdv/
â”‚   â”‚   â”‚   â””â”€â”€ SaleOrder.cs              venda PDV com CustomerId, CustomerPhone
â”‚   â”‚   â””â”€â”€ ...
â”‚   â”œâ”€â”€ Services/
â”‚   â”‚   â”œâ”€â”€ Customers/LoyaltyService.cs   EarnAsync, EarnForOrderAsync, RedeemAsync
â”‚   â”‚   â”œâ”€â”€ WhatsApp/
â”‚   â”‚   â”‚   â”œâ”€â”€ WhatsAppNotificationService.cs
â”‚   â”‚   â”‚   â”‚     NotifySaleCompletedAsync       â€” NFC-e via WhatsApp
â”‚   â”‚   â”‚   â”‚     SendPdvLoyaltyComplementAsync  â€” pontos independente de NFC-e
â”‚   â”‚   â”‚   â”‚     TrySendLoyaltyDeliveredComplementAsync â€” delivery
â”‚   â”‚   â”‚   â””â”€â”€ WhatsAppClient.cs
â”‚   â”‚   â”œâ”€â”€ Fiscal/Jobs/FiscalQueueProcessorJob.cs
â”‚   â”‚   â””â”€â”€ ...
â”‚   â”œâ”€â”€ Migrations/                        migraÃ§Ãµes EF Core
â”‚   â””â”€â”€ Program.cs                         startup + safety nets SQL idempotentes
â”‚
â””â”€â”€ frontend/petshop-web/src/
    â”œâ”€â”€ features/
    â”‚   â”œâ”€â”€ catalog/
    â”‚   â”‚   â”œâ”€â”€ api.ts                     fetchProducts + normalizeProductGroups()
    â”‚   â”‚   â”œâ”€â”€ queries.ts                 useProducts, useProduct
    â”‚   â”‚   â”œâ”€â”€ ProductAddonStepper.tsx    UI step-by-step de adicionais
    â”‚   â”‚   â”œâ”€â”€ useProductStepper.ts       hook â€” estado, validaÃ§Ã£o, buildSynthetic()
    â”‚   â”‚   â””â”€â”€ ProductQuickViewModal.tsx  modal desktop (usa stepper quando hasGroups)
    â”‚   â”œâ”€â”€ cart/
    â”‚   â”‚   â”œâ”€â”€ cart.tsx                   CartProvider + useCart (NÃƒO alterar)
    â”‚   â”‚   â””â”€â”€ CartSheet.tsx / CartSidebar.tsx
    â”‚   â””â”€â”€ pdv/
    â”‚       â”œâ”€â”€ api.ts                     addItem, paySale, searchCustomerâ€¦
    â”‚       â””â”€â”€ PdvContext.tsx
    â”œâ”€â”€ pages/
    â”‚   â”œâ”€â”€ pdv/PdvPage.tsx                PDV GoCoffee (AddonModal com stepper)
    â”‚   â”œâ”€â”€ ProductDetail.tsx              pÃ¡gina mobile (usa stepper quando hasGroups)
    â”‚   â”œâ”€â”€ Checkout.tsx
    â”‚   â””â”€â”€ admin/
    â”‚       â”œâ”€â”€ ProductForm.tsx            CRUD produto + adicionais flat
    â”‚       â””â”€â”€ ...
    â””â”€â”€ components/
        â””â”€â”€ Toast.tsx                      ToastProvider + useToast
```

---

## 5. MÃ³dulo de Adicionais (Addon Groups + Stepper)

### Entidades

**`ProductAddonGroup`** â€” grupo de opÃ§Ãµes de um produto:
- `SelectionType`: `"single"` (radio, auto-avanÃ§a no stepper) ou `"multiple"` (checkbox)
- `IsRequired`, `MinSelections`, `MaxSelections`, `SortOrder`

**`ProductAddon`** â€” item dentro de um grupo:
- `AddonGroupId` â€” FK para o grupo (nulo = avulso legacy)
- `IsDefault` â€” prÃ©-selecionado ao abrir o stepper (ex: Leite integral)

### Ordem dos grupos (padrÃ£o GoCoffee)

| Sort | Grupo | Tipo | Regra de nome |
|---|---|---|---|
| 0 | Sabor | single | `priceCents == 0` (Natural, Baunilhaâ€¦) |
| 1 | Tipo de Leite | single | contÃ©m "leite", "lactose", "aveia", "integral" |
| 2 | Cobertura | single | contÃ©m "cobertura", "chantilly", "ganache" |
| 3 | Extras | multiple | demais adicionais pagos |

### Seeders de inicializaÃ§Ã£o

1. **`AddonGroupSeeder`** â€” para cada produto com addons sem grupos: classifica e cria os grupos; marca `IsDefault = true` no primeiro do Tipo de Leite
2. **`AddonSplitSeeder`** â€” detecta addons com `" ou "` no nome (ex: `"Cobertura (caramelo ou chocolate)"`) e divide em registros individuais; original vira `IsActive = false`

Ambos sÃ£o **idempotentes** â€” rodam a cada startup mas sÃ³ atuam se houver pendÃªncias.

### Frontend â€” `normalizeProductGroups()`

Em `catalog/api.ts`: se o produto retornar da API sem grupos mas com addons flat, cria grupos sintÃ©ticos em memÃ³ria com a mesma lÃ³gica de classificaÃ§Ã£o do `AddonGroupSeeder`. Garante que o stepper apareÃ§a mesmo antes do Render reiniciar.

### Auto-avanÃ§o

No `ProductAddonStepper.tsx`: grupos `single` avanÃ§am automaticamente apÃ³s seleÃ§Ã£o (delay 180ms para feedback visual). Grupos `multiple` e Ãºltima etapa exigem clique manual em **PrÃ³ximo**/**Adicionar**.

---

## 6. Programa de Fidelidade

### Fluxo PDV (`PdvController.Pay`)

1. ApÃ³s `tx.CommitAsync()`, roda `EarnAsync` **antes** de enfileirar `FiscalQueueProcessorJob` (evita race condition onde o job fiscal dispara o WhatsApp antes de a transaÃ§Ã£o de pontos existir)
2. ConfirmaÃ§Ã£o de identidade â€” dois caminhos:
   - **CPF digitado** â†’ valida hash contra `Customer.CpfHash`
   - **Cliente buscado por telefone** (sem CPF digitado) â†’ verifica que o cadastro tem `CpfHash` registrado (identidade confirmada pelo operador)
3. Enfileira `SendPdvLoyaltyComplementAsync` para todo cliente confirmado

### Fluxo Delivery (`LoyaltyService.EarnForOrderAsync`)

- `LoyaltyTransaction.OrderId` salvo â†’ permite lookup no complemento WhatsApp

### WhatsApp â€” Complemento de Fidelidade

**`SendPdvLoyaltyComplementAsync(saleId)`** â€” mÃ©todo dedicado para PDV:
- Independente de NFC-e e de `SALE_COMPLETED`
- Fallback de telefone: usa `sale.CustomerPhone` ou `Customer.Phone` do cadastro
- IdempotÃªncia dupla: verifica `PDV_LOYALTY_COMPLEMENT` + `ENTREGUE_LOYALTY_COMPLEMENT` para nÃ£o duplicar
- Template `card_transaction_alert_2`: `{{1}}`=firstName, `{{2}}`=earnedPoints, `{{3}}`=pointsBalance

**`TrySendLoyaltyDeliveredComplementAsync`** â€” para delivery (trigger: status `ENTREGUE`):
- Lookup de `earnedPoints` via `LoyaltyTransaction.OrderId`

---

## 7. PDV (`PdvPage.tsx`)

Interface GoCoffee:
- `AddonModal` â€” abre ao clicar em produto com `hasAddons = true`
  - Busca `/admin/products/{id}/addons` + `/admin/products/{id}/addon-groups` em paralelo
  - Se grupos existem â†’ `ProductAddonStepper` com `--brand` sobrescrito pelo caramelo GoCoffee
  - Se sem grupos mas com addons â†’ auto-wrap em grupos sintÃ©ticos (mesma lÃ³gica do `normalizeProductGroups`)
  - `handleStepperConfirm`: extrai addon IDs de `synthetic.id.split("__")[1].split("_")` e chama `addItem`
- Busca de cliente: por telefone (`searchCustomer`) ou CPF â€” ambos atribuem fidelidade

---

## 8. Fiscal (NFC-e)

- `FiscalQueueProcessorJob` processa a fila assÃ­ncrona via Hangfire
- ApÃ³s autorizaÃ§Ã£o SEFAZ: enfileira `NotifySaleCompletedAsync` (comprovante WhatsApp)
- `NotifySaleCompletedAsync` â†’ apÃ³s envio bem-sucedido â†’ `TrySendLoyaltyDeliveredComplementAsync` (via pedido espelho)
- **Importante**: o complemento de fidelidade PDV (`SendPdvLoyaltyComplementAsync`) Ã© independente deste fluxo â€” chega mesmo quando o cliente nÃ£o pede NFC-e

---

## 9. Banco de Dados e Safety Nets

MigraÃ§Ãµes padrÃ£o EF Core + blocos `ADD COLUMN IF NOT EXISTS` em `Program.cs` para garantir resiliÃªncia quando migrations sÃ£o marcadas como aplicadas mas o DDL nÃ£o rodou:

```sql
-- Exemplos de safety nets em Program.cs
ALTER TABLE "ProductAddons"
    ADD COLUMN IF NOT EXISTS "AddonGroupId" uuid,
    ADD COLUMN IF NOT EXISTS "IsDefault" boolean NOT NULL DEFAULT false;

ALTER TABLE "LoyaltyTransactions"
    ADD COLUMN IF NOT EXISTS "OrderId" uuid;

CREATE TABLE IF NOT EXISTS "ProductAddonGroups" (...);
```

**Tabelas principais do mÃ³dulo de adicionais:**

| Tabela | Notas |
|---|---|
| `ProductAddons` | `AddonGroupId` (FK), `IsDefault`, `IsActive` |
| `ProductAddonGroups` | `ProductId`, `SelectionType`, `IsRequired`, `SortOrder` |
| `LoyaltyTransactions` | `SaleOrderId` (PDV), `OrderId` (delivery) |
| `WhatsAppMessageLogs` | `TriggerStatus` para idempotÃªncia de notificaÃ§Ãµes |

---

## 10. VariÃ¡veis de Ambiente

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

## 11. ImpressÃ£o Mobile (Android + iPad)

### Arquitetura

O sistema de impressÃ£o tem trÃªs camadas, todas conectadas ao mesmo hub SignalR `/hubs/print`:

| Camada | Plataforma | Mecanismo |
|---|---|---|
| `PrintAgent` (Windows service) | PC Windows | `System.Drawing.Printing` â†’ impressora local (USB/rede/Bluetooth pareado) |
| Print Station (browser, flag `PRINT_STATION_KEY`) | Qualquer browser | `window.print()` â†’ dialog do SO |
| **Mobile Agent** (browser, flag `MOBILE_AGENT_KEY`) | Tablet Android/iPad | Web Bluetooth ou `window.print()` + AirPrint |

### Arquivos do Agente Mobile

| Arquivo | Responsabilidade |
|---|---|
| `features/admin/print/escpos.ts` | Gerador de bytes ESC/POS (Uint8Array). Suporta papel 58 mm (32 col) e 80 mm (48 col). Sem deps externas. |
| `features/admin/print/mobilePrint.ts` | LÃ³gica de despacho: `isMobileAgent()`, `connectBluetoothPrinter()`, `mobilePrint()`. Gerencia estado BLE da sessÃ£o. |
| `pages/admin/MobilePrintAgentPage.tsx` | PÃ¡gina `/app/impressao/mobile` â€” toggle de agente, seletor de modo, pairing BLE, teste de impressÃ£o, log. |

### Fluxo de dispatch (`usePrintListener.tsx`)

```
PrintOrder (SignalR)
        â”‚
        â”œâ”€ isMobileAgent() â†’ true  â†’ mobilePrint(payload, jobId)
        â”‚                                â”œâ”€ mode=bluetooth â†’ sendViaBluetooth (ESC/POS via BLE)
        â”‚                                â””â”€ mode=browser  â†’ window.print() â†’ AirPrint/dialog
        â”‚
        â””â”€ isPrintStation() â†’ true â†’ window.print() (desktop)
```

### Web Bluetooth â€” Notas de compatibilidade

- Requer **Chrome no Android** (ou qualquer browser baseado em Chromium com BLE)
- **Safari/iOS nÃ£o suporta** Web Bluetooth â€” usar modo "Navegador/AirPrint"
- O pairing ocorre via `navigator.bluetooth.requestDevice()` e exige gesto do usuÃ¡rio (clique)
- A referÃªncia ao dispositivo fica em memÃ³ria; reconexÃ£o automÃ¡tica ao reconectar o GATT
- Tenta UUIDs de serviÃ§o de mÃºltiplas marcas; fallback: percorre todos os serviÃ§os do dispositivo
- Envia bytes em chunks de 512 (MTU BLE) com delay de 20 ms entre chunks

### ConfiguraÃ§Ãµes (localStorage, por dispositivo)

| Chave | Valores | DescriÃ§Ã£o |
|---|---|---|
| `vendapps_mobile_agent` | `"1"` / ausente | Agente ativo neste tablet |
| `vendapps_mobile_mode` | `"bluetooth"` / `"browser"` | EstratÃ©gia de impressÃ£o |
| `vendapps_mobile_paper` | `"58"` / `"80"` | Largura do papel em mm |

ConfiguraÃ§Ãµes persistem entre sessÃµes e trocas de turno â€” o atendente nÃ£o precisa reconfigurar.

### Impressoras AirPrint compatÃ­veis (modo browser/iPad)

Epson TM-m30II, Star mPOP, Star TSP100IV (com AirPrint habilitado), Brother PJ-722/PJ-723, e qualquer impressora que exponha AirPrint na rede local.

---

## 12. PadrÃµes de CÃ³digo

### Backend â€” Regra de ouro
- Loyalty e WhatsApp nunca derrubam a venda: sempre em `try { } catch { }` fora da transaÃ§Ã£o principal
- Safety nets SQL idempotentes em `Program.cs` garantem colunas mesmo se migration foi pulada

### Frontend â€” Regras crÃ­ticas (NÃƒO alterar sem anÃ¡lise)
- `cart.tsx` â€” CartProvider e `useCart`: contrato fixo
- `catalog/api.ts` â€” tipos `Product`, `ProductAddon`, `ProductAddonGroup`: alteraÃ§Ãµes exigem atualizar backend e stepper
- `useProductStepper.ts` â€” `buildSynthetic()` codifica addon IDs no `synthetic.id` como `{productId}__{id1_id2_...}`; o PDV depende desse formato para extrair os IDs ao chamar `addItem`

### Frontend â€” PadrÃ£o de chamada admin
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

Na primeira execuÃ§Ã£o o `DbSeeder` + `AddonGroupSeeder` + `AddonSplitSeeder` rodam automaticamente.

---

## 14. Commits Recentes Relevantes

| Hash | DescriÃ§Ã£o |
|---|---|
| (atual) | feat: agente de impressÃ£o mobile â€” Web Bluetooth + AirPrint para Android/iPad |
| `8430a63` | fix: fidelidade ao buscar cliente por telefone (sem CPF digitado) |
| `559f70d` | feat: desmembrar addons combinados + auto-avanÃ§o em seleÃ§Ã£o Ãºnica |
| `2a1f044` | feat: grupos de adicionais por prioridade + Leite Integral prÃ©-selecionado |
| `413f91c` | fix: fidelidade independente de NFC-e + stepper para addons sem grupos |
| `f917849` | fix: race condition earnedPoints + stepper no PDV |
| `1d6d6ae` | fix: safety nets idempotentes OrderId + AddonGroups |
| `4186311` | feat: fluxo step-by-step para seleÃ§Ã£o de adicionais por grupo |
| `de151ec` | fix: earnedPoints zerados na notificaÃ§Ã£o WhatsApp delivery |

---

## 15. Catalogo Moderno (Feature Flag)

- Nova flag por tenant: `modern_catalog_experience`
- Origem da flag: `PlanFeatureService` (default `false`) + overrides em `CompanyFeatureOverrides`
- Configuracao: Master Admin -> Company -> Feature Flags
- Escopo:
  - Catalogo publico (`/`) alterna entre layout legado e `ModernPublicCatalog`
  - Catalogo por mesa (`/mesa/:tableId`) usa a mesma flag por slug
- Compatibilidade de fluxo preservada:
  - Delivery continua finalizando pelo checkout existente
  - Mesa continua finalizando via `CreateOrder` com `PAY_AT_COUNTER`
  - Selecao de adicionais por grupos no fluxo de mesa usa `ProductAddonStepper` (mesma base do PDV)

