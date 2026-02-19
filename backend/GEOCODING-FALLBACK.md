# Sistema de Geocoding com Fallback Automático

## Visão Geral

Sistema robusto de geocoding que garante máxima taxa de sucesso ao tentar **dois provedores diferentes automaticamente**:

1. **ORS (OpenRouteService)** - Mais preciso para Rio de Janeiro (tentativa primária)
2. **Nominatim (OpenStreetMap)** - Backup gratuito (tentativa secundária)

## Como Funciona

```
┌─────────────────────────────────────────┐
│  FallbackGeocodingService               │
│                                         │
│  1. Tenta ORS (preciso para RJ)        │
│     ├─ ✅ Sucesso? Retorna coordenadas │
│     └─ ❌ Falhou? Vai para passo 2     │
│                                         │
│  2. Tenta Nominatim (backup OSM)       │
│     ├─ ✅ Sucesso? Retorna coordenadas │
│     └─ ❌ Falhou? Retorna null         │
└─────────────────────────────────────────┘
```

## Arquivos Implementados

### 1. **FallbackGeocodingService.cs** (NOVO)
Serviço orquestrador que tenta ORS primeiro e Nominatim em seguida.

**Localização:** `Petshop.Api/Services/Geocoding/FallbackGeocodingService.cs`

**Características:**
- ✅ Logs detalhados com emojis para facilitar debug
- ✅ Try/catch em cada tentativa (não quebra se um serviço falhar)
- ✅ Retorna null apenas se AMBOS falharem
- ✅ Indica qual serviço encontrou as coordenadas

### 2. **NominatimGeocodingService.cs** (ATUALIZADO)
Serviço de backup usando OpenStreetMap.

**Melhorias implementadas:**
- ✅ Validação de coordenadas no Rio de Janeiro (bounds RJ)
- ✅ Filtro por país (countrycodes=br)
- ✅ Logs detalhados similares ao ORS
- ✅ Busca top 5 resultados e valida cada um
- ✅ Rejeita coordenadas fora do estado RJ

### 3. **Program.cs** (ATUALIZADO)
Configuração de injeção de dependência.

**Mudanças:**
```csharp
// ❌ ANTES: Escolhia UM ou OUTRO baseado em config
builder.Services.AddScoped<IGeocodingService>(sp =>
{
    var provider = config["Geocoding:Provider"];
    if (provider == "ORS") return OrsGeocodingService;
    return NominatimGeocodingService;
});

// ✅ AGORA: Usa AMBOS automaticamente (fallback)
builder.Services.AddScoped<IGeocodingService, FallbackGeocodingService>();
```

## Validações de Região

Ambos os serviços validam se as coordenadas estão no **Estado do Rio de Janeiro**:

```csharp
// Bounds do estado RJ
Latitude:  -23.4 a -20.7
Longitude: -44.9 a -40.9
```

Se a coordenada estiver fora desses limites, ela é **rejeitada** e o próximo resultado é testado.

## Logs de Debug

Os logs seguem um padrão de emojis para facilitar a identificação:

- **📍** - Início de geocoding
- **🌍** - Chamada para API externa
- **✅** - Sucesso (coordenadas encontradas)
- **⚠️** - Warning (sem resultados, mas não é erro crítico)
- **❌** - Erro (exceção ou falha total)
- **🔥** - Ambos os serviços falharam

### Exemplo de Log de Sucesso (ORS)

```
📍 FallbackGeocoding: iniciando para 'Rua das Flores, 123, Rio de Janeiro'
🌍 Tentativa 1/2: chamando ORS...
✅ FallbackGeocoding: ORS encontrou coordenadas! Lat=-22.906847, Lon=-43.172896
```

### Exemplo de Log de Fallback (ORS falhou, Nominatim sucesso)

```
📍 FallbackGeocoding: iniciando para 'Av. Atlântica, 1000'
🌍 Tentativa 1/2: chamando ORS...
⚠️ ORS não encontrou coordenadas para 'Av. Atlântica, 1000', tentando fallback...
🌍 Tentativa 2/2: chamando Nominatim (OSM)...
✅ FallbackGeocoding: Nominatim (backup) encontrou coordenadas! Lat=-22.971177, Lon=-43.186656
```

### Exemplo de Log de Falha Total

```
📍 FallbackGeocoding: iniciando para 'Endereço Inexistente XYZ'
🌍 Tentativa 1/2: chamando ORS...
⚠️ ORS não encontrou coordenadas para 'Endereço Inexistente XYZ', tentando fallback...
🌍 Tentativa 2/2: chamando Nominatim (OSM)...
⚠️ Nominatim também não encontrou coordenadas para 'Endereço Inexistente XYZ'
🔥 FallbackGeocoding: AMBOS os serviços falharam. Coordenadas não disponíveis.
```

## Benefícios

1. **Maior taxa de sucesso**: Se ORS falhar, Nominatim tenta automaticamente
2. **Sem mudança de API**: O `OrdersController` continua usando `IGeocodingService` normalmente
3. **Transparente**: O sistema de fallback é invisível para o resto da aplicação
4. **Logs detalhados**: Fácil identificar qual serviço encontrou as coordenadas
5. **Validação rigorosa**: Ambos validam se as coordenadas estão no RJ

## Configuração (appsettings.json)

```json
{
  "Geocoding": {
    "Ors": {
      "ApiKey": "SUA_API_KEY_AQUI"
    }
  }
}
```

**Nota:** Nominatim não precisa de API Key (é gratuito e ilimitado para uso moderado).

## Endpoints que Usam Geocoding

Os seguintes endpoints se beneficiam automaticamente do fallback:

1. **POST /api/orders** - Geocoding automático ao criar pedido
2. **POST /api/orders/{id}/reprocess-geocoding?force=true** - Reprocessar individual
3. **POST /api/orders/geocode-missing?limit=50** - Reprocessar em lote

## Quando Fallback Acontece

O Nominatim será chamado quando:

- ✅ ORS retornar HTTP error (500, 429, timeout)
- ✅ ORS não encontrar resultados
- ✅ ORS encontrar apenas coordenadas fora do RJ
- ✅ ORS lançar exceção (network error, etc.)

## Rate Limits

| Serviço   | Rate Limit              | Custo     |
|-----------|-------------------------|-----------|
| ORS       | 40 req/min (free tier)  | Gratuito* |
| Nominatim | ~1 req/s (gentil)       | Gratuito  |

*ORS tem plano gratuito limitado. Considere upgrade se volume aumentar.

## Próximos Passos

Se mesmo com fallback houver endereços sem coordenadas:

1. **Revisar logs** para identificar padrão de falhas
2. **Validar formato** dos endereços (CEP, vírgulas, etc.)
3. **Considerar terceiro provedor** (Google Maps Geocoding API - pago mas muito preciso)
4. **Normalização de endereços** antes de geocodificar

## Teste Manual

Para testar o fallback, temporariamente:

1. Remova a API Key do ORS no `appsettings.json`
2. Crie um pedido novo
3. Verifique os logs - deve mostrar ORS falhando e Nominatim sucedendo

## Suporte

Em caso de problemas:
1. Verificar logs da aplicação (procure pelos emojis 📍 🌍 ✅ ❌ 🔥)
2. Validar se API Key do ORS está configurada
3. Testar manualmente os endereços nos sites dos provedores:
   - ORS: https://openrouteservice.org/dev/#/api-docs/geocode/search/get
   - Nominatim: https://nominatim.openstreetmap.org/

---

**Implementado em:** 2026-02-15
**Arquitetura:** Fallback automático com validação rigorosa RJ
