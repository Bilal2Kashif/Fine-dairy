require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const methodOverride = require('method-override');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  store: new pgSession({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'finedairy_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Flash message middleware
app.use((req, res, next) => {
  res.locals.success = req.session.success || null;
  res.locals.error = req.session.error || null;
  res.locals.user = req.session.user || null;
  delete req.session.success;
  delete req.session.error;
  next();
});

// Routes
app.use('/auth', require('./routes/auth'));

// Auth guard
app.use((req, res, next) => {
  if (req.session.user) return next();
  return res.redirect('/auth/login');
});

app.use('/', require('./routes/dashboard'));
app.use('/products', require('./routes/products'));
app.use('/suppliers', require('./routes/suppliers'));
app.use('/bakeries', require('./routes/bakeries'));
app.use('/purchases', require('./routes/purchases'));
app.use('/sales', require('./routes/sales'));
app.use('/stock', require('./routes/stock'));
app.use('/outlet', require('./routes/outlet'));
app.use('/records', require('./routes/records'));

// 404
app.use((req, res) => {
  res.status(404).render('error', { title: '404 Not Found', message: 'Page not found.' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Server Error', message: err.message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Fine Dairy running at http://localhost:${PORT}`);
  });
}

module.exports = app;
