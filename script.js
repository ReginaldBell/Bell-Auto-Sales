  function getImageUrl(val) {
    if (typeof val === 'string' && val.trim()) {
      const s = val.trim();
      // If it looks like a filename (no slash, no http), prepend /uploads/
      if (!/^https?:\/\//.test(s) && !s.startsWith('/') && !s.includes('cloudinary.com')) {
        return `/uploads/${s}`;
      }
      return s;
    }
    if (val && typeof val === 'object') return val.url || val.secure_url || '';
    return '';
  }

  function normalizeImageArray(input) {
    let arr = [];
    if (Array.isArray(input)) {
      arr = input;
    } else if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input);
        if (Array.isArray(parsed)) arr = parsed;
        else if (typeof parsed === 'object' && parsed !== null) arr = [parsed];
        else if (typeof parsed === 'string') arr = [parsed];
      } catch {
        if (input.trim()) arr = [input.trim()];
        else return [];
      }
    } else if (input && typeof input === 'object') {
      arr = [input];
    } else {
      return [];
    }
    // Only return string URLs
    return arr.map(val => {
      if (typeof val === 'string' && val.trim()) return val.trim();
      if (val && typeof val === 'object') return val.url || val.secure_url || '';
      return '';
    }).filter(Boolean);
  }
/* ==============================
   HOMEPAGE INVENTORY + UI
   B & S Auto Sales
   ============================== */

