const express = require('express');
const router = express.Router();
const { getPool } = require('../db/db');

router.get('/', async (req, res) => {
  const pool = await getPool();
  const [sales, products] = await Promise.all([
    pool.query(`
      SELECT os."SaleID", p."ProductName", p."Unit", os."Quantity",
             os."UnitPrice", os."TotalAmount", os."SaleDate", os."CustomerName", os."Notes"
      FROM outlet_sales os
      JOIN products p ON os."ProductID" = p."ProductID"
      ORDER BY os."SaleDate" DESC, os."SaleID" DESC`),
    pool.query(`
      SELECT p."ProductID", p."ProductName", p."Unit",
             COALESCE(si."Quantity", 0) AS "Stock"
      FROM products p
      LEFT JOIN stock_inventory si ON p."ProductID" = si."ProductID"
      WHERE p."IsActive"=true
      ORDER BY p."ProductName"`),
  ]);
  res.render('outlet/index', {
    title:    'Outlet Sales',
    sales:    sales.rows,
    products: products.rows,
  });
});

router.post('/', async (req, res) => {
  try {
    const { ProductID, Quantity, UnitPrice, SaleDate, CustomerName, Notes } = req.body;
    const pool = await getPool();

    const stockCheck = await pool.query(
      `SELECT COALESCE("Quantity", 0) AS qty FROM stock_inventory WHERE "ProductID"=$1`,
      [ProductID]
    );
    if (parseFloat(Quantity) > (parseFloat(stockCheck.rows[0]?.qty) || 0)) {
      req.session.error = `Insufficient stock. Available: ${stockCheck.rows[0]?.qty || 0}`;
      return res.redirect('/outlet');
    }

    await pool.query(
      `INSERT INTO outlet_sales ("ProductID", "Quantity", "UnitPrice", "SaleDate", "CustomerName", "Notes")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ProductID, parseFloat(Quantity), parseFloat(UnitPrice), SaleDate, CustomerName || 'Walk-in', Notes || '']
    );
    req.session.success = 'Outlet sale recorded.';
  } catch (err) {
    req.session.error = 'Error: ' + err.message;
  }
  res.redirect('/outlet');
});

module.exports = router;
