# 🧪 Guia de Testes - Sistema de Geocoding

Este guia vai te ajudar a testar o sistema completo de geocoding e roteamento inteligente.

## 📋 Pré-requisitos

1. ✅ PostgreSQL rodando
2. ✅ Banco `petshop_db` criado
3. ✅ Backend ASP.NET rodando
4. ✅ Ferramenta para testes HTTP (VS Code + REST Client Extension OU Postman OU Insomnia)

---

## 🚀 Passo 1: Setup Inicial

### 1.1 Execute o script SQL de setup

```bash
# No terminal, conecte ao PostgreSQL
psql -U petshop -d petshop_db -f backend/tests/setup-test-data.sql
```

Ou copie e cole o conteúdo de `setup-test-data.sql` no pgAdmin.

**O que esse script faz:**
- ✅ Cria produto de teste (Ração Premium)
- ✅ Cria entregador de teste (Carlos Delivery)
- ✅ Fornece queries úteis para debug

### 1.2 Rode o backend

```bash
cd backend/Petshop.Api
dotnet run
```

**URL esperada:** `http://localhost:5082` (ou a porta configurada)

---

## 🧪 Passo 2: Execute os Testes HTTP

Abra o arquivo `geocoding-test.http` no VS Code (com REST Client extension instalada).

### 2.1 Login Admin

Execute a primeira request:

```http
POST http://localhost:5082/auth/login
{
  "username": "admin",
  "password": "admin123"
}
```

**Copie o `token` retornado** e cole na variável `@token` no topo do arquivo.

---

### 2.2 Criar Pedidos com Endereços Reais do RJ

Execute as 5 requests de criação de pedidos (PASSO 3 do arquivo HTTP).

**Endereços que serão testados:**
1. 📍 Copacabana - Av. Atlântica 1702 (CEP: 22070-001)
2. 📍 Ipanema - Rua Vinícius de Moraes 129 (CEP: 22411-010)
3. 📍 Botafogo - Praia de Botafogo 300 (CEP: 22250-040)
4. 📍 Centro - Praça Pio X (CEP: 20091-000)
5. 📍 Leblon - Rua Dias Ferreira 214 (CEP: 22431-050)

**Anote os `PublicId` retornados** (ex: `PS-20260215-123456`)

---

### 2.3 Mudar Status para PRONTO_PARA_ENTREGA

**✨ AQUI É ONDE A MÁGICA ACONTECE!**

Substitua `PS-XXXXXX` pelos PublicIds reais e execute as 5 requests do PASSO 5.

```http
POST http://localhost:5082/orders/PS-20260215-123456/status
{
  "status": "PRONTO_PARA_ENTREGA"
}
```

---

## 👀 Passo 3: OBSERVE OS LOGS!

No console do backend, você deve ver:

```
📍 GEOCODING START | Pedido=PS-20260215-123456 | Provider=ORS | HasAddress=True | HasCep=True | CepValid=True
🌍 GEOCODING CALL | Pedido=PS-20260215-123456 | Query="Avenida Atlântica 1702, 22070-001, Rio de Janeiro, RJ, Brasil"
✅ GEOCODING SUCCESS | Pedido=PS-20260215-123456 | Lat=-22.970000 | Lon=-43.180000 | Provider=ORS
```

### ✅ O que esperar se DEU CERTO:

- `📍 GEOCODING START` com `HasAddress=True`, `HasCep=True`, `CepValid=True`
- `🌍 GEOCODING CALL` com a query completa
- `✅ GEOCODING SUCCESS` com Lat/Lon dentro do Rio (~-22.9 a -23.0, ~-43.1 a -43.3)

### ❌ O que procurar se DEU ERRADO:

**Endereço/CEP inválido:**
```
⚠️ GEOCODING SKIPPED | Motivo: Endereço ou CEP ausente
```
ou
```
⚠️ GEOCODING SKIPPED | Motivo: CEP inválido (esperado 8 dígitos)
```

