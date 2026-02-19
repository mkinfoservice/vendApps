# 🗺️ Integração de Navegação - Waze & Google Maps

## 📋 Visão Geral

Sistema que gera links de deep linking para abrir rotas de entrega diretamente no **Waze** ou **Google Maps**.

---

## 🚀 Endpoint

### **GET /routes/{routeId}/navigation**

Retorna links de navegação para uma rota específica.

**Autenticação:** Requer role `admin`

**Parâmetros:**
- `routeId` (guid): ID da rota

**Resposta:**
```json
{
  "routeNumber": "RT-20260215-001",
  "totalStops": 5,
  "stopsWithCoordinates": 5,
  "wazeLink": "waze://?ll=-22.900479,-43.178152&navigate=yes",
  "googleMapsLink": "https://www.google.com/maps/dir/?api=1&origin=-22.900479,-43.178152&destination=-22.983516,-43.22678&waypoints=-22.944333,-43.182559|-22.966914,-43.179067|-22.983066,-43.202767",
  "googleMapsWebLink": "https://www.google.com/maps/dir&origin=-22.900479,-43.178152&destination=-22.983516,-43.22678&waypoints=-22.944333,-43.182559|-22.966914,-43.179067|-22.983066,-43.202767",
  "stops": [
    {
      "sequence": 1,
      "orderNumber": "PS-20260215-402673",
      "customerName": "Carlos Oliveira",
      "address": "Praça Pio X, CEP: 20091-000",
      "latitude": -22.900479,
      "longitude": -43.178152,
      "hasCoordinates": true
    }
  ],
  "warnings": []
}
```

---

## 📱 Como Funciona

### **Waze Link**
- Formato: `waze://?ll=LAT,LON&navigate=yes`
- Abre o **primeiro stop** com navegação ativada
- **Por quê apenas o primeiro?** O Waze não suporta múltiplos waypoints via deep linking
- Ideal para: Mobile app

**Comportamento:**
1. No mobile: abre o app Waze diretamente
2. No desktop: redireciona para download/web

---

### **Google Maps Link (App)**
- Formato: `https://www.google.com/maps/dir/?api=1&origin=...&destination=...&waypoints=...`
- Abre rota **completa** com todos os stops
- Usa Google Maps Directions API
- Ideal para: Mobile app

**Estrutura:**
- `origin`: Primeiro stop
- `destination`: Último stop
- `waypoints`: Todos os stops intermediários (separados por `|`)

**Limite:** Google Maps suporta até ~25 waypoints

---

### **Google Maps Web Link**
- Mesmo que o anterior, mas sem `?api=1`
- Ideal para: Desktop/Web

---

## 💻 Integração no Frontend (React)

### Exemplo 1: Botões de Navegação

```tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

interface NavigationLinks {
  wazeLink: string;
  googleMapsLink: string;
  googleMapsWebLink: string;
  stopsWithCoordinates: number;
  totalStops: number;
  warnings: string[];
}

function RouteNavigationButtons() {
  const { routeId } = useParams();
  const [links, setLinks] = useState<NavigationLinks | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/routes/${routeId}/navigation`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        setLinks(data);
        setLoading(false);
      });
  }, [routeId]);

  if (loading) return <div>Carregando...</div>;

  if (!links || links.stopsWithCoordinates === 0) {
    return (
      <div className="alert alert-warning">
        ⚠️ Rota não possui coordenadas. Execute o geocoding primeiro.
      </div>
    );
  }

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const openWaze = () => {
    window.location.href = links.wazeLink;
  };

  const openGoogleMaps = () => {
    // Mobile: abre app
    // Desktop: abre web
    window.location.href = isMobile
      ? links.googleMapsLink
      : links.googleMapsWebLink;
  };

  return (
    <div className="flex gap-4">
      <button
        onClick={openWaze}
        className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded"
      >
        <img src="/waze-icon.png" alt="Waze" className="w-5 h-5" />
        Abrir no Waze
      </button>

      <button
        onClick={openGoogleMaps}
        className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded"
      >
        <img src="/gmaps-icon.png" alt="Google Maps" className="w-5 h-5" />
        Abrir no Google Maps
      </button>

      {links.warnings.length > 0 && (
        <div className="text-sm text-yellow-600">
          {links.warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}
    </div>
  );
}

export default RouteNavigationButtons;
```

---

### Exemplo 2: Com React Query

```tsx
import { useQuery } from '@tanstack/react-query';

function useRouteNavigation(routeId: string) {
  return useQuery({
    queryKey: ['route-navigation', routeId],
    queryFn: async () => {
      const res = await fetch(`/routes/${routeId}/navigation`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch navigation links');
      }

      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutos (coordenadas não mudam)
  });
}

// Uso:
function RouteDetail({ routeId }: { routeId: string }) {
  const { data: nav, isLoading, error } = useRouteNavigation(routeId);

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      <h2>Rota {nav.routeNumber}</h2>
      <p>{nav.stopsWithCoordinates} de {nav.totalStops} stops com coordenadas</p>

      <NavigationButtons nav={nav} />
    </div>
  );
}
```

---

## 📱 Integração Mobile (React Native / Flutter)

### React Native

```tsx
import { Linking } from 'react-native';

function openWaze(lat: number, lon: number) {
  const url = `waze://?ll=${lat},${lon}&navigate=yes`;

  Linking.canOpenURL(url).then(supported => {
    if (supported) {
      Linking.openURL(url);
    } else {
      // Fallback: abre app store ou web
      Alert.alert('Waze não instalado', 'Por favor, instale o Waze.');
    }
  });
}

function openGoogleMaps(originLat: number, originLon: number, destLat: number, destLon: number, waypoints: string) {
  const url = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLon}&destination=${destLat},${destLon}&waypoints=${waypoints}`;
  Linking.openURL(url);
}
```

### Flutter

```dart
import 'package:url_launcher/url_launcher.dart';

Future<void> openWaze(double lat, double lon) async {
  final url = Uri.parse('waze://?ll=$lat,$lon&navigate=yes');

  if (await canLaunchUrl(url)) {
    await launchUrl(url, mode: LaunchMode.externalApplication);
  } else {
    // Fallback
    print('Waze não instalado');
  }
}

Future<void> openGoogleMaps(String mapsLink) async {
  final url = Uri.parse(mapsLink);
  await launchUrl(url, mode: LaunchMode.externalApplication);
}
```

---

## 🎨 UI/UX Recomendações

### Onde adicionar os botões?

1. **Tela de Detalhes da Rota** (Admin)
   - Mostrar os 2 botões lado a lado
   - Adicionar badge com número de stops

2. **App do Entregador**
   - Botão grande "Iniciar Navegação"
   - Permitir escolher Waze ou Google Maps (preferência salva)

3. **Lista de Rotas**
   - Botão pequeno "🗺️" ao lado de cada rota

### Estados dos Botões

```tsx
// Rota sem coordenadas
<button disabled className="opacity-50 cursor-not-allowed">
  🗺️ Sem coordenadas
</button>

// Rota pronta
<button className="bg-blue-500 hover:bg-blue-600">
  🗺️ Navegar
</button>

// Loading
<button disabled>
  <Spinner /> Carregando...
</button>
```

---

## ⚠️ Casos Especiais

### 1. Rota sem nenhuma coordenada

**Resposta:**
```json
{
  "stopsWithCoordinates": 0,
  "wazeLink": "",
  "googleMapsLink": "",
  "warnings": ["⚠️ Nenhuma parada possui coordenadas..."]
}
```

**UI:**
```tsx
if (nav.stopsWithCoordinates === 0) {
  return (
    <Alert variant="warning">
      <AlertTriangle />
      <p>Esta rota não possui coordenadas.</p>
      <Button onClick={runGeocoding}>Executar Geocoding</Button>
    </Alert>
  );
}
```

---

### 2. Algumas stops sem coordenadas

**Resposta:**
```json
{
  "stopsWithCoordinates": 3,
  "totalStops": 5,
  "warnings": ["⚠️ 2 parada(s) sem coordenadas serão ignoradas na navegação."]
}
```

**UI:**
```tsx
{nav.warnings.map(warning => (
  <Alert key={warning} variant="info">
    {warning}
  </Alert>
))}
```

---

### 3. Apenas 1 stop

**Comportamento:**
- Waze: abre navegação direta
- Google Maps: abre navegação direta (sem waypoints)

---

## 🧪 Testes

### Teste 1: Rota completa (5 stops)

```bash
GET /routes/{routeId}/navigation

# Espera-se:
# - wazeLink com primeiro stop
# - googleMapsLink com origin, destination e 3 waypoints
# - 0 warnings
```

### Teste 2: Rota sem coordenadas

```bash
# Criar rota com pedidos não geocodificados
GET /routes/{routeId}/navigation

# Espera-se:
# - Links vazios
# - warnings[0] = "Nenhuma parada possui coordenadas..."
```

### Teste 3: Rota parcial

```bash
# Criar rota: 2 stops com coords, 3 sem
GET /routes/{routeId}/navigation

# Espera-se:
# - Links gerados com 2 stops
# - warnings[0] = "3 parada(s) sem coordenadas..."
```

---

## 📊 Métricas Sugeridas

Adicione tracking para entender uso:

```tsx
const trackNavigation = (app: 'waze' | 'googlemaps', routeId: string) => {
  analytics.track('navigation_opened', {
    app,
    routeId,
    timestamp: new Date(),
    stopsCount: links.stopsWithCoordinates
  });
};

const openWaze = () => {
  trackNavigation('waze', routeId);
  window.location.href = links.wazeLink;
};
```

---

## 🔒 Segurança

1. **Autenticação:** Endpoint protegido com JWT + role admin
2. **Rate Limiting:** Considere limitar chamadas (não crítico, mas bom ter)
3. **Validação:** Backend valida que rota existe e pertence ao contexto

---

## 🚀 Melhorias Futuras

1. **Preferência de App**
   - Salvar preferência do usuário (Waze vs Google Maps)
   - Botão único "Navegar" que abre o app preferido

2. **Share Location**
   - Enviar link de navegação por WhatsApp/SMS para o entregador

3. **QR Code**
   - Gerar QR code com link de navegação
   - Entregador escaneia e abre no celular

4. **Estimativas de Tempo**
   - Integrar com Google Maps Distance Matrix API
   - Mostrar tempo estimado de cada trecho

5. **Navegação Passo-a-Passo**
   - Botão "Próximo Stop" que abre apenas a próxima parada
   - Ideal para entregadores que preferem um stop por vez

---

## 📚 Referências

- [Waze Deep Linking](https://developers.google.com/waze/deeplinks)
- [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)
- [React Native Linking](https://reactnative.dev/docs/linking)
- [Flutter URL Launcher](https://pub.dev/packages/url_launcher)

---

## ✅ Checklist de Implementação

### Backend
- [x] Criar DTO `NavigationLinksResponse`
- [x] Criar endpoint `GET /routes/{id}/navigation`
- [x] Implementar geração de links Waze
- [x] Implementar geração de links Google Maps
- [x] Adicionar warnings para stops sem coords
- [x] Testes unitários

### Frontend (TODO)
- [ ] Criar componente `NavigationButtons`
- [ ] Adicionar botões na tela de detalhes da rota
- [ ] Detectar mobile vs desktop
- [ ] Adicionar ícones do Waze e Google Maps
- [ ] Implementar tratamento de erros
- [ ] Adicionar loading states
- [ ] Testes E2E

### Mobile (TODO - se aplicável)
- [ ] Implementar `Linking` (React Native)
- [ ] Verificar apps instalados
- [ ] Fallback para app stores
- [ ] Preferências de navegação

---

**Desenvolvido com ❤️ para Petshop Delivery**
