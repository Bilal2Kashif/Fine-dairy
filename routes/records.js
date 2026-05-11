const express = require('express');
const router = express.Router();
const { getPool } = require('../db/db');
const PDFDocument = require('pdfkit');

const PARTY_LABELS = {
  bakery:   'Customer',
  supplier: 'Supplier',
};

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-PK');
};

const sanitizeFileName = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, '_')
  .replace(/[^a-zA-Z0-9_-]/g, '');

const buildTotals = (rows) => rows.reduce((acc, r) => {
  acc.total += Number(r.TotalAmount  || 0);
  acc.paid  += Number(r.PaidAmount   || 0);
  acc.due   += Number(r.BalanceAmount|| 0);
  return acc;
}, { total: 0, paid: 0, due: 0 });

async function fetchRecords(partyType, partyId, filters) {
  const pool = await getPool();
  const { from, to, product } = filters;

  if (partyType === 'bakery') {
    let query = `
      SELECT se."SaleID" AS "ID",
        COALESCE(p."ProductName", '(Payment)') AS "ProductName",
        COALESCE(p."Unit", '')                 AS "Unit",
        se."Quantity",
        se."UnitPrice", se."TotalAmount", se."PaidAmount", se."BalanceAmount",
        se."SaleDate"  AS "TxDate", se."Notes",
        'Bakery Sale'  AS "TxType"
      FROM sales_entry se
      LEFT JOIN products p ON se."ProductID" = p."ProductID"
      WHERE se."BakeryID" = $1`;
    if (from)    query += ` AND se."SaleDate" >= '${from}'`;
    if (to)      query += ` AND se."SaleDate" <= '${to}'`;
    if (product) query += ` AND p."ProductName" ILIKE '%${product}%'`;
    query += ` ORDER BY se."SaleDate" DESC`;

    const [data, party] = await Promise.all([
      pool.query(query, [partyId]),
      pool.query(`SELECT "BakeryName" AS "PartyName" FROM bakery_entries WHERE "BakeryID"=$1`, [partyId]),
    ]);
    return { data: data.rows, partyName: party.rows[0]?.PartyName };
  }

  let query = `
    SELECT pu."PurchaseID" AS "ID",
      COALESCE(p."ProductName", '(Payment)') AS "ProductName",
      COALESCE(p."Unit", '')                 AS "Unit",
      pu."Quantity",
      pu."UnitPrice", pu."TotalAmount", pu."PaidAmount", pu."BalanceAmount",
      pu."PurchaseDate" AS "TxDate", pu."Notes",
      'Purchase'        AS "TxType"
    FROM purchase pu
    LEFT JOIN products p ON pu."ProductID" = p."ProductID"
    WHERE pu."SupplierID" = $1`;
  if (from)    query += ` AND pu."PurchaseDate" >= '${from}'`;
  if (to)      query += ` AND pu."PurchaseDate" <= '${to}'`;
  if (product) query += ` AND p."ProductName" ILIKE '%${product}%'`;
  query += ` ORDER BY pu."PurchaseDate" DESC`;

  const [data, party] = await Promise.all([
    pool.query(query, [partyId]),
    pool.query(`SELECT "SupplierName" AS "PartyName" FROM suppliers WHERE "SupplierID"=$1`, [partyId]),
  ]);
  return { data: data.rows, partyName: party.rows[0]?.PartyName };
}

// Main records page
router.get('/', async (req, res) => {
  const pool = await getPool();
  const [bakeries, suppliers] = await Promise.all([
    pool.query(`SELECT "BakeryID", "BakeryName" FROM bakery_entries WHERE "IsActive"=true ORDER BY "BakeryName"`),
    pool.query(`SELECT "SupplierID", "SupplierName" FROM suppliers WHERE "IsActive"=true ORDER BY "SupplierName"`),
  ]);
  res.render('record/index', {
    title: 'Records',
    bakeries:  bakeries.rows,
    suppliers: suppliers.rows,
    data:      null,
    partyName: null,
    partyType: null,
    partyId:   null,
    filters:   {},
  });
});

