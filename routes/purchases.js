const express = require('express');
const router = express.Router();
const { getPool } = require('../db/db');

router.get('/', async (req, res) => {
  const pool = await getPool();
  const { from, to, supplier, product } = req.query;

  let where = 'WHERE 1=1';
  if (from)     where += ` AND pu."PurchaseDate" >= '${from}'`;
  if (to)       where += ` AND pu."PurchaseDate" <= '${to}'`;
  if (supplier) where += ` AND pu."SupplierID" = ${parseInt(supplier)}`;
  if (product)  where += ` AND pu."ProductID" = ${parseInt(product)}`;

  const [purchases, suppliers, products] = await Promise.all([
    pool.query(`
      SELECT pu."PurchaseID", s."SupplierName",
        COALESCE(p."ProductName", '(Payment)') AS "ProductName",
        COALESCE(p."Unit", '')                 AS "Unit",
        pu."Quantity", pu."UnitPrice", pu."TotalAmount",
        pu."PaidAmount", pu."BalanceAmount",
        pu."PurchaseDate", pu."Notes"
      FROM purchase pu
      JOIN suppliers s    ON pu."SupplierID" = s."SupplierID"
      LEFT JOIN products p ON pu."ProductID"  = p."ProductID"
      ${where}
      ORDER BY pu."PurchaseDate" DESC, pu."PurchaseID" DESC`),
    pool.query(`SELECT "SupplierID", "SupplierName" FROM suppliers WHERE "IsActive"=true ORDER BY "SupplierName"`),
    pool.query(`SELECT "ProductID", "ProductName" FROM products WHERE "IsActive"=true ORDER BY "ProductName"`),
  ]);

  res.render('purchases/index', {
    title: 'Purchases',
    purchases: purchases.rows,
    suppliers: suppliers.rows,
    products:  products.rows,
    filters: { from, to, supplier, product },
  });
});

router.post('/', async (req, res) => {
  try {
    const { SupplierID, ProductID, Quantity, UnitPrice, PurchaseDate, Notes, PaidAmount } = req.body;
    const pool = await getPool();

    const productId = ProductID ? parseInt(ProductID) : null;
    const paid = Math.max(0, parseFloat(PaidAmount) || 0);
    let qty   = parseFloat(Quantity);
    let price = parseFloat(UnitPrice);

    if (productId) {
      if (!(qty > 0) || isNaN(price) || price < 0) {
        req.session.error = 'Please enter a valid quantity and unit price.';
        return res.redirect('/purchases');
      }
    } else {
      if (!(paid > 0)) {
        req.session.error = 'Please enter a paid amount for payment-only entries.';
        return res.redirect('/purchases');
      }
      qty   = 0;
      price = 0;
    }

    await pool.query(
      `INSERT INTO purchase ("SupplierID", "ProductID", "Quantity", "UnitPrice", "PaidAmount", "PurchaseDate", "Notes")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [SupplierID, productId, qty, price, paid, PurchaseDate, Notes || '']
    );
    req.session.success = productId ? 'Purchase recorded and stock updated.' : 'Payment recorded.';
  } catch (err) {
    req.session.error = 'Error: ' + err.message;
  }
  res.redirect('/purchases');
});

module.exports = router;