**API não encontrou o endereço:**
```
❌ GEOCODING NOT_FOUND | API retornou null
```

**Erro na API:**
```
🔥 GEOCODING ERROR | Exception: ...
```

---

## 🔧 Passo 4: Reprocessar Geocoding (se necessário)

Se algum pedido não foi geocodificado corretamente:

### Reprocessar um pedido específico:

```http
POST http://localhost:5082/orders/PS-20260215-123456/reprocess-geocoding?force=true
```

### Reprocessar TODOS os pedidos sem coords:

```http
POST http://localhost:5082/orders/geocode-missing?limit=50
```

**Resposta esperada:**
```json
{
  "total": 5,
  "updated": 5,
  "notFound": 0,
  "errors": 0,
  "provider": "ORS"
}
```

---

## 🗺️ Passo 5: Criar Rota Inteligente

### 5.1 Pegar os GUIDs dos pedidos

No PostgreSQL ou via API, pegue os GUIDs (não os PublicIds):

```sql
SELECT "Id", "PublicId", "Latitude", "Longitude"
FROM "Orders"
WHERE "Status" = 'PRONTO_PARA_ENTREGA'
  AND "Latitude" IS NOT NULL
ORDER BY "CreatedAtUtc";
```

### 5.2 Criar a rota

```http
POST http://localhost:5082/delivery/routes
{
  "delivererId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "orderIds": [
    "GUID-PEDIDO-1",
    "GUID-PEDIDO-2",
    "GUID-PEDIDO-3",
    "GUID-PEDIDO-4",
    "GUID-PEDIDO-5"
  ]
}
```

---

## 📊 Passo 6: OBSERVE OS LOGS DE ROTEAMENTO!

No console do backend, você deve ver:

```
RouteOptimization: received 5 orders, withCoords=5, withoutCoords=0
RouteOptimization: Order=PS-001 CreatedAtUtc=2026-02-15 14:20:00 Lat=-22.970000 Lon=-43.180000 LooksLikeRio=True
RouteOptimization: Order=PS-002 CreatedAtUtc=2026-02-15 14:21:00 Lat=-22.980000 Lon=-43.190000 LooksLikeRio=True
...
RouteOptimization: START (oldest) = PS-001 (2026-02-15 14:20)
RouteOptimization: pick next=PS-003 from current=PS-001 km=2.50
RouteOptimization: pick next=PS-002 from current=PS-003 km=1.80
RouteOptimization: pick next=PS-005 from current=PS-002 km=3.20
RouteOptimization: pick next=PS-004 from current=PS-005 km=15.40
RouteOptimization: final order => PS-001 -> PS-003 -> PS-002 -> PS-005 -> PS-004
```

### ✅ O que validar:

- ✅ `withCoords=5, withoutCoords=0` → TODOS os pedidos têm coords!
- ✅ `LooksLikeRio=True` → Coords estão dentro do Rio
- ✅ Distâncias entre 1-20 km (pedidos próximos)
- ✅ Ordem greedy faz sentido (não pula de Copacabana pro Centro e volta)

### ⚠️ Red flags:

- ❌ `withoutCoords > 0` → Algum pedido não foi geocodificado
- ❌ `LooksLikeRio=False` → Coords erradas
- ❌ `km > 50` → Salto gigante, possível problema de coords
- ❌ Ordem não faz sentido geográfico

---

## 🎯 Resultados Esperados

### Coordenadas aproximadas (validação manual):

| Endereço | Lat (aprox.) | Lon (aprox.) | Bairro |
|----------|--------------|--------------|--------|
| Av. Atlântica 1702 | -22.97 | -43.18 | Copacabana |
| Vinícius de Moraes 129 | -22.98 | -43.19 | Ipanema |
| Praia de Botafogo 300 | -22.95 | -43.18 | Botafogo |
| Praça Pio X | -22.90 | -43.18 | Centro |
| Dias Ferreira 214 | -22.98 | -43.22 | Leblon |

### Ordem esperada (greedy):

