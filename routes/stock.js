const express = require('express');
const router = express.Router();
const { getPool } = require('../db/db');

router.get('/', async (req, res) => {
  const pool = await getPool();

  const [inventory, log, products] = await Promise.all([
    pool.query(`
      SELECT p."ProductName", p."Unit", p."Category",
             COALESCE(si."Quantity", 0) AS "Quantity",
             si."LastUpdated"
      FROM products p
      LEFT JOIN stock_inventory si ON p."ProductID" = si."ProductID"
      WHERE p."IsActive" = true
      ORDER BY p."ProductName"`),

    pool.query(`
      SELECT sl."LogID", p."ProductName", sl."ChangeType", sl."Quantity",
             sl."Reference", sl."Notes", sl."LogDate"
      FROM stock_log sl
      JOIN products p ON sl."ProductID" = p."ProductID"
      ORDER BY sl."LogDate" DESC
      LIMIT 50`),

    pool.query(`
      SELECT "ProductID", "ProductName", "Unit"
      FROM products
      WHERE "IsActive" = true
      ORDER BY "ProductName"`),
  ]);

  res.render('stock/index', {
    title:     'Stock',
    inventory: inventory.rows,
    log:       log.rows,
    products:  products.rows,
  });
});

router.post('/add', async (req, res) => {
  try {
    const { ProductID, Quantity, Notes } = req.body;
    const pool = await getPool();
    await pool.query(
      `INSERT INTO stock_inventory ("ProductID", "Quantity", "LastUpdated")
       VALUES ($1, $2, NOW())
       ON CONFLICT ("ProductID") DO UPDATE
         SET "Quantity"    = stock_inventory."Quantity" + EXCLUDED."Quantity",
             "LastUpdated" = NOW()`,
      [ProductID, parseFloat(Quantity)]
    );
    await pool.query(
      `INSERT INTO stock_log ("ProductID", "ChangeType", "Quantity", "Reference", "Notes")
       VALUES ($1, 'IN', $2, 'Manual', $3)`,
      [ProductID, parseFloat(Quantity), Notes || 'Manual addition']
    );
    req.session.success = 'Stock added successfully.';
  } catch (err) {
    req.session.error = 'Error: ' + err.message;
  }
  res.redirect('/stock');
});

router.post('/remove', async (req, res) => {
  try {
    const { ProductID, Quantity, Notes } = req.body;
    const pool = await getPool();
    await pool.query(
      `UPDATE stock_inventory
       SET "Quantity" = "Quantity" - $1, "LastUpdated" = NOW()
       WHERE "ProductID" = $2`,
      [parseFloat(Quantity), ProductID]
    );
    await pool.query(
      `INSERT INTO stock_log ("ProductID", "ChangeType", "Quantity", "Reference", "Notes")
       VALUES ($1, 'OUT', $2, 'Manual', $3)`,
      [ProductID, parseFloat(Quantity), Notes || 'Manual removal']
    );
    req.session.success = 'Stock removed.';
  } catch (err) {
    req.session.error = 'Error: ' + err.message;
  }
  res.redirect('/stock');
});

module.exports = router;
