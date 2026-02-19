# HANDOFF - Sessao 2026-02-17

## Resumo da Sessao

Implementacao de **Sistema de Roteamento Bidirecional com Preview** + **ViaCEP para enriquecimento de geocoding**.

O sistema de entregas agora:
1. Parte de um **depot fixo** (R. Cel. Tamarindo, 1476 - Bangu)
2. Divide pedidos em **Rota A** (Leste) e **Rota B** (Oeste) usando azimute/bearing
3. Bloqueia **Vila Kennedy** por poligono de exclusao
4. Mostra **preview** de ambas as rotas antes de criar
5. Enriquece enderecos via **ViaCEP** antes de geocodificar (ORS/Nominatim)

---

## Arquitetura Implementada

### Fluxo de Geocoding (NOVO - ViaCEP)

```
Pedido criado → Status PRONTO_PARA_ENTREGA
    ↓
OrdersController.BuildGeocodingQueryAsync()
    ↓
ViaCepService.GetAddressAsync(order.Cep)
    → API: https://viacep.com.br/ws/{cep}/json/
    → Retorna: logradouro + bairro + localidade + uf
    ↓
Monta query enriquecida:
    ANTES: "Rua X, Nº 123 - Bairro, 21870001, Rio de Janeiro, RJ, Brasil"
    AGORA: "Rua X, 123, Bairro, Rio de Janeiro, RJ, Brasil"
    ↓
FallbackGeocodingService.GeocodeAsync(enrichedAddress)
    1. ORS Geocoding API → lat/lng (primary)
    2. Nominatim/OSM → lat/lng (fallback)
    ↓
Coordenadas salvas no banco (order.Latitude, order.Longitude)
```

### Fluxo de Preview de Rotas

```
Frontend: previewRoutes(orderIds[]) → POST /routes/preview
    ↓
RoutePreviewService.PreviewRoutesAsync(orderIds)
    ↓
1. Buscar Orders do banco
2. Filtrar validos:
   - Status == PRONTO_PARA_ENTREGA
   - Tem coordenadas
   - Dentro do raio de 11km (DepotService)
   - Fora da Vila Kennedy (GeofencingService)
3. Classificar via bearing (NeighborhoodClassificationService):
   - 0° a 180° → Rota A (Leste)
   - 180° a 360° → Rota B (Oeste)
4. Otimizar cada rota (RouteOptimizationService.OptimizeWithDepotAsync):
   - Depot como ponto de partida
   - ORS Matrix API (tempo real) ou Haversine (fallback)
   - Greedy nearest neighbor
5. Retornar PreviewRouteResponse com ambas as rotas
    ↓
Frontend: exibe Rota A (azul) e Rota B (verde) lado a lado
    → Usuario clica para selecionar
    → Botao "Criar Rota A" ou "Criar Rota B"
```

### Fluxo de Criacao de Rota

```
Frontend: createRoute({ delivererId, orderIds, routeSide: "A" })
    → POST /routes { delivererId, orderIds, routeSide }
    ↓
RoutesController → DeliveryManagementService.CreateRouteAsync()
    ↓
1. Validar pedidos (status, raio, exclusao)
2. Filtrar por RouteSide (RouteSideValidator)
3. Otimizar com depot (OptimizeWithDepotAsync)
4. Criar Route + RouteStops no banco
```

---

## Arquivos Criados (NOVOS)

### Backend - Servicos de Roteamento

| Arquivo | Descricao |
|---------|-----------|
| `Services/Routes/DepotService.cs` | Coordenadas do depot, validacao de raio (11km), Haversine |
| `Services/Routes/GeofencingService.cs` | Ray casting para poligono Vila Kennedy |
| `Services/Routes/NeighborhoodClassificationService.cs` | Bearing 0-180°=A, 180-360°=B |
| `Services/Routes/RouteSideValidator.cs` | Filtra pedidos por lado (A/B) |
| `Services/Routes/RoutePreviewService.cs` | Orquestra preview bidirecional |

### Backend - ViaCEP

| Arquivo | Descricao |
|---------|-----------|
| `Services/Geocoding/ViaCepService.cs` | Consulta viacep.com.br, retorna logradouro+bairro+cidade |

### Backend - DTOs de Preview

