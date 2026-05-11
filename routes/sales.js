const express = require('express');
const router = express.Router();
const { getPool } = require('../db/db');

router.get('/', async (req, res) => {
  const pool = await getPool();
  const { from, to, bakery, product } = req.query;

  let where = 'WHERE 1=1';
  if (from)    where += ` AND se."SaleDate" >= '${from}'`;
  if (to)      where += ` AND se."SaleDate" <= '${to}'`;
  if (bakery)  where += ` AND se."BakeryID" = ${parseInt(bakery)}`;
  if (product) where += ` AND se."ProductID" = ${parseInt(product)}`;

  const [sales, bakeries, products] = await Promise.all([
    pool.query(`
      SELECT se."SaleID", b."BakeryName",
        COALESCE(p."ProductName", '(Payment)') AS "ProductName",
        COALESCE(p."Unit", '')                 AS "Unit",
        se."Quantity", se."UnitPrice", se."TotalAmount",
        se."PaidAmount", se."BalanceAmount",
        se."SaleDate", se."Notes"
      FROM sales_entry se
      JOIN bakery_entries b  ON se."BakeryID"  = b."BakeryID"
      LEFT JOIN products p   ON se."ProductID" = p."ProductID"
      ${where}
      ORDER BY se."SaleDate" DESC, se."SaleID" DESC`),
    pool.query(`SELECT "BakeryID", "BakeryName" FROM bakery_entries WHERE "IsActive"=true ORDER BY "BakeryName"`),
    pool.query(`SELECT "ProductID", "ProductName" FROM products WHERE "IsActive"=true ORDER BY "ProductName"`),
  ]);

  res.render('sales/index', {
    title: 'Sales',
    sales:    sales.rows,
    bakeries: bakeries.rows,
    products: products.rows,
    filters: { from, to, bakery, product },
  });
});

router.post('/', async (req, res) => {
  try {
    const { BakeryID, ProductID, Quantity, UnitPrice, SaleDate, Notes, PaidAmount } = req.body;
    const pool = await getPool();

    const productId = ProductID ? parseInt(ProductID) : null;
    const paid = Math.max(0, parseFloat(PaidAmount) || 0);
    let qty   = parseFloat(Quantity);
    let price = parseFloat(UnitPrice);

    if (productId) {
      if (!(qty > 0) || isNaN(price) || price < 0) {
        req.session.error = 'Please enter a valid quantity and unit price.';
        return res.redirect('/sales');
      }
    } else {
      if (!(paid > 0)) {
        req.session.error = 'Please enter a paid amount for payment-only entries.';
        return res.redirect('/sales');
      }
      qty   = 0;
      price = 0;
    }

    if (productId) {
      const stockCheck = await pool.query(
        `SELECT COALESCE("Quantity", 0) AS qty FROM stock_inventory WHERE "ProductID"=$1`,
        [productId]
      );
      const currentStock = parseFloat(stockCheck.rows[0]?.qty ?? 0);
      if (qty > currentStock) {
        req.session.error = `Insufficient stock. Available: ${currentStock}`;
        return res.redirect('/sales');
      }
    }

    await pool.query(
      `INSERT INTO sales_entry ("BakeryID", "ProductID", "Quantity", "UnitPrice", "PaidAmount", "SaleDate", "Notes")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [BakeryID, productId, qty, price, paid, SaleDate, Notes || '']
    );
    req.session.success = productId ? 'Sale recorded and stock updated.' : 'Payment recorded.';
  } catch (err) {
    req.session.error = 'Error: ' + err.message;
  }
  res.redirect('/sales');
});

module.exports = router;
