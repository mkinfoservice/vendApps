# Petshop - Plataforma Fullstack de Pedidos e Gestão

Projeto fullstack para operação de petshop com foco em conversão no checkout, atendimento por WhatsApp e gestão administrativa segura.

## Visão Geral
O sistema conecta loja online e operação interna em um fluxo único:
- Cliente monta carrinho e finaliza pedido com dados de entrega.
- Pedido é criado no backend e enviado para atendimento via WhatsApp.
- Equipe acompanha tudo em painel administrativo protegido por login.

## Destaques do Produto
- Checkout completo com validações e prévia do pedido.
- Consulta de CEP automática (ViaCEP) para agilizar preenchimento.
- Envio de pedido no WhatsApp com número do pedido e resumo financeiro.
- Painel admin com autenticação JWT.
- Gestão de pedidos com listagem, detalhe e atualização de status.
- Segurança de ponta a ponta: frontend protegido + API com autorização por role.

## Funcionalidades Implementadas

### Loja (cliente)
- Catálogo de produtos.
- Carrinho com controle de quantidade e subtotal em tempo real.
- Checkout com:
  - nome, telefone e endereço
  - CEP com preenchimento assistido
  - formas de pagamento (PIX, cartão na entrega, dinheiro)
  - cálculo de troco para pagamento em dinheiro
- Modal de revisão antes da confirmação.
- Criação do pedido no backend antes do disparo para WhatsApp.

### Painel Administrativo
- Login de administrador.
- Rotas protegidas por guard (`/admin/orders` e `/admin/orders/:id`).
- Listagem de pedidos com filtros e busca.
- Visualização detalhada do pedido.
- Atualização de status com regras de transição.

### Backend
- API ASP.NET Core com EF Core e PostgreSQL.
- Endpoint público para criar pedidos.
- Endpoints administrativos protegidos por JWT e role `admin`.
- Emissão de token com claims e expiração.

## Arquitetura
- `frontend/petshop-web`: React + TypeScript + Vite + Tailwind + React Query.
- `backend/Petshop.Api`: ASP.NET Core 8 + EF Core + PostgreSQL.
- Integração via API REST.

## Segurança
- Autenticação via `POST /auth/login`.
- Token JWT assinado e validado no backend.
- Autorização por role: `[Authorize(Roles = "admin")]`.
- Cliente admin envia `Authorization: Bearer <token>` automaticamente.
- Tratamento de sessão inválida com logout automático no frontend (401).

## Endpoints Principais
- `POST /auth/login` - login admin
- `POST /orders` - criação de pedido (cliente)
- `GET /orders` - listagem admin
- `GET /orders/{idOrNumber}` - detalhe admin
- `PATCH /orders/{idOrNumber}/status` - atualização de status admin

## Resultado Atual
- Fluxo de compra funcional.
- Painel de login autenticando corretamente.
- Rotas e endpoints administrativos protegidos.
- Projeto pronto para evolução (pagamento online, notificações, monitoramento e deploy).

## Roadmap sugerido
- Integração de pagamento online.
- Observabilidade (logs estruturados + métricas).
- CI/CD e deploy automatizado.
- Perfis de acesso adicionais (ex: operador).
- Testes automatizados de integração para fluxos críticos.
