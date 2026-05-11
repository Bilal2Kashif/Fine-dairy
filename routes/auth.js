const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { getPool } = require('../db/db');

const isEmail = (value) => /.+@.+\..+/.test(value || '');

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('auth/login', { title: 'Login' });
});

router.post('/login', async (req, res) => {
  try {
    const { Email, Password } = req.body;
    if (!isEmail(Email) || !Password) {
      req.session.error = 'Please enter a valid email and password.';
      return res.redirect('/auth/login');
    }

    const pool = await getPool();
    const result = await pool.query(
      `SELECT "UserID", "FullName", "Email", "PasswordHash" FROM app_users WHERE "Email"=$1`,
      [Email.trim().toLowerCase()]
    );

    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(Password, user.PasswordHash))) {
      req.session.error = 'Invalid email or password.';
      return res.redirect('/auth/login');
    }

    req.session.user = { id: user.UserID, name: user.FullName, email: user.Email };
    res.redirect('/');
  } catch (err) {
    req.session.error = 'Error: ' + err.message;
    res.redirect('/auth/login');
  }
});

router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('auth/register', { title: 'Register' });
});

router.post('/register', async (req, res) => {
  try {
    const { FullName, Phone, Email, Password } = req.body;
    if (!FullName || !Phone || !isEmail(Email) || !Password) {
      req.session.error = 'Please fill all fields with valid values.';
      return res.redirect('/auth/register');
    }

    const pool = await getPool();
    const existing = await pool.query(
      `SELECT "UserID" FROM app_users WHERE "Email"=$1 OR "Phone"=$2 LIMIT 1`,
      [Email.trim().toLowerCase(), Phone.trim()]
    );

    if (existing.rows.length > 0) {
      req.session.error = 'Email or phone already registered.';
      return res.redirect('/auth/register');
    }

    const hash = await bcrypt.hash(Password, 10);
    await pool.query(
      `INSERT INTO app_users ("FullName", "Phone", "Email", "PasswordHash") VALUES ($1, $2, $3, $4)`,
      [FullName.trim(), Phone.trim(), Email.trim().toLowerCase(), hash]
    );

    req.session.success = 'Account created. Please log in.';
    res.redirect('/auth/login');
  } catch (err) {
    req.session.error = 'Error: ' + err.message;
    res.redirect('/auth/register');
  }
});

router.get('/forgot', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('auth/forgot', { title: 'Forgot Password' });
});

router.post('/forgot', async (req, res) => {
  try {
    const { Phone, NewPassword } = req.body;
    if (!Phone || !NewPassword) {
      req.session.error = 'Please enter phone number and a new password.';
      return res.redirect('/auth/forgot');
    }

    const pool = await getPool();
    const user = await pool.query(
      `SELECT "UserID" FROM app_users WHERE "Phone"=$1 LIMIT 1`,
      [Phone.trim()]
    );

    if (user.rows.length === 0) {
      req.session.error = 'No user found for this phone number.';
      return res.redirect('/auth/forgot');
    }

    const hash = await bcrypt.hash(NewPassword, 10);
    await pool.query(
      `UPDATE app_users SET "PasswordHash"=$1 WHERE "UserID"=$2`,
      [hash, user.rows[0].UserID]
    );

    req.session.success = 'Password updated. Please log in.';
    res.redirect('/auth/login');
  } catch (err) {
    req.session.error = 'Error: ' + err.message;
    res.redirect('/auth/forgot');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/auth/login'));
});

module.exports = router;
