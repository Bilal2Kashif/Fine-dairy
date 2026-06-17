// public/js/main.js

// Live date in topbar
(function () {
  const el = document.getElementById('topbar-date');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('en-PK', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
})();

// Auto-dismiss alerts after 4 seconds
document.querySelectorAll('.alert').forEach(el => {
  setTimeout(() => {
    el.style.transition = 'opacity 0.5s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 500);
  }, 4000);
});

// Confirm delete
document.querySelectorAll('.btn-danger[data-confirm]').forEach(btn => {
  btn.addEventListener('click', e => {
    if (!confirm(btn.dataset.confirm)) e.preventDefault();
  });
});

// Amount auto-calc (Purchase & Sales forms)
function setupAmountCalc(qtyId, priceId, totalId) {
  const qty   = document.getElementById(qtyId);
  const price = document.getElementById(priceId);
  const total = document.getElementById(totalId);
  if (!qty || !price || !total) return;
  const calc = () => {
    const q = parseFloat(qty.value) || 0;
    const p = parseFloat(price.value) || 0;
    total.textContent = 'Rs ' + (q * p).toLocaleString('en-PK', { minimumFractionDigits: 2 });
  };
  qty.addEventListener('input', calc);
  price.addEventListener('input', calc);
}

setupAmountCalc('Quantity', 'UnitPrice', 'calc-total');

// Payment-only toggle (Purchase & Sales forms)
(function () {
  const product = document.getElementById('ProductID');
  const qty = document.getElementById('Quantity');
  const price = document.getElementById('UnitPrice');
  const paid = document.getElementById('PaidAmount');
  const total = document.getElementById('calc-total');
  if (!product || !qty || !price || !paid) return;

  const toggle = () => {
    const hasProduct = Boolean(product.value);
    qty.required = hasProduct;
    price.required = hasProduct;
    qty.disabled = !hasProduct;
    price.disabled = !hasProduct;
    if (!hasProduct) {
      qty.value = '';
      price.value = '';
      paid.required = true;
      if (total) total.textContent = 'Rs 0.00';
    } else {
      paid.required = false;
      qty.disabled = false;
      price.disabled = false;
    }
  };

  product.addEventListener('change', toggle);
  toggle();
})();

// Stock warning bar animation
document.querySelectorAll('.qty-bar-fill').forEach(bar => {
  const pct = parseFloat(bar.dataset.pct) || 0;
  bar.style.width = Math.min(pct, 100) + '%';
});

// Sidebar toggle for mobile
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.querySelector('.sidebar');
const overlay = document.getElementById('sidebar-overlay');

if (sidebarToggle && sidebar && overlay) {
  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });
  // Close sidebar when a nav link is clicked (for mobile UX)
  sidebar.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  });
}
