# ORS Matrix API - Otimização por Tempo Real de Trajeto

## Visão Geral

Implementação da **ORS Matrix API** para otimização de rotas usando **tempo real de trajeto** ao invés de apenas distância em linha reta (Haversine).

## Por que usar Matrix API?

| Método | Como funciona | Precisão | Exemplo |
|--------|---------------|----------|---------|
| **Haversine** (antes) | Distância em linha reta | ❌ Impreciso | 5 km em linha reta, mas 15 min de carro |
| **Matrix API** (agora) | Tempo real considerando estradas | ✅ Muito preciso | 8 km via estrada = 12 min de carro |

### Benefícios

1. ✅ **Tempo real de trajeto** - Considera estradas, sentidos, congestionamentos
2. ✅ **Otimização mais precisa** - Minimiza tempo total de entrega
3. ✅ **Melhor experiência** - Rotas que fazem sentido no mundo real
4. ✅ **Integração perfeita** - Dados compatíveis com Waze/Google Maps
5. ✅ **Fallback automático** - Se API falhar, usa Haversine (sempre funciona)

## Como Funciona

```
┌─────────────────────────────────────────────────────────────┐
│  RouteOptimizationService.OptimizeWithMatrixAsync()         │
│                                                             │
│  1. Separa pedidos com/sem coordenadas                     │
│  2. Seleciona pedido mais antigo como START                │
│                                                             │
│  3. TENTA: ORS Matrix API                                  │
│     ├─ Cria matriz NxN de tempos de trajeto               │
│     ├─ Greedy: sempre escolhe próximo com MENOR TEMPO     │
│     └─ ✅ Sucesso? Rota otimizada por tempo               │
│                                                             │
│  4. FALLBACK: Haversine (se Matrix API falhar)            │
│     ├─ Calcula distância em linha reta                     │
│     ├─ Greedy: sempre escolhe próximo com MENOR DISTÂNCIA │
│     └─ ✅ Rota funcional (menos precisa)                   │
│                                                             │
│  5. Adiciona pedidos sem coords no final                   │
└─────────────────────────────────────────────────────────────┘
```

## Arquivos Implementados

### 1. **OrsMatrixService.cs** (NOVO)
Serviço dedicado para chamar a ORS Matrix API.

**Localização:** `Petshop.Api/Services/OrsMatrixService.cs`

**Métodos principais:**
```csharp
// Calcula matriz NxN de tempos de trajeto (segundos)
Task<double[][]?> GetTravelTimeMatrixAsync(
    List<(double lat, double lon)> coordinates,
    CancellationToken ct = default)

// Versão simplificada: tempo entre 2 pontos
Task<double?> GetTravelTimeAsync(
    (double lat, double lon) origin,
    (double lat, double lon) destination,
    CancellationToken ct = default)
```

**Características:**
- ✅ Timeout de 15s (Matrix API pode demorar mais que geocoding)
- ✅ Logs detalhados com emoji 🚗
- ✅ Retorna `null` se falhar (permite fallback)
- ✅ Usa métrica "duration" (tempo em segundos)
- ✅ Formato driving-car (carro)

### 2. **RouteOptimizationService.cs** (ATUALIZADO)
Serviço de otimização agora usa Matrix API quando disponível.

**Novo método:**
```csharp
Task<List<Order>> OptimizeWithMatrixAsync(
    List<Order> orders,
    CancellationToken ct = default)
```

**Lógica:**
1. Tenta obter matriz de tempos via ORS Matrix API
2. Se sucesso: usa tempos reais (segundos → minutos)
3. Se falhar: usa Haversine (km)
4. Greedy nearest neighbor em ambos os casos
5. Logs indicam qual método foi usado

**Método legado mantido:**
```csharp
List<Order> Optimize(List<Order> orders) // Síncrono, apenas Haversine
```

### 3. **DeliveryManagementService.cs** (ATUALIZADO)
Agora chama `OptimizeWithMatrixAsync` ao criar rotas.

**Mudança:**
```csharp
// ❌ ANTES
var optimized = _optimizer.Optimize(orders);

// ✅ AGORA
var optimized = await _optimizer.OptimizeWithMatrixAsync(orders, ct);
```

### 4. **Program.cs** (ATUALIZADO)
Registro do `OrsMatrixService` na injeção de dependências.