(function () {
  'use strict';

  // Shared placeholder image for vehicles with no images
  const PLACEHOLDER_URL = 'https://res.cloudinary.com/dglr2nch4/image/upload/v1765778518/icons8-image-not-available-96_vgxpyr.png';

  /* ---------- helpers ---------- */

  /**
   * Convert API response (snake_case) to frontend format (camelCase)
   */
  function normalizeVehicle(v) {
    // Prefer v.images if present, else v.images_json
    const images = normalizeImageArray(v.images || v.images_json);
    // Healthcheck: log normalized images array length and first URL (once per page load)
    if (!window.__BAS_IMAGES_HEALTHCHECK_LOGGED) {
      console.log('[HEALTHCHECK][NORMALIZED IMAGES]', {
        length: images.length,
        first: images[0] || null
      });
      window.__BAS_IMAGES_HEALTHCHECK_LOGGED = true;
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
      mainImage: images[0] || ''
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
      // [HEALTHCHECK][FRONTEND RECEIVE] Log raw API response
      console.log('[HEALTHCHECK][FRONTEND RECEIVE] Raw API data:', data);
      data.forEach((v, idx) => {
        let parsedImages = null;
        try { parsedImages = v.images_json ? JSON.parse(v.images_json) : v.images; } catch (e) { parsedImages = 'PARSE_ERROR'; }
        console.log(`[HEALTHCHECK][FRONTEND RECEIVE] Vehicle ID=${v.id}:`, {
          images_json: v.images_json,
          images: v.images,
          parsed: parsedImages,
          isArray: Array.isArray(parsedImages),
          looksLikeCloudinary: Array.isArray(parsedImages) ? parsedImages.some(img => (typeof img === 'string' ? img : img?.url)?.includes('cloudinary')) : false
        });
      });
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
    return PLACEHOLDER_URL;
  }

  function getImageUrlFromCar(car) {
    let candidate = car?.mainImage ?? car?.images;

    if (Array.isArray(candidate)) {
      candidate = candidate[0];
    }

    if (candidate && typeof candidate === 'object') {
      candidate = candidate.url || candidate.secure_url || '';
    }

    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }

    return PLACEHOLDER_URL;
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

  /**
   * Strip price-like tokens from a string (e.g., "5999", "$5,999")
   * Used to sanitize model/trim fields that may accidentally contain prices
   */
  function stripPriceLikeTokens(str) {
    if (!str) return '';
    // Remove $XXX patterns and standalone 4-6 digit numbers (likely prices)
    // Preserves model numbers like "F-150", "RX 350" (3 digits or hyphenated)
    return str.replace(/\$[\d,]+|\b\d{4,6}\b/g, '').replace(/\s+/g, ' ').trim();
  }

  function clampNumber(n, min, max) {
    const num = Number(n);
    if (isNaN(num)) return min;
    return Math.min(Math.max(num, min), max);
  }

  /* ---------- card builder ---------- */
  /**
   * STATUS BEHAVIOR: All vehicles are shown regardless of status.
   * Sold vehicles are clearly marked with a red "SOLD" badge.
   * Pending vehicles show a yellow "PENDING" badge.
   * Available vehicles show a green "AVAILABLE" badge.
   */
  function createCard(car) {
        // Contract guard: warn if images contains non-strings
        if (Array.isArray(car.images) && car.images.some(img => typeof img !== 'string')) {
          console.warn('[INVENTORY][CONTRACT DRIFT] images contain non-strings', car.images);
        }
    const card = document.createElement('div');
    card.className = 'vehicle-card car-card';
    card.dataset.carId = car.id;

    // Determine status badge class and text
    const status = (car.status || 'available').toLowerCase();
    let statusClass = 'badge-available';
    let statusText = 'Available';
    
    if (status === 'sold') {
      statusClass = 'badge-sold';
      statusText = 'Sold';
    } else if (status === 'pending') {
      statusClass = 'badge-pending';
      statusText = 'Pending';
    }


    // [HEALTHCHECK][RENDER SRC] Log what image src will be used for this card
    const imgSrc = getImageUrlFromCar(car);
    console.log(`[HEALTHCHECK][RENDER SRC] Card for ID=${car.id}:`, {
      'car.images': car.images,
      'car.images?.[0]': car.images?.[0],
      'finalSrc': imgSrc,
      'isPlaceholder': imgSrc === PLACEHOLDER_URL,
      'looksLikeCloudinary': typeof imgSrc === 'string' && imgSrc.includes('cloudinary')
    });

    card.innerHTML = `
      <div class="vehicle-image-container car-image-wrap car-image-inner">
        <img 
          src="${imgSrc}" 
          alt="${car.year} ${car.make} ${car.model}" 
          class="vehicle-image car-image"
          loading="lazy"
          onerror="console.log('[HEALTHCHECK][ONERROR] Image failed to load:', this.src); this.onerror=null;this.src='${PLACEHOLDER_URL}';"
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
        <h3 class="vehicle-title car-title">${car.year} ${stripPriceLikeTokens(car.make)} ${stripPriceLikeTokens(car.model)}${car.trim ? ' ' + stripPriceLikeTokens(car.trim) : ''}</h3>
        <div class="vehicle-price car-price">${formatPrice(car.price)}</div>
        <p class="vehicle-description car-description">${car.description || 'Well-maintained vehicle ready for its next owner. Reach out for details.'}</p>
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
          <a href="vehicle.html?id=${car.id}" class="btn btn-primary">See Full Details</a>
          <button class="btn btn-secondary btn-icon" aria-label="Quick view" data-car-id="${car.id}">👁️</button>
        </div>
        <div class="dealer-badge">
          Listed by B &amp; S Auto Sales
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
          <h3>No vehicles right now</h3>
          <p>We're always adding new arrivals—check back soon!</p>
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
          <img src="${getImageUrlFromCar(car)}" alt="${car.year} ${car.make} ${car.model}" class="modal-image">
          <div class="modal-details">
            <h2>${car.year} ${stripPriceLikeTokens(car.make)} ${stripPriceLikeTokens(car.model)}${car.trim ? ' ' + stripPriceLikeTokens(car.trim) : ''}</h2>
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

  /* ---------- contact form ---------- */
  function setupContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    const submitBtn = document.getElementById('contact-submit');
    const feedback = document.getElementById('contact-feedback');
    const vehicleSelect = document.getElementById('car-interest');

    // Populate vehicle dropdown with current inventory
    populateVehicleDropdown();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Disable button and show loading state
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
      }
      hideFeedback();

      // Gather form data
      const formData = new FormData(form);
      const name = (formData.get('name') || '').toString().trim();
      const phone = (formData.get('phone') || '').toString().trim();
      const message = (formData.get('message') || '').toString().trim();
      const website = (formData.get('website') || '').toString(); // honeypot
      const vehicleValue = (formData.get('car-interest') || '').toString();

      // Parse vehicle selection (format: "id|title" or just "General Inquiry")
      let vehicleId = null;
      let vehicleTitle = '';
      if (vehicleValue && vehicleValue !== 'General Inquiry') {
        const parts = vehicleValue.split('|');
        if (parts.length === 2) {
          vehicleId = parseInt(parts[0], 10) || null;
          vehicleTitle = parts[1];
        } else {
          vehicleTitle = vehicleValue;
        }
      } else if (vehicleValue === 'General Inquiry') {
        vehicleTitle = 'General Inquiry';
      }

      // Client-side validation
      if (!name || !phone || !message) {
        showFeedback('Please fill in all required fields.', 'error');
        resetButton();
        return;
      }

      // Basic phone validation (digits, spaces, dashes, parens, plus, dots)
      const phoneClean = phone.replace(/[\s\-().+]/g, '');
      if (phoneClean.length < 7 || !/^\d+$/.test(phoneClean)) {
        showFeedback('Please enter a valid phone number.', 'error');
        resetButton();
        return;
      }

      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            phone,
            message,
            vehicleId,
            vehicleTitle,
            website // honeypot
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          showFeedback('Message sent! We\'ll get back to you soon.', 'success');
          form.reset();
          // Re-populate dropdown after reset
          populateVehicleDropdown();
        } else if (response.status === 429) {
          showFeedback('Too many messages sent. Please try again later.', 'error');
        } else {
          const errorMsg = data.details?.[0]?.message || data.error || 'Failed to send message.';
          showFeedback(errorMsg, 'error');
        }
      } catch (err) {
        console.error('Contact form error:', err);
        showFeedback('Network error. Please try again.', 'error');
      }

      resetButton();
    });

    function showFeedback(msg, type) {
      if (!feedback) return;
      feedback.textContent = msg;
      feedback.className = 'form-feedback show ' + type;
    }

    function hideFeedback() {
      if (!feedback) return;
      feedback.textContent = '';
      feedback.className = 'form-feedback';
    }

    function resetButton() {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send My Message';
      }
    }

    async function populateVehicleDropdown() {
      if (!vehicleSelect) return;
      
      // Keep the default options
      vehicleSelect.innerHTML = `
        <option value="">Select a vehicle</option>
        <option value="General Inquiry">General Inquiry</option>
      `;

      try {
        const cars = await fetchVehiclesFromAPI();
        cars.forEach(car => {
          // Only show available/pending vehicles in dropdown
          if (car.status === 'sold') return;
          
          const title = `${car.year} ${stripPriceLikeTokens(car.make)} ${stripPriceLikeTokens(car.model)}${car.trim ? ' ' + stripPriceLikeTokens(car.trim) : ''}`;
          const option = document.createElement('option');
          option.value = `${car.id}|${title}`;
          option.textContent = title;
          vehicleSelect.appendChild(option);
        });
      } catch (err) {
        console.error('Failed to populate vehicle dropdown:', err);
      }
    }
  }

  /* ---------- init ---------- */
  function init() {
    renderInventory();
    setupQuickView();
    setupMobileNav();
    setupContactForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
