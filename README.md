# Fine Dairy — Web Management System

A full-featured, web-based dairy business management system built with **Node.js**, **Express**, and **SQL Server**. Designed for small-to-medium dairy operations to manage inventory, suppliers, bakery customers, purchases, sales, and financial records — all from a browser.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Framework | Express.js |
| Templating | EJS |
| Database | Microsoft SQL Server (via `mssql`) |
| Auth | bcryptjs + express-session |
| PDF Export | pdfkit |
| Dev Tool | nodemon |

---

## Features

| Module | What you can do |
|--------|----------------|
| Authentication | Register and log in securely; all routes are session-protected |
| Dashboard | Live stats (total purchases, sales, stock value), recent transactions, low-stock alerts |
| Products | Add / deactivate products with unit (kg, litre, piece) and category |
| Suppliers | Add / deactivate suppliers with contact info |
| Bakeries | Add / deactivate bakery customers with contact info |
| Purchases | Record stock purchases from suppliers — inventory updates automatically |
| Sales | Record wholesale sales to bakeries — stock deducts automatically |
| Outlet Sales | Record direct (walk-in) customer sales — stock deducts automatically |
| Stock | View real-time inventory levels and a full IN/OUT stock log |
| Records | View party-wise ledger (paid, due, balance) with **PDF export** |

Stock is updated **automatically** via SQL Server triggers — no manual stock entry needed after purchases or sales.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v16 or later
- [SQL Server](https://www.microsoft.com/en-us/sql-server) (Express or full edition)
- [SQL Server Management Studio (SSMS)](https://learn.microsoft.com/en-us/sql/ssms/download-sql-server-management-studio-ssms) — to run the schema script

---

## Quick Start

### 1. Database Setup

1. Open **SSMS** and connect to your SQL Server instance (default: `localhost`)
2. Create a new database named `FineDairy` (if it does not exist)
3. Open `db/schema.sql` in SSMS
4. Execute the script — it creates all tables, triggers, and constraints

### 2. Configure Environment

Create or edit the `.env` file in the project root:

```env
DB_SERVER=localhost
DB_DATABASE=FineDairy
DB_USER=sa
DB_PASSWORD=your_actual_password
DB_PORT=1433
SESSION_SECRET=change_this_to_a_random_string
```

### 3. Install Dependencies & Run

```bash
npm install
npm start
```

Open your browser at **http://localhost:3000**

For development with auto-restart on file changes:

```bash
npm run dev
```

---

## Database Schema

```
AppUsers       — Registered users (email, hashed password, phone)
Products       — Master list of dairy products with unit and category
Suppliers      — Supplier directory
BakeryEntries  — Bakery customer directory
Purchase       — Purchase records (Supplier → Stock); paid/balance tracking
Sales Entry    — Wholesale sale records (Stock → Bakery); paid/balance tracking
OutletSales    — Direct customer (walk-in) sale records
StockInventory — Current stock level per product (auto-maintained via triggers)
StockLog       — Every stock IN/OUT event with reference and timestamp
```

### Triggers

| Trigger | Table | Action |
|---------|-------|--------|
| `trg_Purchase_UpdateStock` | Purchase | Adds quantity to StockInventory + logs IN event |
| `trg_Sale_UpdateStock` | Sales Entry | Deducts quantity from StockInventory + logs OUT event |
| `trg_OutletSale_UpdateStock` | OutletSales | Deducts quantity from StockInventory + logs OUT event |

---

## Folder Layout

```
fine-dairy-web/
├── server.js              ← App entry point
├── package.json
├── .env                   ← DB credentials (DO NOT commit)
├── db/
│   ├── db.js              ← SQL Server connection pool
│   └── schema.sql         ← Run once in SSMS to set up the database
├── routes/
│   ├── auth.js            ← Login / register
│   ├── dashboard.js
│   ├── products.js
│   ├── suppliers.js
│   ├── bakeries.js
│   ├── purchases.js
│   ├── sales.js
│   ├── outlet.js          ← Direct (walk-in) sales
│   ├── records.js         ← Ledger + PDF export
│   └── stock.js
├── views/
│   ├── partials/
│   │   ├── header.ejs     ← Sidebar + topbar
│   │   └── footer.ejs
│   ├── dashboard.ejs
│   ├── error.ejs
│   ├── products/index.ejs
│   ├── suppliers/index.ejs
│   ├── bakeries/index.ejs
│   ├── purchases/index.ejs
│   ├── sales/index.ejs
│   ├── outlet/index.ejs
│   ├── records/index.ejs
│   └── stock/index.ejs
└── public/
    ├── css/style.css      ← All styling
    └── js/main.js         ← Client-side JS
```

---

## Security Notes

- Passwords are hashed with **bcryptjs** before storage — plain-text passwords are never saved.
- All routes (except `/auth/login` and `/auth/register`) require an active session.
- Keep `.env` out of version control — it is already listed in `.gitignore`.