```csharp
builder.Services.AddHttpClient<OrsMatrixService>();
builder.Services.AddScoped<OrsMatrixService>();
```

## Exemplo de Matriz de Tempos

Para 3 pedidos (A, B, C), a Matrix API retorna:

```
        A     B     C
    ┌─────┬─────┬─────┐
  A │  0  │ 720 │ 1440│  <- A→B: 12 min, A→C: 24 min
    ├─────┼─────┼─────┤
  B │ 680 │  0  │ 900 │  <- B→A: 11.3 min, B→C: 15 min
    ├─────┼─────┼─────┤
  C │1500 │ 860 │  0  │  <- C→A: 25 min, C→B: 14.3 min
    └─────┴─────┴─────┘
    (valores em segundos)
```

**Rota otimizada:** A → B (12 min) → C (15 min) = **27 min total**

## Logs de Exemplo

### Sucesso com Matrix API

```
🚗 RouteOptimization (Matrix): received 5 orders, withCoords=5, withoutCoords=0
📍 Order=PS-001 CreatedAtUtc=2026-02-15 10:00 Lat=-22.870000 Lon=-43.460000 LooksLikeRio=True
📍 Order=PS-002 CreatedAtUtc=2026-02-15 10:05 Lat=-22.880000 Lon=-43.430000 LooksLikeRio=True
🎯 START (oldest) = PS-001 (2026-02-15 10:00)
🚗 ORS Matrix: calculando tempos de trajeto para 5 pontos...
✅ ORS Matrix: matriz 5x5 calculada com sucesso
🚗 Tempo [0→1]: 8.5 min
🚗 Tempo [0→2]: 15.2 min
✅ ORS Matrix API: usando tempos reais de trajeto!
🚗 pick next=PS-002 from current=PS-001 8.50 min
🚗 pick next=PS-003 from current=PS-002 6.30 min
🚗 pick next=PS-004 from current=PS-003 4.80 min
🚗 pick next=PS-005 from current=PS-004 7.20 min
✅ RouteOptimization: final order => PS-001 -> PS-002 -> PS-003 -> PS-004 -> PS-005
```

### Fallback para Haversine

```
🚗 RouteOptimization (Matrix): received 3 orders, withCoords=3, withoutCoords=0
🎯 START (oldest) = PS-001 (2026-02-15 10:00)
🚗 ORS Matrix: calculando tempos de trajeto para 3 pontos...
🚗 ORS Matrix: HTTP 429 - Rate limit exceeded
⚠️ ORS Matrix API falhou, usando fallback Haversine
🚗 pick next=PS-002 from current=PS-001 5.20 km
🚗 pick next=PS-003 from current=PS-002 3.80 km
✅ RouteOptimization: final order => PS-001 -> PS-002 -> PS-003
```

## Rate Limits e Custos

| Plano | Requests/min | Requests/dia | Custo |
|-------|--------------|--------------|-------|
| Free | 40 | Ilimitado* | Gratuito |
| Standard | 300 | Ilimitado | €79/mês |
| Premium | Custom | Custom | Custom |

*Sujeito a fair use policy

**Nota:** Matrix API consome 1 request por chamada (independente do número de pontos na matriz).

## Limitações da Matrix API

1. **Máximo de 50 pontos** por chamada (suficiente para MVP)
2. **Timeout maior** (15s vs 8s do geocoding)
3. **Rate limits** mais rigorosos que geocoding
4. **Sem traffic data** no plano gratuito (usa apenas estradas)

## Fallback Automático

O sistema **sempre funciona**, mesmo se a Matrix API falhar:

| Cenário | Comportamento |
|---------|---------------|
| ✅ Matrix API disponível | Usa tempos reais (mais preciso) |
| ❌ API Key não configurada | Usa Haversine (fallback) |
| ❌ Timeout (>15s) | Usa Haversine (fallback) |
| ❌ Rate limit atingido | Usa Haversine (fallback) |
| ❌ Erro HTTP 500 | Usa Haversine (fallback) |
| ❌ Matriz inválida | Usa Haversine (fallback) |

## Configuração

Usa a mesma API Key do geocoding:

```json
{
  "Geocoding": {
    "Ors": {
      "ApiKey": "SUA_API_KEY_AQUI"
    }
  }
}
```

**Não precisa de configuração adicional!**

## Comparação: Haversine vs Matrix API

### Exemplo Real: Zona Oeste RJ