// Bakery records
router.get('/bakery/:id', async (req, res) => {
  const pool = await getPool();
  const { from, to, product } = req.query;

  let query = `
    SELECT se."SaleID" AS "ID",
      COALESCE(p."ProductName", '(Payment)') AS "ProductName",
      COALESCE(p."Unit", '')                 AS "Unit",
      se."Quantity",
      se."UnitPrice", se."TotalAmount", se."PaidAmount", se."BalanceAmount",
      se."SaleDate"  AS "TxDate", se."Notes",
      'Bakery Sale'  AS "TxType"
    FROM sales_entry se
    LEFT JOIN products p ON se."ProductID" = p."ProductID"
    WHERE se."BakeryID" = $1`;
  if (from)    query += ` AND se."SaleDate" >= '${from}'`;
  if (to)      query += ` AND se."SaleDate" <= '${to}'`;
  if (product) query += ` AND p."ProductName" ILIKE '%${product}%'`;
  query += ` ORDER BY se."SaleDate" DESC`;

  const [data, bakery, bakeries, suppliers, products] = await Promise.all([
    pool.query(query, [req.params.id]),
    pool.query(`SELECT "BakeryName" FROM bakery_entries WHERE "BakeryID"=$1`, [req.params.id]),
    pool.query(`SELECT "BakeryID", "BakeryName" FROM bakery_entries WHERE "IsActive"=true ORDER BY "BakeryName"`),
    pool.query(`SELECT "SupplierID", "SupplierName" FROM suppliers WHERE "IsActive"=true ORDER BY "SupplierName"`),
    pool.query(`SELECT DISTINCT p."ProductName" FROM sales_entry se JOIN products p ON se."ProductID"=p."ProductID" WHERE se."BakeryID"=$1 ORDER BY p."ProductName"`, [req.params.id]),
  ]);

  res.render('record/index', {
    title:     'Records',
    bakeries:  bakeries.rows,
    suppliers: suppliers.rows,
    data:      data.rows,
    products:  products.rows,
    partyName: bakery.rows[0]?.BakeryName,
    partyType: 'bakery',
    partyId:   req.params.id,
    filters:   { from, to, product },
  });
});

// Supplier records
router.get('/supplier/:id', async (req, res) => {
  const pool = await getPool();
  const { from, to, product } = req.query;

  let query = `
    SELECT pu."PurchaseID" AS "ID",
      COALESCE(p."ProductName", '(Payment)') AS "ProductName",
      COALESCE(p."Unit", '')                 AS "Unit",
      pu."Quantity",
      pu."UnitPrice", pu."TotalAmount", pu."PaidAmount", pu."BalanceAmount",
      pu."PurchaseDate" AS "TxDate", pu."Notes",
      'Purchase'        AS "TxType"
    FROM purchase pu
    LEFT JOIN products p ON pu."ProductID" = p."ProductID"
    WHERE pu."SupplierID" = $1`;
  if (from)    query += ` AND pu."PurchaseDate" >= '${from}'`;
  if (to)      query += ` AND pu."PurchaseDate" <= '${to}'`;
  if (product) query += ` AND p."ProductName" ILIKE '%${product}%'`;
  query += ` ORDER BY pu."PurchaseDate" DESC`;

  const [data, supplier, bakeries, suppliers, products] = await Promise.all([
    pool.query(query, [req.params.id]),
    pool.query(`SELECT "SupplierName" FROM suppliers WHERE "SupplierID"=$1`, [req.params.id]),
    pool.query(`SELECT "BakeryID", "BakeryName" FROM bakery_entries WHERE "IsActive"=true ORDER BY "BakeryName"`),
    pool.query(`SELECT "SupplierID", "SupplierName" FROM suppliers WHERE "IsActive"=true ORDER BY "SupplierName"`),
    pool.query(`SELECT DISTINCT p."ProductName" FROM purchase pu JOIN products p ON pu."ProductID"=p."ProductID" WHERE pu."SupplierID"=$1 ORDER BY p."ProductName"`, [req.params.id]),
  ]);

  res.render('record/index', {
    title:     'Records',
    bakeries:  bakeries.rows,
    suppliers: suppliers.rows,
    data:      data.rows,
    products:  products.rows,
    partyName: supplier.rows[0]?.SupplierName,
    partyType: 'supplier',
    partyId:   req.params.id,
    filters:   { from, to, product },
  });
});

