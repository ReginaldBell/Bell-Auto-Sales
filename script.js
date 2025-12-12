/* ==============================
   HOMEPAGE INVENTORY + UI + CALCULATOR
   B & S Auto Sales
   ============================== */

(function () {
  'use strict';

  /* ---------- helpers ---------- */

  /**
   * Convert API response (snake_case) to frontend format (camelCase)
   */
  function normalizeVehicle(v) {
    let images = [];
    if (v.images_json) {
      try {
        images = JSON.parse(v.images_json);
        if (!Array.isArray(images)) images = [];
      } catch (e) {
        console.warn('Failed to parse images_json:', e);
        images = [];
      }
    } else if (Array.isArray(v.images)) {
      images = v.images;
    }

    return {
      id: v.id,
      year: v.year,
      make: v.make,
      model: v.model,
      trim: v.trim || '',
      price: v.price,
      mileage: v.mileage,
      status: v.status || 'available',
      exteriorColor: v.exterior_color || v.exteriorColor || '',
      interiorColor: v.interior_color || v.interiorColor || '',
      fuelType: v.fuel_type || v.fuelType || '',
      transmission: v.transmission || '',
      engine: v.engine || '',
      drivetrain: v.drivetrain || '',
      description: v.description || '',
      images: images,
      mainImage: images.length > 0 ? images[0] : ''
    };
  }

  /**
   * Fetch vehicles from API
   */
  async function fetchVehiclesFromAPI() {
    try {
      const response = await fetch('/api/vehicles');
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) return [];
      return data.map(normalizeVehicle);
    } catch (err) {
      console.error('Failed to fetch vehicles from API:', err);
      return [];
    }
  }

  function getPrimaryImage(car) {
    if (car.mainImage) return car.mainImage;
    if (Array.isArray(car.images) && car.images.length > 0) return car.images[0];
    return 'https://via.placeholder.com/600x450?text=No+Image';
  }

  function formatPrice(price) {
    const num = Number(price);
    if (isNaN(num)) return '$0';
    return '$' + num.toLocaleString('en-US');
  }

  function formatMileage(mileage) {
    const num = Number(mileage);
    if (isNaN(num)) return '0 mi';
    return num.toLocaleString('en-US') + ' mi';
  }

  function clampNumber(n, min, max) {
    const num = Number(n);
    if (isNaN(num)) return min;
    return Math.min(Math.max(num, min), max);
  }

  /* ---------- card builder ---------- */
  function createCard(car) {
    const card = document.createElement('div');
    card.className = 'vehicle-card car-card';
    card.dataset.carId = car.id;

    const statusClass = car.status === 'sold' ? 'badge-sold' : 'badge-available';
    const statusText = car.status === 'sold' ? 'Sold' : 'Available';

    card.innerHTML = `
      <div class="vehicle-image-container car-image-wrap car-image-inner">
        <img 
          src="${getPrimaryImage(car)}" 
          alt="${car.year} ${car.make} ${car.model}" 
          class="vehicle-image car-image"
          loading="lazy"
        >
        <div class="vehicle-badges">
          <span class="badge ${statusClass}">${statusText}</span>
        </div>
        <button class="favorite-btn" aria-label="Add to favorites"></button>
      </div>
      <div class="vehicle-content car-details">
        <div class="vehicle-meta">
          <span class="meta-item">
            <span class="meta-icon">📅</span>
            <span>${car.year || 'N/A'}</span>
          </span>
          <span class="meta-item">
            <span class="meta-icon">🛣️</span>
            <span>${formatMileage(car.mileage)}</span>
          </span>
          <span class="meta-item">
            <span class="meta-icon">⚙️</span>
            <span>${car.transmission || 'Auto'}</span>
          </span>
        </div>
        <h3 class="vehicle-title car-title">${car.year} ${car.make} ${car.model}${car.trim ? ' ' + car.trim : ''}</h3>
        <div class="vehicle-price car-price">${formatPrice(car.price)}</div>
        <p class="vehicle-description car-description">${car.description || 'Quality pre-owned vehicle. Contact us for more details.'}</p>
        <div class="vehicle-specs-mini car-mini-specs">
          <div class="spec-mini-item">
            <span class="spec-mini-label">Engine</span>
            <span class="spec-mini-value">${car.engine || 'N/A'}</span>
          </div>
          <div class="spec-mini-item">
            <span class="spec-mini-label">Drivetrain</span>
            <span class="spec-mini-value">${car.drivetrain || 'N/A'}</span>
          </div>
          <div class="spec-mini-item">
            <span class="spec-mini-label">Fuel Type</span>
            <span class="spec-mini-value">${car.fuelType || 'Gasoline'}</span>
          </div>
          <div class="spec-mini-item">
            <span class="spec-mini-label">Exterior</span>
            <span class="spec-mini-value">${car.exteriorColor || 'N/A'}</span>
          </div>
        </div>
        <div class="vehicle-actions car-action">
          <a href="vehicle.html?id=${car.id}" class="btn btn-primary">View Details</a>
          <button class="btn btn-secondary btn-icon" aria-label="Quick view" data-car-id="${car.id}">👁️</button>
        </div>
        <div class="dealer-badge">
          Verified by B &amp; S Auto Sales
        </div>
      </div>
    `;

    return card;
  }

  /* ---------- render inventory ---------- */
  async function renderInventory() {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;

    // Show loading state
    grid.innerHTML = `
      <div class="loading-state" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
        <p>Loading inventory...</p>
      </div>
    `;

    const cars = await fetchVehiclesFromAPI();

    grid.innerHTML = '';

    if (cars.length === 0) {
      grid.innerHTML = `
        <div class="no-inventory" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
          <h3>No vehicles in inventory</h3>
          <p>Check back soon for new arrivals!</p>
        </div>
      `;
      return;
    }

    const seen = new Set();
    const uniqueCars = cars.filter(car => {
      if (!car.id || seen.has(car.id)) return false;
      seen.add(car.id);
      return true;
    });

    uniqueCars.forEach(car => {
      grid.appendChild(createCard(car));
    });
  }

  /* ---------- modal quick view ---------- */
  function setupQuickView() {
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-icon[data-car-id]');
      if (!btn) return;

      const carId = btn.dataset.carId;

      // Fetch single vehicle from API
      try {
        const response = await fetch(`/api/vehicles/${carId}`);
        if (!response.ok) {
          console.error('Failed to fetch vehicle for quick view');
          return;
        }
        const data = await response.json();
        const car = normalizeVehicle(data);
        showQuickViewModal(car);
      } catch (err) {
        console.error('Error fetching vehicle for quick view:', err);
      }
    });
  }

  function showQuickViewModal(car) {
    const existingModal = document.getElementById('quick-view-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'quick-view-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <button class="modal-close" aria-label="Close modal">&times;</button>
        <div class="modal-body">
          <img src="${getPrimaryImage(car)}" alt="${car.year} ${car.make} ${car.model}" class="modal-image">
          <div class="modal-details">
            <h2>${car.year} ${car.make} ${car.model}${car.trim ? ' ' + car.trim : ''}</h2>
            <p class="modal-price">${formatPrice(car.price)}</p>
            <p class="modal-mileage">${formatMileage(car.mileage)}</p>
            <p class="modal-description">${car.description || 'Contact us for more details.'}</p>
            <a href="vehicle.html?id=${car.id}" class="btn btn-primary">View Full Details</a>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('modal-close')) {
        modal.remove();
      }
    });

    document.addEventListener('keydown', function closeOnEsc(e) {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', closeOnEsc);
      }
    });
  }

  /* ---------- mobile nav ---------- */
  function setupMobileNav() {
    const toggle = document.getElementById('mobile-menu-toggle');
    const panel = document.getElementById('mobile-nav');

    if (!toggle || !panel) return;

    function setOpen(isOpen) {
      toggle.setAttribute('aria-expanded', String(isOpen));
      panel.setAttribute('aria-hidden', String(!isOpen));
      panel.classList.toggle('open', isOpen);
    }

    toggle.addEventListener('click', () => {
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      setOpen(!isOpen);
    });

    panel.addEventListener('click', (e) => {
      const link = e.target.closest('.mobile-nav-link');
      if (!link) return;
      setOpen(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(false);
    });
  }

  /* ---------- financing calculator ---------- */
  function setupFinancingCalculator() {
    const priceEl = document.getElementById('calc-price');
    const downEl = document.getElementById('calc-down');
    const rateEl = document.getElementById('calc-rate');
    const termEl = document.getElementById('calc-term');
    const btnEl = document.getElementById('calc-button');

    const outPayment = document.getElementById('result-payment');
    const outLoan = document.getElementById('result-loan');
    const outApr = document.getElementById('result-apr');
    const outTerm = document.getElementById('result-term');
    const outInterest = document.getElementById('result-interest');
    const outTotal = document.getElementById('result-total');

    if (!priceEl || !downEl || !rateEl || !termEl || !btnEl) return;
    if (!outPayment || !outLoan || !outApr || !outTerm || !outInterest || !outTotal) return;

    function money(n) {
      const num = Number(n);
      if (!isFinite(num)) return '$0';
      return '$' + num.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    }

    function compute() {
      const price = Math.max(0, Number(priceEl.value) || 0);
      const down = Math.max(0, Number(downEl.value) || 0);
      const apr = clampNumber(rateEl.value, 0, 30);
      const termMonths = Math.max(1, Number(termEl.value) || 60);

      const loan = Math.max(0, price - down);

      // Monthly interest rate
      const r = (apr / 100) / 12;

      let payment = 0;
      let totalPaid = 0;
      let totalInterest = 0;

      if (loan === 0) {
        payment = 0;
        totalPaid = 0;
        totalInterest = 0;
      } else if (r === 0) {
        payment = loan / termMonths;
        totalPaid = payment * termMonths;
        totalInterest = totalPaid - loan;
      } else {
        // amortization: P = L * r(1+r)^n / ((1+r)^n - 1)
        const pow = Math.pow(1 + r, termMonths);
        payment = loan * (r * pow) / (pow - 1);
        totalPaid = payment * termMonths;
        totalInterest = totalPaid - loan;
      }

      outPayment.textContent = money(payment);
      outLoan.textContent = money(loan);
      outApr.textContent = `${apr.toFixed(1)}%`;
      outTerm.textContent = `${termMonths} months`;
      outInterest.textContent = money(totalInterest);
      outTotal.textContent = money(totalPaid);
    }

    btnEl.addEventListener('click', compute);

    // Live updates (keeps it feeling modern)
    [priceEl, downEl, rateEl, termEl].forEach(el => {
      el.addEventListener('input', () => compute());
      el.addEventListener('change', () => compute());
    });

    compute();
  }

  /* ---------- init ---------- */
  function init() {
    renderInventory();
    setupQuickView();
    setupMobileNav();
    setupFinancingCalculator();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
