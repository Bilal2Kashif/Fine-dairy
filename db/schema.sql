-- ============================================
-- Fine Dairy Management System - PostgreSQL Schema
-- Run this in Neon SQL Editor (or any PostgreSQL client)
-- ============================================

CREATE TABLE IF NOT EXISTS products (
  "ProductID"   SERIAL PRIMARY KEY,
  "ProductName" VARCHAR(100) NOT NULL,
  "Unit"        VARCHAR(20)  NOT NULL DEFAULT 'kg',
  "Category"    VARCHAR(50)  NOT NULL DEFAULT 'Dairy',
  "IsActive"    BOOLEAN      NOT NULL DEFAULT TRUE,
  "CreatedAt"   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  "SupplierID"   SERIAL PRIMARY KEY,
  "SupplierName" VARCHAR(100) NOT NULL,
  "Contact"      VARCHAR(20),
  "Address"      VARCHAR(200),
  "IsActive"     BOOLEAN   NOT NULL DEFAULT TRUE,
  "CreatedAt"    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bakery_entries (
  "BakeryID"   SERIAL PRIMARY KEY,
  "BakeryName" VARCHAR(100) NOT NULL,
  "Contact"    VARCHAR(20),
  "Address"    VARCHAR(200),
  "IsActive"   BOOLEAN   NOT NULL DEFAULT TRUE,
  "CreatedAt"  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_users (
  "UserID"       SERIAL PRIMARY KEY,
  "FullName"     VARCHAR(120) NOT NULL,
  "Phone"        VARCHAR(30)  NOT NULL,
  "Email"        VARCHAR(120) NOT NULL UNIQUE,
  "PasswordHash" VARCHAR(255) NOT NULL,
  "CreatedAt"    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase (
  "PurchaseID"    SERIAL PRIMARY KEY,
  "SupplierID"    INT           NOT NULL REFERENCES suppliers("SupplierID"),
  "ProductID"     INT                    REFERENCES products("ProductID"),
  "Quantity"      NUMERIC(10,2) NOT NULL DEFAULT 0,
  "UnitPrice"     NUMERIC(10,2) NOT NULL DEFAULT 0,
  "TotalAmount"   NUMERIC(10,2) GENERATED ALWAYS AS ("Quantity" * "UnitPrice") STORED,
  "PaidAmount"    NUMERIC(10,2) NOT NULL DEFAULT 0,
  "BalanceAmount" NUMERIC(10,2) GENERATED ALWAYS AS (("Quantity" * "UnitPrice") - "PaidAmount") STORED,
  "PurchaseDate"  DATE          NOT NULL DEFAULT CURRENT_DATE,
  "Notes"         VARCHAR(300),
  "CreatedAt"     TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_inventory (
  "StockID"     SERIAL PRIMARY KEY,
  "ProductID"   INT           NOT NULL UNIQUE REFERENCES products("ProductID"),
  "Quantity"    NUMERIC(10,2) NOT NULL DEFAULT 0,
  "LastUpdated" TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_log (
  "LogID"      SERIAL PRIMARY KEY,
  "ProductID"  INT           NOT NULL REFERENCES products("ProductID"),
  "ChangeType" VARCHAR(10)   NOT NULL CHECK ("ChangeType" IN ('IN','OUT')),
  "Quantity"   NUMERIC(10,2) NOT NULL,
  "Reference"  VARCHAR(100),
  "LogDate"    TIMESTAMP     NOT NULL DEFAULT NOW(),
  "Notes"      VARCHAR(300)
);

CREATE TABLE IF NOT EXISTS sales_entry (
  "SaleID"        SERIAL PRIMARY KEY,
  "BakeryID"      INT           NOT NULL REFERENCES bakery_entries("BakeryID"),
  "ProductID"     INT                    REFERENCES products("ProductID"),
  "Quantity"      NUMERIC(10,2) NOT NULL DEFAULT 0,
  "UnitPrice"     NUMERIC(10,2) NOT NULL DEFAULT 0,
  "TotalAmount"   NUMERIC(10,2) GENERATED ALWAYS AS ("Quantity" * "UnitPrice") STORED,
  "PaidAmount"    NUMERIC(10,2) NOT NULL DEFAULT 0,
  "BalanceAmount" NUMERIC(10,2) GENERATED ALWAYS AS (("Quantity" * "UnitPrice") - "PaidAmount") STORED,
  "SaleDate"      DATE          NOT NULL DEFAULT CURRENT_DATE,
  "Notes"         VARCHAR(300),
  "CreatedAt"     TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outlet_sales (
  "SaleID"       SERIAL PRIMARY KEY,
  "ProductID"    INT           NOT NULL REFERENCES products("ProductID"),
  "Quantity"     NUMERIC(10,2) NOT NULL,
  "UnitPrice"    NUMERIC(10,2) NOT NULL,
  "TotalAmount"  NUMERIC(10,2) GENERATED ALWAYS AS ("Quantity" * "UnitPrice") STORED,
  "SaleDate"     DATE          NOT NULL DEFAULT CURRENT_DATE,
  "CustomerName" VARCHAR(100),
  "Notes"        VARCHAR(300),
  "CreatedAt"    TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- =====================
-- TRIGGER: Purchase → update stock
-- =====================
CREATE OR REPLACE FUNCTION fn_purchase_update_stock() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."ProductID" IS NOT NULL AND NEW."Quantity" > 0 THEN
    INSERT INTO stock_inventory ("ProductID", "Quantity", "LastUpdated")
    VALUES (NEW."ProductID", NEW."Quantity", NOW())
    ON CONFLICT ("ProductID") DO UPDATE
      SET "Quantity"    = stock_inventory."Quantity" + EXCLUDED."Quantity",
          "LastUpdated" = NOW();

    INSERT INTO stock_log ("ProductID", "ChangeType", "Quantity", "Reference", "Notes")
    VALUES (NEW."ProductID", 'IN', NEW."Quantity",
            'Purchase #' || NEW."PurchaseID"::TEXT,
            'Stock added via purchase');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_purchase_update_stock ON purchase;
CREATE TRIGGER trg_purchase_update_stock
AFTER INSERT ON purchase
FOR EACH ROW EXECUTE FUNCTION fn_purchase_update_stock();

-- =====================
-- TRIGGER: Sale → update stock
-- =====================
CREATE OR REPLACE FUNCTION fn_sale_update_stock() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."ProductID" IS NOT NULL AND NEW."Quantity" > 0 THEN
    UPDATE stock_inventory
    SET "Quantity"    = "Quantity" - NEW."Quantity",
        "LastUpdated" = NOW()
    WHERE "ProductID" = NEW."ProductID";

    INSERT INTO stock_log ("ProductID", "ChangeType", "Quantity", "Reference", "Notes")
    VALUES (NEW."ProductID", 'OUT', NEW."Quantity",
            'Sale #' || NEW."SaleID"::TEXT,
            'Stock reduced via sale');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sale_update_stock ON sales_entry;
CREATE TRIGGER trg_sale_update_stock
AFTER INSERT ON sales_entry
FOR EACH ROW EXECUTE FUNCTION fn_sale_update_stock();

-- =====================
-- TRIGGER: Outlet sale → update stock
-- =====================
CREATE OR REPLACE FUNCTION fn_outlet_sale_update_stock() RETURNS TRIGGER AS $$
BEGIN
  UPDATE stock_inventory
  SET "Quantity"    = "Quantity" - NEW."Quantity",
      "LastUpdated" = NOW()
  WHERE "ProductID" = NEW."ProductID";

  INSERT INTO stock_log ("ProductID", "ChangeType", "Quantity", "Reference", "Notes")
  VALUES (NEW."ProductID", 'OUT', NEW."Quantity",
          'Outlet Sale #' || NEW."SaleID"::TEXT,
          'Direct customer sale');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_outlet_sale_update_stock ON outlet_sales;
CREATE TRIGGER trg_outlet_sale_update_stock
AFTER INSERT ON outlet_sales
FOR EACH ROW EXECUTE FUNCTION fn_outlet_sale_update_stock();