// Download (PDF / XLS)
router.get('/:partyType/:id/download', async (req, res) => {
  try {
    const { partyType, id } = req.params;
    const format = (req.query.format || 'xls').toLowerCase();
    if (!['bakery', 'supplier'].includes(partyType)) return res.status(404).send('Not found');

    const filters = {
      from:    req.query.from    || '',
      to:      req.query.to      || '',
      product: req.query.product || '',
    };

    const { data, partyName } = await fetchRecords(partyType, id, filters);
    const label    = PARTY_LABELS[partyType] || 'Party';
    const totals   = buildTotals(data);
    const safeName = sanitizeFileName(partyName || label);
    const fileDate = `${filters.from || 'all'}_${filters.to || 'all'}`.replace(/[^0-9_-]/g, '');

    if (format === 'pdf') {
      const doc      = new PDFDocument({ margin: 40, size: 'A4' });
      const fileName = `FineDairy_${safeName}_${fileDate}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      doc.pipe(res);

      doc.fontSize(18).text('Fine Dairy', { align: 'left' });
      doc.moveDown(0.4);
      doc.fontSize(12).text(`${label}: ${partyName || ''}`);
      doc.text(`From: ${filters.from || ''}`);
      doc.text(`To: ${filters.to || ''}`);
      doc.moveDown(0.8);

      const columns = [
        { key: 'TxDate',        label: 'Date',       width: 58  },
        { key: 'ProductName',   label: 'Product',    width: 110 },
        { key: 'Quantity',      label: 'Qty',        width: 40  },
        { key: 'UnitPrice',     label: 'Unit Price', width: 60  },
        { key: 'TotalAmount',   label: 'Total',      width: 60  },
        { key: 'PaidAmount',    label: 'Paid',       width: 55  },
        { key: 'BalanceAmount', label: 'Due',        width: 55  },
        { key: 'Notes',         label: 'Notes',      width: 77  },
      ];
      const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);

      const truncate = (value, max) => {
        const text = String(value ?? '');
        return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
      };

      const rowHeight = 18;
      const startX   = doc.x;
      let y          = doc.y;

      const drawHeader = () => {
        let x = startX;
        doc.fontSize(9).fillColor('#0a4a3c');
        columns.forEach(col => {
          doc.text(col.label, x, y, { width: col.width, align: 'left' });
          x += col.width;
        });
        doc.moveTo(startX, y + rowHeight - 4).lineTo(startX + tableWidth, y + rowHeight - 4).stroke('#cccccc');
        y += rowHeight;
      };

      drawHeader();
      doc.fontSize(9).fillColor('#1a1a1a');

      data.forEach(row => {
        if (y > 730) { doc.addPage(); y = doc.y; drawHeader(); doc.fontSize(9).fillColor('#1a1a1a'); }
        let x = startX;
        columns.forEach(col => {
          let value = row[col.key];
          if (col.key === 'TxDate') value = formatDate(value);
          if (['UnitPrice','TotalAmount','PaidAmount','BalanceAmount'].includes(col.key))
            value = Number(value || 0).toLocaleString('en-PK');
          if (col.key === 'Quantity') value = row.Unit ? `${row.Quantity} ${row.Unit}` : `${row.Quantity}`;
          doc.text(truncate(value, 22), x, y, { width: col.width, align: 'left' });
          x += col.width;
        });
        y += rowHeight;
      });

      doc.moveDown(0.8);
      doc.strokeColor('#cccccc').moveTo(startX, doc.y).lineTo(startX + tableWidth, doc.y).stroke();
      doc.moveDown(0.4);
      doc.fontSize(10).fillColor('#1a1a1a');
      const labelWidth = 42;
      const valueX    = startX + labelWidth;
      doc.text('Total:', startX, doc.y, { continued: true, width: labelWidth });
      doc.text(` Rs ${totals.total.toLocaleString('en-PK')}`, valueX);
      doc.text('Paid:',  startX, doc.y, { continued: true, width: labelWidth });
      doc.text(` Rs ${totals.paid.toLocaleString('en-PK')}`,  valueX);
      doc.text('Due:',   startX, doc.y, { continued: true, width: labelWidth });
      doc.text(` Rs ${totals.due.toLocaleString('en-PK')}`,   valueX);
      doc.end();
      return;
    }

    const fileName   = `FineDairy_${safeName}_${fileDate}.xls`;
    const headerRows = `
      <table>
        <tr><th colspan="8" style="font-size:16px;text-align:left">Fine Dairy</th></tr>
        <tr><td colspan="8">${label}: ${partyName || ''}</td></tr>
        <tr><td colspan="8">From: ${filters.from || ''}</td></tr>
        <tr><td colspan="8">To: ${filters.to || ''}</td></tr>
      </table><br />`;

    const rowsHtml = data.map(r => `
      <tr>
        <td>${formatDate(r.TxDate)}</td>
        <td>${r.ProductName || ''}</td>
        <td>${r.Quantity}${r.Unit ? ` ${r.Unit}` : ''}</td>
        <td>${Number(r.UnitPrice     || 0).toLocaleString('en-PK')}</td>
        <td>${Number(r.TotalAmount   || 0).toLocaleString('en-PK')}</td>
        <td>${Number(r.PaidAmount    || 0).toLocaleString('en-PK')}</td>
        <td>${Number(r.BalanceAmount || 0).toLocaleString('en-PK')}</td>
        <td>${r.Notes || ''}</td>
      </tr>`).join('');

    const tableHtml = `
      <table border="1" cellspacing="0" cellpadding="5">
        <thead>
          <tr><th>Date</th><th>Product</th><th>Qty</th><th>Unit Price</th>
              <th>Total</th><th>Paid</th><th>Due</th><th>Notes</th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table><br />
      <div>Totals — Total: Rs ${totals.total.toLocaleString('en-PK')} | Paid: Rs ${totals.paid.toLocaleString('en-PK')} | Due: Rs ${totals.due.toLocaleString('en-PK')}</div>`;

    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(`<!doctype html><html><head><meta charset="utf-8"></head><body>${headerRows}${tableHtml}</body></html>`);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

module.exports = router;
