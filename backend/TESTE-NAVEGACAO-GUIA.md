# Guia Completo de Testes - Navegação Waze & Google Maps

## 🎯 Objetivo

Testar se os links de deep linking para Waze e Google Maps estão funcionando corretamente, abrindo os apps com a rota completa.

---

## 🖥️ TESTE 1: Google Maps no Browser (PC)

✅ **Funciona perfeitamente no browser do computador!**

### Passos:

1. **Crie uma rota** com alguns pedidos que tenham coordenadas
   ```http
   POST http://localhost:5082/routes
   Content-Type: application/json

   {
     "delivererId": "seu-deliverer-guid",
     "orderIds": ["order-guid-1", "order-guid-2", "order-guid-3"]
   }
   ```

2. **Pegue o ID da rota** criada (na resposta do POST)

3. **Chame o endpoint de navegação:**
   ```http
   GET http://localhost:5082/routes/{routeId}/navigation
   ```

4. **Na resposta, copie o campo `googleMapsWebLink`:**
   ```json
   {
     "routeNumber": "RT-20260215-123",
     "googleMapsWebLink": "https://www.google.com/maps/dir/-22.87,-43.46/-22.88,-43.43/...",
     ...
   }
   ```

5. **Cole no browser** → Deve abrir o Google Maps Web com a rota completa!

### ✅ Resultado Esperado:
- Google Maps web abre com **todos os waypoints** (paradas)
- Você vê a rota completa do ponto A ao Z
- Pode clicar em "Iniciar" para navegar

---

## 📱 TESTE 2: Waze & Google Maps no Celular (QR Code)

✅ **Método mais fácil para testar no celular!**

### Passos:

1. **Crie uma rota** (mesmos passos do teste anterior)

2. **Chame o novo endpoint de QR Code:**
   ```http
   GET http://localhost:5082/routes/{routeId}/navigation/qr
   ```

3. **Abra este endpoint no browser do PC** (vai aparecer JSON com URLs de QR codes)

4. **Copie as URLs dos QR Codes e abra em uma nova aba:**

   **Para Waze:**
   ```
   https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=waze://...
   ```

   **Para Google Maps:**
   ```
   https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://www.google.com/maps/...
   ```

5. **No celular, abra a câmera nativa** (não precisa app de QR Code!)

6. **Aponte para o QR Code na tela do PC**

7. **Clique no link que aparecer** → Deve abrir o app de navegação!

### ✅ Resultado Esperado:

**Waze:**
- Abre o app Waze diretamente
- Mostra a navegação para o **primeiro endereço** da rota
- Já inicia a navegação automaticamente

**Google Maps:**
- Abre o app Google Maps
- Mostra a rota completa com **todos os waypoints**
- Você pode clicar em "Iniciar" para navegar

---

## 📱 TESTE 3: Enviar Link via WhatsApp/Telegram

✅ **Método alternativo se QR Code não funcionar**

### Passos:

1. **Chame o endpoint de navegação:**
   ```http
   GET http://localhost:5082/routes/{routeId}/navigation
   ```

2. **Copie os links da resposta:**
   ```json
   {
     "wazeLink": "waze://?ll=-22.87,-43.46&navigate=yes",
     "googleMapsLink": "https://www.google.com/maps/dir/?api=1&origin=...",
     ...
   }
   ```

3. **Envie para você mesmo** via WhatsApp, Telegram, Email, etc.

4. **No celular, clique no link** → Deve abrir o app!

---

## 📱 TESTE 4: Acessar Backend do Celular (mesma rede Wi-Fi)

✅ **Se o PC e celular estiverem na mesma rede Wi-Fi**

### Passos:

1. **No PC, descubra seu IP local:**

   **Windows:**
   ```bash
   ipconfig
   # Procure por "IPv4" (exemplo: 192.168.1.100)
   ```

   **Mac/Linux:**
   ```bash
   ifconfig
   # Procure pelo IP (exemplo: 192.168.1.100)
   ```

2. **No celular, abra o browser** e acesse:
   ```
   http://192.168.1.100:5082/routes/{routeId}/navigation
   ```
   (Substitua `192.168.1.100` pelo seu IP real)

3. **Copie o link direto** (wazeLink ou googleMapsLink)

4. **Cole no browser do celular** → Deve pedir para abrir o app!

---

## 🧪 Teste Completo - Passo a Passo

### 1. Preparação

```bash
# 1. Certifique-se que o backend está rodando
cd c:/Users/maaaa/OneDrive/Desktop/petshop/backend/Petshop.Api
dotnet run

# 2. Backend deve estar em: http://localhost:5082
```

### 2. Criar Pedidos de Teste

Use o arquivo `geocoding-test.http` para criar 5 pedidos:

```http
### Criar Pedido 1 - Bangu
POST http://localhost:5082/orders
Content-Type: application/json

{
  "name": "Maria Silva",
  "phone": "21987654321",
  "cep": "21810-005",
  "address": "Rua Fonseca 240",
  "complement": "Próximo ao Bangu Shopping",
  "paymentMethodStr": "PIX",
  "items": [
    { "productId": "seu-product-id", "qty": 2 }
  ]
}

# Repita para os outros 4 pedidos (Realengo, Campo Grande, etc.)
```

