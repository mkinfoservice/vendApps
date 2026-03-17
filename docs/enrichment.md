# Módulo de Enriquecimento de Catálogo

Normaliza nomes e busca imagens automaticamente para produtos importados,
com pipeline de revisão humana e auditoria completa por empresa.

---

## Visão geral

```
Importação (sync)
      │
      ▼
EnrichmentBatch ──► Hangfire Job: EnrichNormalizeProductsJob
      │                           │
      │                           ▼
      │                CatalogEnrichmentOrchestrator.RunNormalizationAsync()
      │                  • ProductNormalizationService  → ProductNameSuggestion
      │                  • Auto-aplica se score ≥ threshold (padrão: nunca)
      │                  • Caso contrário: Pending → fila de revisão
      │
      └──► (IncludeImages=true) → ContinueJobWith: EnrichMatchImagesJob
                                  │
                                  ▼
                       CatalogEnrichmentOrchestrator.RunImageMatchingAsync()
                         • ProductImageMatchingService → IProductImageMatcher[]
                         • EnrichmentScoringService   → score por barcode/nome/marca
                         • Auto-aplica se score ≥ threshold (padrão: nunca)
                         • Caso contrário: Pending → fila de revisão
```

---

## Entidades

| Entidade | Tabela | Descrição |
|---|---|---|
| `EnrichmentBatch` | `EnrichmentBatches` | Agrupa uma execução de enriquecimento; rastreia progresso e stats |
| `ProductEnrichmentResult` | `ProductEnrichmentResults` | Um registro por produto por lote; controla status individual |
| `ProductNameSuggestion` | `ProductNameSuggestions` | Sugestão de nome normalizado com score e steps JSON |
| `ProductImageCandidate` | `ProductImageCandidates` | Candidata de imagem com URL, score e breakdown |
| `EnrichmentConfig` | `EnrichmentConfigs` | Configuração por empresa (1:1); thresholds e flags |

### EnrichmentBatch — campos principais

```
Id, CompanyId, Trigger, Status, TotalQueued,
Processed, NamesNormalized, ImagesApplied,
PendingReview, FailedItems,
StartedAtUtc, FinishedAtUtc, ErrorMessage,
SyncJobId (FK opcional para ProductSyncJob)
```

**Status flow:** `Queued → Running → Done | Failed`

**Trigger:** `Manual | PostSync | Scheduled`

### EnrichmentConfig — defaults

| Campo | Default | Significado |
|---|---|---|
| `AutoApplyImageThreshold` | 0.95 | Score mínimo para aplicar imagem automaticamente |
| `ReviewImageThreshold` | 0.75 | Score mínimo para enviar à revisão humana |
| `AutoApplyNameThreshold` | 1.0 | Score mínimo para aplicar nome sem revisão (1.0 = nunca) |
| `BatchSize` | 50 | Itens por página de processamento interno |
| `DelayBetweenItemsMs` | 500 | Pausa entre chamadas à API externa de imagens |
| `EnableImageMatching` | false | Matching de imagem é opt-in por empresa |
| `EnableNameNormalization` | true | Normalização de nomes ativa por padrão |

---

## Pipeline de normalização de nomes

Serviço: `ProductNormalizationService`

6 passos deterministicos em sequência:

| Passo | Descrição | Exemplo |
|---|---|---|
| `collapse-spaces` | Colapsa espaços múltiplos | `"Ração  Premium"` → `"Ração Premium"` |
| `normalize-separators` | Padroniza separadores `/`, `\`, `-` | `"Ração/Premium"` → `"Ração - Premium"` |
| `expand-abbreviations` | Expande abreviações mapeadas | `"Kg"` → `"kg"`, `"Unid"` → `"un"` |
| `normalize-units` | Normaliza unidades de medida | `"500G"` → `"500g"`, `"1L"` → `"1L"` |
| `normalize-unit-spacing` | Espaço correto antes de unidade | `"500g"` → `"500 g"` |
| `title-case` | Title case com acronyms preservados | `"racao premium"` → `"Ração Premium"` |

**Score:** `0.0` se sem alterações, `0.99` no máximo quando há mudanças
(score 1.0 nunca é emitido por mudanças → auto-apply com threshold 1.0 nunca acontece)

---

## Pipeline de scoring de imagens

Serviço: `EnrichmentScoringService`

| Componente | Peso | Critério |
|---|---|---|
| `barcode` | 0.70 | Match exato de dígitos entre EAN do produto e candidata |
| `name` | 0.20 | Similaridade Jaccard entre palavras normalizadas |
| `brand` | 0.08 | Similaridade Jaccard de marcas |
| `category` | 0.02 / 0.01 | Bonus fixo (0.02 sem categoria no produto, 0.01 com) |

**Decisão por score:**
- `≥ AutoApplyImageThreshold` → `AutoApply` (aplica se produto não tem imagem)
- `≥ ReviewImageThreshold` → `PendingReview` (vai para fila de revisão)
- `< ReviewImageThreshold` → `Reject`

**Regra de ouro:** nunca sobrescrever imagem existente — verificado em duas camadas
(orchestrator + endpoint de aprovação manual).

---

## Fonte de imagens

Interface: `IProductImageMatcher`

Implementação padrão: `OpenFoodFactsClient`
- API pública, sem chave: `https://world.openfoodfacts.org/api/v0/product/{barcode}.json`
- Busca apenas por código de barras (EAN)
- Retorna `null` se produto não encontrado ou sem imagem