1. **Start:** Pedido mais antigo (ex: PS-001 Centro, criado às 14:20)
2. **Next:** Mais próximo do Centro (provavelmente Botafogo ~5km)
3. **Next:** Mais próximo de Botafogo (provavelmente Copacabana ~3km)
4. **Next:** Mais próximo de Copacabana (provavelmente Ipanema ~2km)
5. **Last:** Leblon (~4km de Ipanema)

**Total da rota:** ~14-20 km (muito eficiente!)

---

## 🐛 Troubleshooting

### Problema: "❌ GEOCODING NOT_FOUND"

**Possíveis causas:**
1. API Key do ORS inválida ou expirada
2. Endereço não existe ou está mal formatado
3. API do ORS está fora do ar

**Solução:**
1. Verifique `appsettings.Development.json` → `Geocoding:Ors:ApiKey`
2. Teste manualmente a API: `https://api.openrouteservice.org/geocode/search?api_key=SUA_KEY&text=Av+Atlantica+1702+Rio+de+Janeiro`
3. Tente reprocessar: `POST /orders/{id}/reprocess-geocoding?force=true`

---

### Problema: "🔥 GEOCODING ERROR"

**Possíveis causas:**
1. Timeout da API (rede lenta)
2. Rate limit atingido (muitas chamadas seguidas)
3. Erro de parsing do JSON

**Solução:**
1. Verifique os logs completos da exception
2. Aumente o timeout em `appsettings.json`: `"TimeoutSeconds": 15`
3. Use reprocessamento em batch com delay: `POST /orders/geocode-missing?limit=10`

---

### Problema: "⚠️ Distância MUITO GRANDE (2500 km)"

**Causa:** Coordenadas geocodificadas fora do Brasil ou com erro.

**Solução:**
1. Verifique as coords no banco:
   ```sql
   SELECT "PublicId", "Latitude", "Longitude", "Address", "Cep"
   FROM "Orders"
   WHERE "PublicId" = 'PS-XXXXXX';
   ```
2. Se lat/lon estiverem fora do RJ (-23.2 a -22.6, -44.1 a -43.0):
   - Verifique se o CEP está correto
   - Reprocesse com `?force=true`

---

### Problema: "RouteOptimization: withoutCoords=3"

**Causa:** Pedidos não foram geocodificados ao mudar status.

**Solução:**
1. Verifique se os pedidos têm Address e Cep válidos
2. Use reprocessamento em batch:
   ```http
   POST http://localhost:5082/orders/geocode-missing?limit=50
   ```

---

## 📝 Checklist Final

- [ ] Backend rodando e logs visíveis
- [ ] 5 pedidos criados com endereços reais do RJ
- [ ] Todos os 5 pedidos mudaram para `PRONTO_PARA_ENTREGA`
- [ ] Logs mostram `✅ GEOCODING SUCCESS` para todos
- [ ] Verificar no banco: todos têm `Latitude` e `Longitude` != null
- [ ] Rota criada com sucesso
- [ ] Logs mostram ordem greedy inteligente
- [ ] Distâncias entre pedidos fazem sentido (1-20 km)
- [ ] Nenhum warning de outliers ou distâncias grandes

---

## 🎉 Sucesso!

Se você chegou até aqui e todos os checks passaram, parabéns! 🎊

Seu sistema de geocoding e roteamento inteligente está **100% funcional**!

Agora você tem:
- ✅ Geocoding automático ao marcar pedidos como prontos
- ✅ Validação robusta de endereços
- ✅ Logs detalhados para debugging
- ✅ Endpoints de reprocessamento
- ✅ Roteamento greedy inteligente
- ✅ Detecção automática de anomalias

**Próximos passos:**
- Integrar com o frontend React
- Adicionar mapa visual das rotas
- Implementar atualização em tempo real via SignalR
- Otimização avançada com ORS Directions API

---

**Dúvidas?** Verifique os logs! Eles foram feitos para te contar EXATAMENTE o que está acontecendo. 🔍
