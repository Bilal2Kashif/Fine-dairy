const express = require('express');
const router = express.Router();
const { getPool } = require('../db/db');

router.get('/', async (req, res) => {
  try {
    const pool = await getPool();

    const [products, suppliers, bakeries, purchases, sales, stockLow] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS cnt FROM products WHERE "IsActive"=true`),
      pool.query(`SELECT COUNT(*)::int AS cnt FROM suppliers WHERE "IsActive"=true`),
      pool.query(`SELECT COUNT(*)::int AS cnt FROM bakery_entries WHERE "IsActive"=true`),
      pool.query(`SELECT COALESCE(SUM("TotalAmount"),0)::float AS total FROM purchase WHERE "PurchaseDate" >= NOW() - INTERVAL '1 month'`),
      pool.query(`SELECT COALESCE(SUM("TotalAmount"),0)::float AS total FROM sales_entry WHERE "SaleDate" >= NOW() - INTERVAL '1 month'`),
      pool.query(`
        SELECT p."ProductName", si."Quantity", p."Unit"
        FROM stock_inventory si
        JOIN products p ON si."ProductID" = p."ProductID"
        WHERE si."Quantity" < 10 AND p."IsActive" = true
        ORDER BY si."Quantity" ASC`),
    ]);

    const recentActivity = await pool.query(`
      SELECT * FROM (
        SELECT
          'Purchase'                              AS "Type",
          s."SupplierName"                        AS "Party",
          COALESCE(pr."ProductName",'(Payment)')  AS "Product",
          pu."Quantity",
          pu."TotalAmount"                        AS "Amount",
          pu."PurchaseDate"                       AS "Date"
        FROM purchase pu
        JOIN suppliers s     ON pu."SupplierID" = s."SupplierID"
        LEFT JOIN products pr ON pu."ProductID"  = pr."ProductID"
        UNION ALL
        SELECT
          'Sale'                                  AS "Type",
          b."BakeryName"                          AS "Party",
          COALESCE(pr."ProductName",'(Payment)')  AS "Product",
          se."Quantity",
          se."TotalAmount"                        AS "Amount",
          se."SaleDate"                           AS "Date"
        FROM sales_entry se
        JOIN bakery_entries b  ON se."BakeryID"  = b."BakeryID"
        LEFT JOIN products pr  ON se."ProductID" = pr."ProductID"
      ) AS activity
      ORDER BY "Date" DESC
      LIMIT 8
    `);

    res.render('dashboard', {
      title: 'Dashboard',
      stats: {
        products:      products.rows[0].cnt,
        suppliers:     suppliers.rows[0].cnt,
        bakeries:      bakeries.rows[0].cnt,
        purchaseTotal: purchases.rows[0].total,
        salesTotal:    sales.rows[0].total,
      },
      lowStock:       stockLow.rows,
      recentActivity: recentActivity.rows,
    });
  } catch (err) {
    console.error(err);
    res.render('dashboard', {
      title: 'Dashboard',
      stats: { products: 0, suppliers: 0, bakeries: 0, purchaseTotal: 0, salesTotal: 0 },
      lowStock: [],
      recentActivity: [],
      dbError: 'Could not connect to database. Please check your .env settings.',
    });
  }
});

module.exports = router;
