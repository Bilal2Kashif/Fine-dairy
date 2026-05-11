const express = require('express');
const router = express.Router();
const { getPool } = require('../db/db');

router.get('/', async (req, res) => {
  const pool = await getPool();
  const result = await pool.query(`SELECT * FROM products ORDER BY "ProductName"`);
  res.render('products/index', { title: 'Products', products: result.rows });
});

router.post('/', async (req, res) => {
  try {
    const { ProductName, Unit, Category } = req.body;
    const pool = await getPool();
    await pool.query(
      `INSERT INTO products ("ProductName", "Unit", "Category") VALUES ($1, $2, $3)`,
      [ProductName.trim(), Unit, Category.trim()]
    );
    req.session.success = `Product "${ProductName}" added successfully.`;
  } catch (err) {
    req.session.error = 'Error adding product: ' + err.message;
  }
  res.redirect('/products');
});

router.post('/:id/delete', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.query(
      `UPDATE products SET "IsActive"=false WHERE "ProductID"=$1`,
      [req.params.id]
    );
    req.session.success = 'Product deactivated.';
  } catch (err) {
    req.session.error = 'Error: ' + err.message;
  }
  res.redirect('/products');
});

module.exports = router;