| Arquivo | Descricao |
|---------|-----------|
| `Contracts/Delivery/Routes/Preview/PreviewRouteRequest.cs` | `{ orderIds: Guid[] }` |
| `Contracts/Delivery/Routes/Preview/PreviewRouteResponse.cs` | `{ routeA, routeB, unknownOrders, warnings, summary }` |
| `Contracts/Delivery/Routes/Preview/PreviewRouteDto.cs` | `{ side, direction, totalStops, estimatedDistanceKm, orders[] }` |
| `Contracts/Delivery/Routes/Preview/PreviewOrderDto.cs` | `{ orderId, orderNumber, customerName, address, lat, lon, sequence, classification, distanceFromDepotKm }` |

---

## Arquivos Modificados

### Backend

| Arquivo | O que mudou |
|---------|-------------|
| `Controllers/OrdersController.cs` | Injetou `ViaCepService`. Adicionou `BuildGeocodingQueryAsync()` que enriquece endereco via ViaCEP antes de geocodificar. Substituiu as 3 linhas `queryAddress = $"{order.Address}, {order.Cep}..."` por chamada ao novo metodo. |
| `Controllers/RoutesController.cs` | Adicionou endpoint `POST /routes/preview`. Modificou `POST /routes` para aceitar `routeSide`. |
| `Services/RouteOptimizationService.cs` | Adicionou `OptimizeWithDepotAsync()` que inclui depot como ponto 0 na matriz ORS. Adicionou validacao de dimensoes da matriz, bounds checking nos indices, try-catch no loop greedy para resiliencia. |
| `Services/DeliveryManagementService.cs` | Modificou `CreateRouteAsync` para aceitar `routeSide`. Adiciona validacoes de raio, exclusao, e filtragem por lado. Usa `OptimizeWithDepotAsync` quando routeSide esta presente. |
| `Services/Geocoding/FallbackGeocodingService.cs` | Sem mudancas nesta sessao (ja existia ORS→Nominatim). |
| `Contracts/Delivery/CreateRouteRequest.cs` | Adicionou `public string? RouteSide { get; set; }` |
| `Program.cs` | Registrou 5 novos servicos de roteamento (Scoped) + ViaCepService (HttpClient, timeout 5s) |
| `appsettings.json` | Adicionou secao `Depot` com Name, Address, Latitude (-22.878500), Longitude (-43.469500), RadiusKm (11.0) |

### Frontend

| Arquivo | O que mudou |
|---------|-------------|
| `features/admin/routes/api.ts` | Adicionou tipos `PreviewRouteResponse`, `PreviewRouteDto`, `PreviewOrderDto`. Adicionou funcao `previewRoutes(orderIds)`. Modificou `createRoute()` para aceitar `routeSide`. |
| `pages/admin/RoutePlanner.tsx` | Reescrito completo: removeu calculo local Haversine (`orderOldestThenNearest`). Adicionou state `selectedSide`. Adicionou `previewQ` (React Query → backend). Nova UI com Rota A (azul) e Rota B (verde) lado a lado, warnings, summary, pedidos desconhecidos. Botao "Criar Rota A/B" so aparece apos selecao. |

---

## Configuracao - appsettings.json

```json
{
  "Geocoding": {
    "Provider": "ORS",
    "Ors": {
      "ApiKey": "...",
      "BaseUrl": "https://api.openrouteservice.org",
      "TimeoutSeconds": 8,
      "MaxRetries": 2
    },
    "Depot": {
      "Name": "Petshop Central - Bangu",
      "Address": "R. Cel. Tamarindo, 1476 - Bangu, Rio de Janeiro - RJ, 21870-001",
      "Latitude": -22.878500,
      "Longitude": -43.469500,
      "RadiusKm": 11.0
    }
  }
}
```

---

## Regras de Negocio

### Classificacao de Rotas (Bearing/Azimute)
- **Depot**: R. Cel. Tamarindo, 1476 - Bangu (-22.878500, -43.469500)
- **Rota A** (bearing 0° a 180°): tudo ao LESTE do depot
  - Senador Camara, Santissimo, Campo Grande (via Av. Santa Cruz)
- **Rota B** (bearing 180° a 360°): tudo ao OESTE do depot
  - Padre Miguel, Realengo
- **Cobertura 100%**: todo pedido com coordenadas e classificado (sem "Unknown")
- **Vila Kennedy**: bloqueada por poligono (ray casting), pedidos rejeitados no filtro

