# 📚 AULA: Como Usar Enum e Tipos em C# - Padrão Commerce

> **Data:** 28 de janeiro de 2026  
> **Nível:** Junior → Senior  
> **Objetivo:** Entender o padrão correto de usar Enums, Strings e Tipos em APIs

---

## 🔴 Os 3 Erros que Encontramos

### **ERRO 1: Usar `=` (atribuição) em vez de `==` (comparação)**

```csharp
// ❌ ERRADO - Linha 140 do OrdersController.cs
if (order.PaymentMethod = PaymentMethod.CASH)
     //                  ↑ ATRIBUIÇÃO (coloca valor)
{
    // ...
}

// ✅ CERTO
if (order.PaymentMethod == "CASH")
     //                  ↑↑ COMPARAÇÃO (verifica se é igual)
{
    // ...
}
```

**Por que é erro?**
- `=` tenta **atribuir** um valor
- `==` tenta **comparar** dois valores
- C# reclama porque você está tentando colocar um Enum em um String

---

### **ERRO 2: String sem valor padrão**

```csharp
// ❌ ERRADO - CreateOrderRequest.cs
public string PaymentMethod { get; init; }
// Erro: "Propriedade não anulável precisa conter um valor não nulo"

// ✅ CERTO
public string PaymentMethod { get; init; } = "PIX";
//                                            ↑ Valor padrão obrigatório!
```

**Por que é erro?**
- C# em modo `#nullable enable` exige valores padrão
- Se você não fornece um valor, a propriedade fica "nula" e causa erro

---

### **ERRO 3: Tipos Inconsistentes (String vs Enum)**

```csharp
// ❌ ERRADO - Mixing String and Enum
public class CreateOrderRequest
{
    public string PaymentMethod { get; init; }  // ← String
}

public class GetOrderResponse
{
    public PaymentMethod PaymentMethod { get; init; }  // ← Enum!
    // Conflito: Um é String, outro é Enum
}

// ✅ CERTO - Usar String em ambos
public class CreateOrderRequest
{
    public string PaymentMethodStr { get; init; } = "PIX";
}

public class GetOrderResponse
{
    public string PaymentMethodStr { get; init; } = "";
}
```

**Por que é erro?**
- Seu frontend envia JSON com String `"PIX"`
- Você não pode converter implicitamente String → Enum sem fazer `Enum.Parse()`
- É melhor manter como String nos contratos (JSON) e internamente no banco

---

## ✅ A Solução: Padrão Commerce-Grade

### **1️⃣ Usar STRING nos Contratos (JSON)**

```csharp
// Recebe do frontend
public class CreateOrderRequest
{
    public string PaymentMethodStr { get; init; } = "PIX";  // ← String com padrão
    public int? CashGivenCents { get; init; }  // Opcional
    public string? Coupon { get; init; }  // Opcional
}

// Retorna para frontend
public class GetOrderResponse
{
    public string PaymentMethodStr { get; init; } = "";  // ← String
}
```

### **2️⃣ Usar STRING no Banco (Entity)**

```csharp
// Armazena no banco
public class Order
{
    public string PaymentMethod { get; set; } = "PIX";  // ← String
    public int SubtotalCents { get; set; }
    public int DeliveryCents { get; set; }
    public int TotalCents { get; set; }
}
```

### **3️⃣ Usar ENUM Internamente (se precisar validar)**

```csharp
// Enum para validação
public enum PaymentMethod
{
    PIX = 1,
    CASH = 2,
    CARD = 3
}
```

### **4️⃣ Converter String → Enum quando necessário**

```csharp
// Se você PRECISA comparar com Enum
if (Enum.TryParse<PaymentMethod>(req.PaymentMethodStr, out var paymentEnum))
{
    if (paymentEnum == PaymentMethod.CASH)
    {
        // Lógica especial para CASH
        if (!req.CashGivenCents.HasValue)
            return BadRequest("Valor em dinheiro obrigatório.");
    }
}
else
{
    return BadRequest("Método de pagamento inválido.");
}
```

---

## 📋 Checklist: Como Não Repetir os Erros

### **Ao receber dados do Frontend (Contrato)**

- [ ] Usar `string` para enums (JSON não tem enum nativo)
- [ ] **Sempre** adicionar valor padrão `= ""` ou `= "PIX"`
- [ ] Usar nomes descritivos como `PaymentMethodStr` para evitar confusão

### **Ao comparar valores**

- [ ] Usar `==` para comparação (`if (x == y)`)
- [ ] Usar `=` apenas para atribuição (`x = y;`)
- [ ] Nunca fazer `if (x = y)` — isso é assignment, não comparison!