**Cenário:** 5 pedidos em Bangu, Realengo, Campo Grande, Santíssimo, Vila Valqueire

#### Haversine (linha reta)
```
Bangu → Realengo: 4.2 km
Realengo → Vila Valqueire: 6.8 km
Vila Valqueire → Santíssimo: 7.5 km
Santíssimo → Campo Grande: 8.1 km
TOTAL: 26.6 km (estimativa imprecisa)
```

#### Matrix API (tempo real)
```
Bangu → Realengo: 8.5 min (via Av. Brasil)
Realengo → Vila Valqueire: 12.3 min (via Av. das Américas)
Vila Valqueire → Santíssimo: 10.2 min (via Estrada do Mendanha)
Santíssimo → Campo Grande: 7.8 min (via Estrada do Cabuçu)
TOTAL: 38.8 min (tempo real considerando estradas)
```

**Diferença:** A ordem dos pedidos pode mudar completamente!

## Teste Manual

### Teste 1: Verificar que Matrix API está funcionando

1. Crie 3+ pedidos com endereços válidos
2. Crie uma rota com esses pedidos
3. Verifique os logs:
   - Deve aparecer: `✅ ORS Matrix API: usando tempos reais de trajeto!`
   - Deve mostrar: `🚗 pick next=PS-XXX from current=PS-YYY X.X min`

### Teste 2: Testar fallback (simular falha da API)

1. Remova temporariamente a API Key do `appsettings.json`
2. Crie uma rota
3. Verifique os logs:
   - Deve aparecer: `⚠️ ORS Matrix API falhou, usando fallback Haversine`
   - Deve mostrar: `🚗 pick next=PS-XXX from current=PS-YYY X.X km`

### Teste 3: Comparar rotas (Haversine vs Matrix)

1. **Rota A:** Use o método antigo (comentar linha do Matrix no código)
2. **Rota B:** Use Matrix API
3. Compare as sequências - podem ser diferentes!

## Endpoints HTTP (sem mudanças)

A Matrix API funciona **transparentemente**. Endpoints continuam iguais:

```http
POST /routes
Content-Type: application/json

{
  "delivererId": "guid-here",
  "orderIds": ["guid1", "guid2", "guid3"]
}
```

A resposta continua a mesma, mas a **ordem dos stops** será mais otimizada!

## Monitoramento e Debug

### Logs importantes

- `🚗 ORS Matrix: calculando...` - Início da chamada Matrix API
- `✅ ORS Matrix: matriz NxN calculada` - Sucesso
- `🚗 Tempo [A→B]: X.X min` - Tempos individuais (primeiros 3)
- `⚠️ ORS Matrix API falhou` - Fallback ativado
- `🚗 pick next=... X.X min` - Usando Matrix API
- `🚗 pick next=... X.X km` - Usando Haversine

### Métricas para monitorar

1. **Taxa de sucesso Matrix API** (quantos % usam Matrix vs Haversine)
2. **Tempo médio de resposta** da Matrix API
3. **Rate limit hits** (HTTP 429)
4. **Diferença média** entre Haversine e Matrix (tempo total de rota)

## Próximos Passos (Melhorias Futuras)

1. **Cache de matrizes** - Guardar resultados para mesmas coordenadas
2. **Traffic data** - Upgrade para plano pago (considera tráfego em tempo real)
3. **Otimização avançada** - TSP solver ao invés de greedy
4. **Métricas de qualidade** - Comparar tempo estimado vs real de entrega

## Troubleshooting

| Problema | Causa Provável | Solução |
|----------|----------------|---------|
| Sempre usa Haversine | API Key não configurada | Configure `Geocoding:Ors:ApiKey` |
| HTTP 429 | Rate limit atingido | Espere 1 min ou use plano pago |
| Timeout frequente | Muitos pedidos (>20) | Reduza batch size ou aumente timeout |
| Matriz inválida | Coordenadas fora do RJ | Verifique validação de geocoding |

## Suporte

Para problemas com a Matrix API:
1. Verifique logs (procure por 🚗)
2. Teste manualmente: https://openrouteservice.org/dev/#/api-docs/v2/matrix/{profile}/post
3. Valide API Key: https://openrouteservice.org/dev/#/home

---

**Implementado em:** 2026-02-15
**Arquitetura:** Matrix API com fallback Haversine automático
**Compatibilidade:** Totalmente retrocompatível (endpoints não mudam)
