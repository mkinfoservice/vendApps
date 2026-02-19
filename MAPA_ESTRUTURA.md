# Mapa de Estrutura de Pastas

Este mapa mostra a estrutura principal de `backend` e `frontend`.

Observacoes:
- Pastas geradas foram omitidas para legibilidade (`bin`, `obj`, `node_modules`, `dist`).

## Backend

```text
backend/
|-- Petshop.Api/
|   |-- appsettings.Development.json
|   |-- appsettings.json
|   |-- Petshop.Api.csproj
|   |-- Petshop.Api.http
|   |-- Program.cs
|   |-- Contracts/
|   |   |-- Auth/
|   |   |   |-- AdminLoginRequest.cs
|   |   |   `-- AdminLoginResponse.cs
|   |   |-- Delivery/
|   |   |   |-- CancelRouteRequest.cs
|   |   |   |-- CreateDelivererRequest.cs
|   |   |   |-- CreateRouteRequest.cs
|   |   |   |-- CreateRouteResponse.cs
|   |   |   |-- DelivererListItem.cs
|   |   |   |-- DelivererResponse.cs
|   |   |   |-- FailRouteStopRequest.cs
|   |   |   |-- ListDeliverersResponse.cs
|   |   |   |-- SkipRouteStopRequest.cs
|   |   |   |-- UpdateDelivererRequest.cs
|   |   |   `-- Routes/
|   |   |-- Orders/
|   |   |   |-- CreateOrderRequest.cs
|   |   |   |-- CreateOrderResponse.cs
|   |   |   |-- GetOrderResponse.cs
|   |   |   |-- ListOrdersResponse.cs
|   |   |   |-- ListReadyOrderResponse.cs
|   |   |   |-- OrderListItemResponse.cs
|   |   |   |-- ReadyOrderItemResponse.cs
|   |   |   |-- UpdateOrderStatusRequest.cs
|   |   |   `-- UpdateOrderStatusResponse.cs
|   |-- Controllers/
|   |   |-- AuthController.cs
|   |   |-- CatalogController.cs
|   |   |-- DeliverersController.cs
|   |   |-- OrdersController.cs
|   |   `-- RoutesController.cs
|   |-- Data/
|   |   |-- AppDbContext.cs
|   |   `-- DbSeeder.cs
|   |-- Entities/
|   |   |-- Order.cs
|   |   |-- OrderItem.cs
|   |   |-- OrderStatus.cs
|   |   |-- PaymentMethod.cs
|   |   `-- Delivery/
|   |       |-- Deliverer.cs
|   |       |-- Route.cs
|   |       |-- RouteStatus.cs
|   |       |-- RouteStop.cs
|   |       `-- RouteStopStatus.cs
|   |-- Migrations/
|   |   |-- 20260115134016_InitialCatalog.cs
|   |   |-- 20260127200003_Orders.cs
|   |   |-- 20260127232237_AddUniqueIndexToOrderPublicId.cs
|   |   |-- 20260128222153_AddCashGivenAndChangeCents.cs
|   |   |-- 20260128222203_AddCashAndChange.cs
|   |   |-- 20260130184556_AddOrderComplement.cs
|   |   |-- 20260203232028_AddUpdatedAtUtc.cs
|   |   |-- 20260212201315_AddDeliverySystem.cs
|   |   |-- 20260212224529_AddDelivererVehicle.cs
|   |   |-- 20260215003744_AddOrderGeocodingFields.cs
|   |   `-- AppDbContextModelSnapshot.cs
|   |-- Models/
|   |   |-- Category.cs
|   |   `-- Products.cs
|   |-- Properties/
|   |   `-- launchSettings.json
|   `-- Services/
|       |-- DeliveryManagementService.cs
|       |-- OrderIdGenerator.cs
|       |-- RouteOptimizationService.cs
|       `-- Geocoding/
|           |-- NominatimGeocodingService.cs
|           `-- OrsGeocodingService.cs
`-- tests/
    `-- orders.http
```

## Frontend

```text
frontend/
`-- petshop-web/
    |-- .env.local
    |-- .gitignore
    |-- devserver.log
    |-- eslint.config.js
    |-- index.html
    |-- package-lock.json
    |-- package.json
    |-- postcss.config.js
    |-- README.md
    |-- tailwind.config.js
    |-- tsconfig.app.json
    |-- tsconfig.json
    |-- tsconfig.node.json
    |-- vite.config.ts
    |-- public/
    |   |-- hero.png
    |   `-- vite.svg
    `-- src/
        |-- App.css
        |-- App.tsx
        |-- index.css
        |-- main.tsx
        |-- routes.tsx
        |-- assets/
        |   `-- react.svg
        |-- components/
        |   |-- HeroMarket.tsx
        |   |-- TopBar.tsx
        |   |-- admin/
        |   |   `-- AdminNav.tsx
        |   `-- ui/
        |       |-- badge.tsx
        |       |-- button.tsx
        |       |-- input.tsx
        |       |-- separator.tsx
        |       `-- sheet.tsx
        |-- features/
        |   |-- admin/
        |   |   |-- auth/
        |   |   |-- orders/
        |   |   |   `-- components/
        |   |   `-- routes/
        |   |-- cart/
        |   |   |-- cart.tsx
        |   |   `-- CartSheet.tsx
        |   |-- catalog/
        |   |   |-- api.ts
        |   |   |-- CategoryTile.tsx
        |   |   |-- ProductCard.tsx
        |   |   |-- ProductRow.tsx
        |   |   `-- queries.ts
        |   |-- orders/
        |   |   `-- api.ts
        |   `-- shipping/
        |       `-- viacep.ts
        |-- lib/
        |   |-- api.ts
        |   `-- utils.ts
        `-- pages/
            |-- Checkout.tsx
            `-- admin/
                |-- Login.tsx
                |-- OrderDetail.tsx
                |-- OrdersList.tsx
                |-- RouteDetail.tsx
                |-- RoutePlanner.tsx
                `-- RoutesList.tsx
```