### **Ao trabalhar com Tipos**

- [ ] Manter **consistência** entre CreateOrderRequest, GetOrderResponse, e GetOrderResponse
- [ ] Se é string em um, deve ser string em todos
- [ ] Não misturar Enum com String sem conversão explícita

### **Valores Padrão**

- [ ] `string` obrigatória → `= ""`
- [ ] `int` obrigatório → sem padrão (já é 0 por padrão)
- [ ] `nullable` → `?` no tipo (`string?`, `int?`)

---

## 🎯 Exemplo Completo: Fluxo Correto

```csharp
// 1️⃣ Frontend envia JSON
{
  "name": "Mayk",
  "paymentMethod": "PIX",
  "items": [...]
}

// 2️⃣ Backend recebe em CreateOrderRequest (String)
public class CreateOrderRequest
{
    public string PaymentMethodStr { get; init; } = "PIX";
}

// 3️⃣ Backend converte para Enum se precisar validar
if (Enum.TryParse<PaymentMethod>(req.PaymentMethodStr, out var payment))
{
    if (payment == PaymentMethod.CASH)
    {
        // Lógica especial
    }
}

// 4️⃣ Backend armazena como String no banco (Order)
order.PaymentMethod = req.PaymentMethodStr;  // ← String no banco
await _db.SaveChangesAsync();

// 5️⃣ Backend retorna em GetOrderResponse (String)
return Ok(new GetOrderResponse
{
    PaymentMethodStr = order.PaymentMethod,  // ← String
});

// 6️⃣ Frontend recebe como String no JSON
{
  "id": "...",
  "paymentMethodStr": "PIX"
}
```

---

## 📚 Diferenças: String vs Enum vs int?

| Caso | Tipo | Exemplo | Quando Usar |
|------|------|---------|------------|
| Valores fixos (PIX, CASH, CARD) | `enum` | `enum PaymentMethod { PIX, CASH }` | Validação interna, tipo-safe |
| Recebe/envia JSON | `string` | `"PIX"` | Contratos (Request/Response) |
| Opcional e pode ser nulo | `string?` ou `int?` | `public string? Coupon` | Cupom, comentário, etc |
| Obrigatório, sem nulo | `string` com valor padrão | `= "PIX"` | Email, nome, etc |
| Sem valor padrão (int) | `int` | `public int Qty` | Já é 0 por padrão em C# |

---

## 🚨 Erros Comuns que Junior faz:

```csharp
// ❌ ERRO 1: Misturar tipos
public class Response
{
    public string PaymentMethod { get; init; }  // String
}
public class Order
{
    public PaymentMethod PaymentMethod { get; set; }  // Enum
    // Conflito na atribuição!
}

// ❌ ERRO 2: Atribuição em if
if (order.PaymentMethod = "CASH")  // ← Isso é assignment!
if (payment = PaymentMethod.CASH)  // ← Isso também!

// ❌ ERRO 3: Sem valor padrão
public string Name { get; init; }  // ❌ Erro de compilação
public string Name { get; init; } = "";  // ✅ Correto

// ❌ ERRO 4: Comparar String com Enum
if (order.PaymentMethod == PaymentMethod.CASH)  // ❌ Tipos diferentes!
if (order.PaymentMethod == "CASH")  // ✅ Correto
```

---

## 🎓 Padrão que Usamos no Petshop

### **CreateOrderRequest (recebe do frontend)**
```csharp
public string PaymentMethodStr { get; init; } = "PIX";
public int? CashGivenCents { get; init; }
public string? Coupon { get; init; }
```

### **Order (armazena no banco)**
```csharp
public string PaymentMethod { get; set; } = "PIX";
public int SubtotalCents { get; set; }
public int DeliveryCents { get; set; }
public int TotalCents { get; set; }
```

### **GetOrderResponse (retorna para frontend)**
```csharp
public string PaymentMethodStr { get; init; } = "";
public int SubtotalCents { get; init; }
public int DeliveryCents { get; init; }
public int TotalCents { get; init; }
```

**Razão:** Simplicidade + Segurança + Consistência

---

## ✨ Resumo em 5 Pontos

1. **Use `==` para comparar, `=` para atribuir**
2. **Sempre adicione valor padrão em string obrigatória: `= ""`**
3. **Mantenha tipos consistentes entre Request, Entity e Response**
4. **Use `string` nos contratos (JSON) e internamente**
5. **Use `enum` apenas para validação interna com `Enum.TryParse()`**

---

**Salve este arquivo na memória e consuma sempre que precisar trabalhar com tipos em C#!** 🚀
