const express = require('express');
const router = express.Router();
const { getPool } = require('../db/db');

router.get('/', async (req, res) => {
  const pool = await getPool();
  const result = await pool.query(
    `SELECT "BakeryID", "BakeryName", "Contact", "Address", "IsActive" FROM bakery_entries ORDER BY "BakeryName"`
  );
  res.render('bakeries/index', { title: 'Bakeries', bakeries: result.rows });
});

router.post('/', async (req, res) => {
  try {
    const { BakeryName, Contact, Address } = req.body;
    const pool = await getPool();
    await pool.query(
      `INSERT INTO bakery_entries ("BakeryName", "Contact", "Address") VALUES ($1, $2, $3)`,
      [BakeryName.trim(), Contact || '', Address || '']
    );
    req.session.success = `Bakery "${BakeryName}" added.`;
  } catch (err) {
    req.session.error = 'Error: ' + err.message;
  }
  res.redirect('/bakeries');
});

router.post('/:id/delete', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.query(
      `UPDATE bakery_entries SET "IsActive"=false WHERE "BakeryID"=$1`,
      [req.params.id]
    );
    req.session.success = 'Bakery deactivated.';
  } catch (err) {
    req.session.error = 'Error: ' + err.message;
  }
  res.redirect('/bakeries');
});

module.exports = router;
