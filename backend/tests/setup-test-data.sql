-- ============================================
-- Script de setup para testes de geocoding
-- Execute este script no PostgreSQL antes de rodar os testes HTTP
-- ============================================

-- Conectar ao banco
\c petshop_db

-- ============================================
-- 1. Criar produto de teste (se não existir)
-- ============================================
INSERT INTO "Products" ("Id", "Name", "Description", "PriceCents", "Stock", "IsActive", "ImageUrl", "CreatedAt")
VALUES
  (
    '47e63cc3-7f94-459e-ad6e-2d5461e1bde6'::uuid,
    'Ração Premium para Cães 15kg',
    'Ração de alta qualidade para cães adultos',
    15000, -- R$ 150,00
    100,
    true,
    'https://via.placeholder.com/300x300.png?text=Racao',
    NOW()
  )
ON CONFLICT ("Id") DO NOTHING;

-- ============================================
-- 2. Criar entregador de teste
-- ============================================
INSERT INTO "Deliverers" ("Id", "Name", "Phone", "VehicleType", "IsActive", "CreatedAtUtc")
VALUES
  (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
    'Carlos Delivery',
    '21987654321',
    'Moto',
    true,
    NOW()
  )
ON CONFLICT ("Id") DO NOTHING;

-- ============================================
-- 3. Verificar dados criados
-- ============================================
SELECT 'Produto criado:' as info, * FROM "Products" WHERE "Id" = '47e63cc3-7f94-459e-ad6e-2d5461e1bde6'::uuid;
SELECT 'Entregador criado:' as info, * FROM "Deliverers" WHERE "Id" = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid;

-- ============================================
-- 4. Limpar pedidos antigos de teste (OPCIONAL - use com cuidado!)
-- ============================================
-- DELETE FROM "RouteStops" WHERE "RouteId" IN (SELECT "Id" FROM "Routes" WHERE "RouteNumber" LIKE 'RT-%');
-- DELETE FROM "Routes" WHERE "RouteNumber" LIKE 'RT-%';
-- DELETE FROM "OrderItems" WHERE "OrderId" IN (SELECT "Id" FROM "Orders" WHERE "PublicId" LIKE 'PS-%');
-- DELETE FROM "Orders" WHERE "PublicId" LIKE 'PS-%';

-- ============================================
-- 5. Queries úteis para debug
-- ============================================

-- Ver todos os pedidos com suas coordenadas
SELECT
  "PublicId",
  "CustomerName",
  "Address",
  "Cep",
  "Status",
  "Latitude",
  "Longitude",
  "GeocodedAtUtc",
  "GeocodeProvider",
  "CreatedAtUtc"
FROM "Orders"
ORDER BY "CreatedAtUtc" DESC
LIMIT 20;

-- Ver pedidos SEM coordenadas
SELECT
  "PublicId",
  "CustomerName",
  "Address",
  "Cep",
  "Status",
  "GeocodeProvider"
FROM "Orders"
WHERE "Latitude" IS NULL OR "Longitude" IS NULL
ORDER BY "CreatedAtUtc" DESC;

-- Ver pedidos PRONTOS para entrega COM coordenadas
SELECT
  "PublicId",
  "CustomerName",
  "Address",
  "Latitude",
  "Longitude",
  CASE
    WHEN "Latitude" BETWEEN -23.2 AND -22.6 AND "Longitude" BETWEEN -44.1 AND -43.0
    THEN 'SIM'
    ELSE 'NÃO'
  END as "PareceCoordsRJ"
FROM "Orders"
WHERE "Status" = 'PRONTO_PARA_ENTREGA'
  AND "Latitude" IS NOT NULL
  AND "Longitude" IS NOT NULL
ORDER BY "CreatedAtUtc";

-- Ver rotas criadas com stops
SELECT
  r."RouteNumber",
  r."Status" as "RouteStatus",
  r."TotalStops",
  r."CreatedAtUtc",
  d."Name" as "Deliverer"
FROM "Routes" r
JOIN "Deliverers" d ON r."DelivererId" = d."Id"
ORDER BY r."CreatedAtUtc" DESC
LIMIT 10;

-- Ver detalhes de uma rota específica
-- SELECT
--   rs."Sequence",
--   rs."OrderNumberSnapshot" as "Pedido",
--   rs."Status" as "StopStatus",
--   rs."AddressSnapshot",
--   o."Latitude",
--   o."Longitude"
-- FROM "RouteStops" rs
-- JOIN "Orders" o ON rs."OrderId" = o."Id"
-- WHERE rs."RouteId" = 'GUID_DA_ROTA_AQUI'::uuid
-- ORDER BY rs."Sequence";

-- ============================================
-- GUIDS úteis para copiar:
-- ============================================
-- Produto ID: 47e63cc3-7f94-459e-ad6e-2d5461e1bde6
-- Entregador ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