### Poligono Vila Kennedy
```
(-22.8525, -43.3750) Nordeste
(-22.8525, -43.3850) Noroeste
(-22.8650, -43.3850) Sudoeste
(-22.8650, -43.3750) Sudeste
```

### Otimizacao de Rotas
- **Ponto de partida**: sempre o depot
- **Algoritmo**: greedy nearest neighbor
- **Metrica primaria**: ORS Matrix API (tempo real de trajeto em segundos)
- **Fallback**: Haversine (distancia em linha reta em km)
- **Resiliencia**: validacao de dimensoes da matriz, bounds checking, try-catch no loop
- **Delay**: 500ms entre otimizacao de Rota A e Rota B (evita rate limit ORS)

### ViaCEP - Enriquecimento de Endereco
- **API**: `https://viacep.com.br/ws/{cep}/json/` (gratuita, 100% cobertura BR)
- **Extrai**: logradouro, bairro, localidade, UF
- **Numero da casa**: extraido do endereco original via regex `[Nn].?o?\s*(\d+)`
- **Query enriquecida**: `"{logradouro}, {numero}, {bairro}, {cidade}, {UF}, Brasil"`
- **Fallback**: formato original se ViaCEP falhar
- **Aplicado em 3 pontos**: transicao de status, batch geocode-missing, reprocess individual

---

## Endpoints da API

| Metodo | Rota | Descricao |
|--------|------|-----------|
| `POST` | `/routes/preview` | Preview bidirecional (Rota A + B) sem salvar |
| `POST` | `/routes` | Criar rota (aceita `routeSide: "A"\|"B"`) |
| `POST` | `/orders/{id}/reprocess-geocoding?force=true` | Reprocessar geocoding com ViaCEP |
| `POST` | `/orders/geocode-missing?limit=50` | Batch reprocessar pedidos sem coords |
| `GET`  | `/routes/{id}/navigation` | Links Waze + Google Maps |

---

## Dependencias Externas

| Servico | Uso | Rate Limit | Custo |
|---------|-----|------------|-------|
| ViaCEP | Normalizar CEP → endereco | Sem limite documentado | Gratuito |
| ORS Geocoding | CEP+endereco → lat/lng | 40 req/min | Gratuito (free tier) |
| Nominatim/OSM | Fallback geocoding | 1 req/s | Gratuito |
| ORS Matrix API | Matriz NxN de tempos | 40 req/min | Gratuito (free tier) |

---

## Banco de Dados

**Limpeza realizada em 2026-02-17**: todas as tabelas Orders, OrderItems, Routes, RouteStops foram zeradas para ponto zero de testes.

Tabelas afetadas (sem alteracao de schema):
- `Orders` — campos Latitude, Longitude, GeocodedAtUtc, GeocodeProvider ja existiam
- `Routes` — sem mudancas
- `RouteStops` — sem mudancas

---

## Bugs Corrigidos Nesta Sessao

1. **Pedidos "Nao Classificados"**: bearing ranges tinham buracos (0-30°, 180-280°, 330-360° = Unknown). Corrigido para cobertura 100% (0-180°=A, 180-360°=B).

2. **"Index was out of range"**: ORS Matrix API retornava matriz com dimensoes diferentes do esperado. Corrigido com validacao de dimensoes, bounds checking e try-catch no loop greedy.

3. **Preview crashava quando ambas as rotas tinham pedidos**: duas chamadas ORS Matrix API em sequencia causavam rate limit. Corrigido com try-catch independente por rota + delay de 500ms entre chamadas.

4. **Geocoding impreciso**: query `"{address}, {cep}, Rio de Janeiro, RJ, Brasil"` sem bairro. Corrigido com ViaCEP que adiciona bairro correto a query.

---

## Stack Tecnico

- **Backend**: ASP.NET Core .NET 8, EF Core, PostgreSQL (Docker), JWT Auth
- **Frontend**: React 19 + Vite + TailwindCSS + React Query v5
- **Geocoding**: ViaCEP (enriquecimento) → ORS (primary) → Nominatim (fallback)
- **Otimizacao**: ORS Matrix API (tempo real) → Haversine (fallback)
- **Classificacao**: Bearing/Azimute (formula geodesica)
- **Exclusao**: Ray Casting (point-in-polygon)