### 3. Mudar Status para PRONTO_PARA_ENTREGA

```http
POST http://localhost:5082/orders/PS-20260215-XXX/status
Content-Type: application/json

{
  "status": "PRONTO_PARA_ENTREGA"
}

# Faça isso para todos os 5 pedidos
```

### 4. Criar Rota

```http
POST http://localhost:5082/routes
Content-Type: application/json

{
  "delivererId": "seu-deliverer-guid",
  "orderIds": [
    "guid-pedido-1",
    "guid-pedido-2",
    "guid-pedido-3",
    "guid-pedido-4",
    "guid-pedido-5"
  ]
}

# Resposta terá: { "routeId": "..." }
```

### 5. Testar Navegação

```http
# Método 1: QR Code (mais fácil para celular)
GET http://localhost:5082/routes/{routeId}/navigation/qr

# Método 2: Links diretos
GET http://localhost:5082/routes/{routeId}/navigation
```

---

## 📊 Comparação dos Métodos

| Método | Browser PC | Celular | Dificuldade | Melhor para |
|--------|-----------|---------|-------------|-------------|
| **Google Maps Web** | ✅ Funciona | ⚠️ Funciona mas é web | ⭐ Fácil | Testar rápido no PC |
| **QR Code** | ❌ Não | ✅ Perfeito | ⭐⭐ Muito fácil | Testar apps no celular |
| **WhatsApp/Telegram** | ❌ Não | ✅ Perfeito | ⭐⭐ Fácil | Enviar para outros |
| **IP Local** | ❌ Não | ✅ Funciona | ⭐⭐⭐ Médio | Mesma rede Wi-Fi |

---

## ✅ Checklist de Testes

### Google Maps
- [ ] Abre no browser do PC com rota completa
- [ ] Mostra todos os waypoints (paradas)
- [ ] Rota está otimizada (ordem correta)
- [ ] Pode iniciar navegação
- [ ] Abre no app do celular (via QR code)
- [ ] Rota completa aparece no app

### Waze
- [ ] QR Code é gerado corretamente
- [ ] Abre o app Waze no celular
- [ ] Mostra primeiro endereço da rota
- [ ] Navegação inicia automaticamente
- [ ] Endereço está correto

---

## 🐛 Troubleshooting

### "Waze não abre no celular"
**Causa:** App não instalado ou link mal formatado
**Solução:**
1. Instale o Waze no celular
2. Verifique se o link está correto: `waze://?ll=LAT,LON&navigate=yes`
3. Tente abrir o link diretamente no browser do celular

### "Google Maps abre mas sem waypoints"
**Causa:** Pedidos sem coordenadas
**Solução:**
1. Verifique se os pedidos têm `latitude` e `longitude`
2. Chame o endpoint de reprocessamento se necessário
3. Verifique os logs do geocoding

### "QR Code não abre nada"
**Causa:** Câmera não reconhece QR ou link quebrado
**Solução:**
1. Use app dedicado de QR Code (não apenas a câmera)
2. Copie o link manualmente e envie via WhatsApp
3. Verifique se a URL do QR está correta

### "Não consigo acessar do celular (IP local)"
**Causa:** Firewall ou rede diferente
**Solução:**
1. Certifique-se que PC e celular estão na mesma rede Wi-Fi
2. Desabilite firewall temporariamente
3. Use o método QR Code ao invés de IP

---

## 📝 Exemplo de Resposta - QR Code Endpoint

```json
{
  "routeNumber": "RT-20260215-456",
  "totalStops": 5,
  "stopsWithCoordinates": 5,
  "navigation": {
    "waze": {
      "link": "waze://?ll=-22.87,-43.46&navigate=yes",
      "qrCodeUrl": "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=waze%3A%2F%2F...",
      "instructions": "Aponte a câmera do celular para o QR Code para abrir o Waze"
    },
    "googleMaps": {
      "link": "https://www.google.com/maps/dir/?api=1&origin=-22.87,-43.46&destination=...",
      "qrCodeUrl": "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https%3A%2F%2F...",
      "instructions": "Aponte a câmera do celular para abrir o Google Maps"
    }
  },
  "testInstructions": {
    "step1": "Abra este endpoint no browser do PC",
    "step2": "Aponte a câmera do celular para o QR Code (não precisa app de QR, a câmera nativa lê)",
    "step3": "Clique no link que aparecer → deve abrir o app de navegação",
    "alternative": "Ou copie o 'link' e envie para você mesmo via WhatsApp/Telegram"
  }
}
```

---

## 🎯 Resumo Rápido

### Para testar no PC (Google Maps apenas):
1. `GET /routes/{id}/navigation`
2. Copie `googleMapsWebLink`
3. Cole no browser → Pronto!

### Para testar no celular (Waze + Google Maps):
1. `GET /routes/{id}/navigation/qr`
2. Abra as URLs dos QR codes em novas abas
3. Aponte a câmera do celular
4. Clique no link → Abre o app!

**Recomendação:** Use o método **QR Code** - é o mais fácil e funciona 100%! 🎉

---

**Criado em:** 2026-02-15
**Dica:** Salve esta página nos favoritos para consulta rápida!
