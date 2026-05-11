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
      SELECT pu."PurchaseID", s."SupplierName", p."ProductName", p."Unit",
             pu."Quantity", pu."UnitPrice", pu."TotalAmount", pu."PurchaseDate", pu."Notes"
      FROM purchase pu
      JOIN suppliers s  ON pu."SupplierID" = s."SupplierID"
      JOIN products p   ON pu."ProductID"  = p."ProductID"
      ${where}
      ORDER BY pu."PurchaseDate" DESC, pu."PurchaseID" DESC`),
    pool.query(`SELECT "SupplierID", "SupplierName", "Contact", "Address", "IsActive" FROM suppliers WHERE "IsActive"=true ORDER BY "SupplierName"`),
    pool.query(`SELECT "ProductID", "ProductName" FROM products WHERE "IsActive"=true ORDER BY "ProductName"`),
  ]);

  res.render('suppliers/index', {
    title: 'Suppliers',
    purchases: purchases.rows,
    suppliers: suppliers.rows,
    products:  products.rows,
    filters: { from, to, supplier, product },
  });
});

router.post('/', async (req, res) => {
  try {
    const { SupplierName, Contact, Address } = req.body;
    const pool = await getPool();
    await pool.query(
      `INSERT INTO suppliers ("SupplierName", "Contact", "Address") VALUES ($1, $2, $3)`,
      [SupplierName.trim(), Contact || '', Address || '']
    );
    req.session.success = `Supplier "${SupplierName}" added.`;
  } catch (err) {
    req.session.error = 'Error: ' + err.message;
  }
  res.redirect('/suppliers');
});

router.post('/:id/delete', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.query(
      `UPDATE suppliers SET "IsActive"=false WHERE "SupplierID"=$1`,
      [req.params.id]
    );
    req.session.success = 'Supplier deactivated.';
  } catch (err) {
    req.session.error = 'Error: ' + err.message;
  }
  res.redirect('/suppliers');
});

module.exports = router;