Para adicionar novas fontes, implementar `IProductImageMatcher` e registrar no DI:
```csharp
builder.Services.AddScoped<IProductImageMatcher, MinhaNovaFonte>();
```
`ProductImageMatchingService` agrega todas as implementações registradas.

---

## Endpoints da API

Base: `GET|POST|PUT /admin/enrichment` — requer role `admin` ou `gerente`

### Lotes

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/batches` | Cria lote e enfileira job de normalização |
| `GET` | `/batches` | Lista lotes paginados (`?page=1&pageSize=20`) |
| `GET` | `/batches/{id}` | Detalhe de um lote |
| `POST` | `/reprocess-without-image` | Atalho: lote para todos os produtos sem imagem |

#### `POST /batches` — body

```json
{
  "scope": "all | without-image | recently-imported | by-category",
  "recentHours": 24,
  "categoryId": "uuid",
  "includeImages": false
}
```

### Revisão de nomes

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/review/names` | Lista sugestões (`?status=Pending&page=1&pageSize=50`) |
| `POST` | `/review/names/{id}/approve` | Aprova e aplica nome ao produto |
| `POST` | `/review/names/{id}/reject` | Rejeita sugestão |
| `POST` | `/review/names/bulk-approve` | Aprova múltiplos (`{ "suggestionIds": ["uuid", ...] }`, máx. 500) |

### Revisão de imagens

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/review/images` | Lista candidatas (`?status=Pending&page=1&pageSize=50`) |
| `POST` | `/review/images/{id}/approve` | Baixa imagem externamente e aplica ao produto |
| `POST` | `/review/images/{id}/reject` | Rejeita candidata |

### Configuração

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/config` | Retorna config da empresa (cria com defaults se não existir) |
| `PUT` | `/config` | Atualiza todos os campos da config |

#### `PUT /config` — body (todos os campos obrigatórios)

```json
{
  "autoApplyImageThreshold": 0.95,
  "reviewImageThreshold": 0.75,
  "autoApplyNameThreshold": 1.0,
  "batchSize": 50,
  "delayBetweenItemsMs": 500,
  "enableImageMatching": false,
  "enableNameNormalization": true
}
```

---

## Hook pós-sync

Ao disparar um sync manual com `autoEnrich: true`, o `AdminProductSyncController`
enfileira automaticamente um lote de enriquecimento após o sync concluir com sucesso:

```json
POST /admin/products/sync
{
  "sourceId": "uuid",
  "syncType": "Full",
  "autoEnrich": true
}
```

Escopo usado: `RecentlyImported` (produtos inseridos/atualizados na última hora).
Só enfileira se `job.Status == Done` e `inserted + updated > 0`.

---

## Jobs Hangfire

| Job | Classe | Chamado por |
|---|---|---|
| Normalização | `EnrichNormalizeProductsJob` | Controller (`Enqueue`) |
| Matching de imagem | `EnrichMatchImagesJob` | Controller (`ContinueJobWith` após normalização) |

Ambos chamam `CatalogEnrichmentOrchestrator` — **nunca** são chamados inline em requests HTTP.

---

## Multi-tenant

Todos os queries filtram por `CompanyId` extraído do JWT claim `"companyId"`.
Nenhuma operação acessa dados de outra empresa — validado no controller, serviço e orchestrator.

---

## Auditoria

Toda alteração aplicada (nome ou imagem) gera uma entrada em `ProductChangeLogs`:

```
Source: Admin
FieldName: "Name" | "Image"
OldValue / NewValue
ChangedByUserId: userId do revisor ou "enrichment-auto"
```

---

## Frontend

Rota: `/app/enriquecimento` (roles: `admin`, `gerente`)

Módulo registrado em `config/modules.ts` (grupo `PLATAFORMA`).

| Tab | Função |
|---|---|
| Lotes | Dispara lotes, acompanha progresso em tempo real (polling a cada 3s) |
| Revisão de Nomes | Tabela com checkbox bulk-approve, score badge, aprovar/rejeitar por linha |
| Revisão de Imagens | Grid de cards com thumbnail, score overlay, aprovar/rejeitar |
| Configuração | Sliders de threshold, toggles de feature, batch size e delay |

Arquivos:
```
src/features/admin/enrichment/
  types.ts    — tipos TypeScript espelhando os DTOs do backend
  api.ts      — funções de fetch usando adminFetch
  queries.ts  — hooks React Query com invalidação automática

src/pages/admin/CatalogEnrichmentPage.tsx — página principal (4 tabs)
```

---

## Segurança de imagem

A regra "nunca sobrescrever imagem existente" é garantida em **duas camadas**:

1. **Orchestrator** (`CatalogEnrichmentOrchestrator`): checa `ProductImages.AnyAsync` antes de aplicar auto-apply
2. **Endpoint de aprovação** (`POST /review/images/{id}/approve`): checa novamente e retorna `409 Conflict` se já houver imagem

---

## Migration

```
Migrations/20260317000001_AddCatalogEnrichmentModule.cs
```

Cria as 5 tabelas com todos os índices e FKs. Snapshot atualizado manualmente em
`Migrations/AppDbContextModelSnapshot.cs`.
