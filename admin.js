// ============================================================================
// Admin Dashboard JavaScript (API + SQLite Version)
// Secure authentication with session cookies and CSRF protection
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Shared placeholder image for vehicles with no images
  const PLACEHOLDER_URL = 'https://res.cloudinary.com/dglr2nch4/image/upload/v1765778518/icons8-image-not-available-96_vgxpyr.png';

  // ----------------------------------------------------------------------------
  // Admin State
  // ----------------------------------------------------------------------------
  const AdminState = {
    cars: [],
    isLoggedIn: false,
    editingCarId: null,
    csrfToken: null, // CSRF token from server

    // Detected API/DB shape from GET /api/vehicles (first row)
    apiKeys: null,              // Set<string>
    imagesStorage: 'images',    // 'images' | 'images_json' | 'image_url' | 'none'
    casing: 'snake',            // 'snake' | 'camel' | 'unknown'
    imagesTouched: false        // Track if images were intentionally changed
    , vehiclesFetchSeq: 0      // Sequence number for fetchCarsAndRender race protection
  };

  // ----------------------------------------------------------------------------
  // API helpers
  // ----------------------------------------------------------------------------
  // Use relative paths for same-origin requests (avoids CORS issues entirely)
  const API = {
    list: () => '/api/vehicles',
    one: (id) => `/api/vehicles/${id}`,
    login: () => '/api/admin/login',
    logout: () => '/api/admin/logout',
    session: () => '/api/admin/session',
    csrf: () => '/api/admin/csrf-token'
  };

// Helper: fetch JSON with credentials and error handling
async function requestJson(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    ...options
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json();
}

  // ----------------------------------------------------------------------------
  // Payload builder (UI -> API)
  // ----------------------------------------------------------------------------
  function buildPayloadForApi(carData) {
    const keys = AdminState.apiKeys;
    const casing = AdminState.casing;
    const imagesStorage = AdminState.imagesStorage;

    const payload = {};

    function maybeSet(k, v) {
      if (keys && !keys.has(k)) return;
      payload[k] = v;
    }

    const schemaUnknown = !keys;

    function setCore(k, v) {
      if (schemaUnknown) payload[k] = v;
      else maybeSet(k, v);
    }

    const kExterior = casing === 'camel' ? 'exteriorColor' : 'exterior_color';
    const kInterior = casing === 'camel' ? 'interiorColor' : 'interior_color';
    const kFuel = casing === 'camel' ? 'fuelType' : 'fuel_type';

    setCore('year', Number(carData.year) || 0);
    setCore('make', carData.make || '');
    setCore('model', carData.model || '');
    setCore('trim', carData.trim || '');
    setCore('price', Number(carData.price) || 0);
    setCore('mileage', Number(carData.mileage) || 0);
    setCore('description', carData.description || '');

    if (schemaUnknown || keys.has(kExterior)) maybeSet(kExterior, carData.exteriorColor || '');
    if (schemaUnknown || keys.has(kInterior)) maybeSet(kInterior, carData.interiorColor || '');
    if (schemaUnknown || keys.has(kFuel)) maybeSet(kFuel, carData.fuelType || '');

    if (schemaUnknown || keys.has('transmission')) maybeSet('transmission', carData.transmission || '');
    if (schemaUnknown || keys.has('engine')) maybeSet('engine', carData.engine || '');
    if (schemaUnknown || keys.has('drivetrain')) maybeSet('drivetrain', carData.drivetrain || '');

    // Only include image fields if admin explicitly touched images
    if (AdminState.imagesTouched === true) {
      const imagesArr = Array.isArray(carData.images)
        ? carData.images.filter(Boolean)
        : [];

      if (imagesStorage === 'images_json') {
        payload.images_json = JSON.stringify(imagesArr);
      } else if (imagesStorage === 'images') {
        payload.images = imagesArr;
      } else if (imagesStorage === 'image_url') {
        payload.image_url = imagesArr[0] || '';
      }
    }
    return payload;
  }

  // Detect API schema from a row
  function detectApiSchemaFromRow(row) {
    AdminState.apiKeys = new Set(Object.keys(row));
    if ('exteriorColor' in row || 'interiorColor' in row || 'fuelType' in row) {
      AdminState.casing = 'camel';
    } else if ('exterior_color' in row || 'interior_color' in row || 'fuel_type' in row) {
      AdminState.casing = 'snake';
    } else {
      AdminState.casing = 'unknown';
    }
    if ('images_json' in row) {
      AdminState.imagesStorage = 'images_json';
    } else if ('images' in row) {
      AdminState.imagesStorage = 'images';
    } else if ('image_url' in row) {
      AdminState.imagesStorage = 'image_url';
    } else {
      AdminState.imagesStorage = 'none';
    }
  }

  // Normalize car row from API for UI
  function normalizeCarFromApi(row) {
    const casing = AdminState.casing;
    const imagesStorage = AdminState.imagesStorage;
    const car = { ...row };
    // Normalize color/fuel fields
    car.exteriorColor = casing === 'camel' ? row.exteriorColor : row.exterior_color;
    car.interiorColor = casing === 'camel' ? row.interiorColor : row.interior_color;
    car.fuelType = casing === 'camel' ? row.fuelType : row.fuel_type;
    // Normalize images
    let images = [];
    if (imagesStorage === 'images_json') {
      try {
        images = JSON.parse(row.images_json || '[]');
      } catch {
        images = [];
      }
    } else if (imagesStorage === 'images') {
      images = Array.isArray(row.images) ? row.images : [];
    } else if (imagesStorage === 'image_url') {
      images = row.image_url ? [row.image_url] : [];
    }
    car.images = images;
    // mainImage: string URL
    if (images.length > 0) {
      if (typeof images[0] === 'string') car.mainImage = images[0];
      else if (images[0] && typeof images[0] === 'object' && images[0].url) car.mainImage = images[0].url;
      else car.mainImage = '';
    } else {
      car.mainImage = '';
    }
    return car;
  }

  async function fetchCarsAndRender() {
    AdminState.vehiclesFetchSeq = (AdminState.vehiclesFetchSeq || 0) + 1;
    const seq = AdminState.vehiclesFetchSeq;
    try {
      const list = await requestJson(API.list(), { method: 'GET' });
      // Only update if this is the latest fetch
      if (seq === AdminState.vehiclesFetchSeq) {
        if (Array.isArray(list) && list.length > 0) {
          detectApiSchemaFromRow(list[0]);
        }
        AdminState.cars = Array.isArray(list) ? list.map(normalizeCarFromApi) : [];
        renderAdminInventory();
      }
    } catch (err) {
      // Only handle error if this is the latest fetch
      if (seq !== AdminState.vehiclesFetchSeq) return;
      let status = null;
      if (err && typeof err.message === 'string') {
        const match = err.message.match(/^HTTP (\d{3})/);
        if (match) status = parseInt(match[1], 10);
      }
      if (status === 401) {
        AdminState.isLoggedIn = false;
        showLoginScreen();
        alert('Session expired or not authenticated. Please log in again.');
      } else if (status === 403) {
        alert('Access forbidden or CSRF error. Please refresh and try again.');
      } else {
        alert('Could not load inventory from the server. Check your connection or try again later.');
      }
      // Do NOT clear AdminState.cars or the DOM on GET failure
      console.error('Failed to load vehicles from API:', err);
    }
  }

  // ----------------------------------------------------------------------------
  // Elements
  // ----------------------------------------------------------------------------
  const loginScreen = document.getElementById('login-screen');
  const adminDashboard = document.getElementById('admin-dashboard');
  const loginForm = document.getElementById('login-form');
  const loginError = document.createElement('div');
  loginError.className = 'login-error';
  loginError.style.color = '#721c24';
  loginError.style.marginTop = '8px';
  if (loginForm) loginForm.appendChild(loginError);

  const addCarForm = document.getElementById('add-car-form');
  const inventoryTbody = document.querySelector('.inventory-table tbody');
  const previewContainer = document.getElementById('preview-container');

  const fieldYear = document.getElementById('car-year');
  const fieldMake = document.getElementById('car-make');
  const fieldModel = document.getElementById('car-model');
  const fieldTrim = document.getElementById('car-trim');
  const fieldPrice = document.getElementById('car-price');
  const fieldMileage = document.getElementById('car-mileage');
  const fieldStatus = document.getElementById('car-status');
  const fieldImage = document.getElementById('car-image');
  const fieldImageUrl = document.getElementById('car-image-url');
  const imageError = document.getElementById('image-error');
  const fieldDescription = document.getElementById('car-description');
  const fieldExteriorColor = document.getElementById('exteriorColor');
  const fieldInteriorColor = document.getElementById('interiorColor');
  const fieldFuelType = document.getElementById('fuelType');
  const fieldTransmission = document.getElementById('transmission');
  const fieldEngine = document.getElementById('engine');
  const fieldDrivetrain = document.getElementById('drivetrain');
  const fieldFeatures = document.getElementById('car-features');

  // ----------------------------------------------------------------------------
  // Format helpers
  // ----------------------------------------------------------------------------
  function formatPrice(num) {
    return `$${Number(num || 0).toLocaleString()}`;
  }
  function formatMileage(num) {
    return Number(num || 0).toLocaleString();
  }

  // ----------------------------------------------------------------------------
  // Image helpers (URL-only for persistence)
  // ----------------------------------------------------------------------------
  function isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
      const u = new URL(url);
      const ext = u.pathname.split('.').pop().toLowerCase();
      return ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
    } catch {
      return false;
    }
  }

  function setImageError(msg) {
    if (!imageError) return;
    imageError.textContent = msg || '';
    imageError.style.display = msg ? 'block' : 'none';
  }

  // ----------------------------------------------------------------------------
  // Login handling
  // ----------------------------------------------------------------------------
  function showLoginScreen() {
    if (loginScreen && loginScreen.style) loginScreen.style.display = 'flex';
    if (adminDashboard && adminDashboard.style) adminDashboard.style.display = 'none';
  }

  function showDashboard() {
    if (loginScreen && loginScreen.style) loginScreen.style.display = 'none';
    if (adminDashboard && adminDashboard.style) adminDashboard.style.display = 'block';
  }

  async function handleLoginFormSubmit(e) {
    e.preventDefault();
    if (!loginForm) return;

    const passwordInput = loginForm.querySelector('#login-password');
    const password = passwordInput ? passwordInput.value : '';

    if (!password) {
      loginError.textContent = 'Please enter the admin password';
      return;
    }

    try {
      loginError.textContent = 'Logging in...';
      
      const res = await fetch(API.login(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: passwordInput.value })
      });

      // Handle rate limiting (429)
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        loginError.textContent = data.error || 'Too many login attempts. Please wait and try again.';
        console.warn('[Auth] Rate limit exceeded');
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        // Specific error messages based on status
        if (res.status === 401) {
          loginError.textContent = data.error || 'Invalid password';
          console.warn('[Auth] Invalid password attempt');
        } else if (res.status === 500) {
          loginError.textContent = 'Server error. Please try again later.';
          console.error('[Auth] Server error:', data);
        } else {
          loginError.textContent = data.error || 'Login failed';
          console.error('[Auth] Unexpected error:', res.status, data);
        }
        return;
      }

      // Login successful
      console.log('[Auth] Login successful');
      AdminState.isLoggedIn = true;
      AdminState.csrfToken = data.csrfToken;
      loginError.textContent = '';
      
      // Clear password field
      if (passwordInput) passwordInput.value = '';
      
      showDashboard();
      fetchCarsAndRender();
    } catch (err) {
      console.error('[Auth] Login network error:', err);
      // Distinguish between network errors and other issues
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        loginError.textContent = 'Cannot connect to server. Is it running on port 8080?';
      } else {
        loginError.textContent = 'Login failed. Check your connection.';
      }
    }
  }

  async function handleLogout() {
    try {
      await fetch(API.logout(), {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error('Logout error:', err);
    }
    
    AdminState.isLoggedIn = false;
    AdminState.csrfToken = null;
    AdminState.cars = [];
    showLoginScreen();
  }

  // Check for existing session on page load
  async function checkExistingSession() {
    try {
      console.log('[Auth] Checking existing session...');
      const res = await fetch(API.session(), { credentials: 'include' });
      
      if (!res.ok) {
        console.warn('[Auth] Session check returned:', res.status);
        return false;
      }
      
      const data = await res.json();
      
      if (data.authenticated) {
        console.log('[Auth] Existing session found, restoring...');
        AdminState.isLoggedIn = true;
        // Fetch CSRF token for the existing session
        await fetchCsrfToken();
        showDashboard();
        fetchCarsAndRender();
        return true;
      }
      console.log('[Auth] No active session');
    } catch (err) {
      console.error('[Auth] Session check failed:', err);
    }
    return false;
  }

  if (loginForm) loginForm.addEventListener('submit', handleLoginFormSubmit);

  // ----------------------------------------------------------------------------
  // Inventory rendering
  // ----------------------------------------------------------------------------
  function clearInventoryTable() {
    if (!inventoryTbody) return;
    inventoryTbody.innerHTML = '';
  }

  function renderAdminInventory() {
    if (!inventoryTbody) return;
    clearInventoryTable();

    AdminState.cars.forEach((car) => {
      const tr = document.createElement('tr');

      const imgTd = document.createElement('td');
      const thumb = document.createElement('img');
      thumb.src = car.mainImage || (car.images && car.images[0]) || PLACEHOLDER_URL;
      thumb.alt = `${car.make} ${car.model}`;
      thumb.style.width = '60px';
      thumb.style.height = '40px';
      thumb.style.objectFit = 'cover';
      thumb.style.borderRadius = '6px';
      imgTd.appendChild(thumb);
      tr.appendChild(imgTd);

      const idTd = document.createElement('td');
      idTd.textContent = car.id;
      tr.appendChild(idTd);

      const titleTd = document.createElement('td');
      titleTd.textContent = `${car.year} ${car.make} ${car.model}`;
      tr.appendChild(titleTd);

      const priceTd = document.createElement('td');
      priceTd.textContent = formatPrice(car.price);
      tr.appendChild(priceTd);

      const mileageTd = document.createElement('td');
      mileageTd.textContent = `${formatMileage(car.mileage)} mi`;
      tr.appendChild(mileageTd);

      const statusTd = document.createElement('td');
      statusTd.textContent = car.status || 'available';
      tr.appendChild(statusTd);

      const actionsTd = document.createElement('td');

      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.className = 'action-btn btn-edit';
      editBtn.setAttribute('data-action', 'edit');
      editBtn.setAttribute('data-id', car.id);

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'action-btn btn-delete';
      deleteBtn.setAttribute('data-action', 'delete');
      deleteBtn.setAttribute('data-id', car.id);

      actionsTd.appendChild(editBtn);
      actionsTd.appendChild(deleteBtn);

      tr.appendChild(actionsTd);
      inventoryTbody.appendChild(tr);
    });
  }

  if (inventoryTbody) {
    inventoryTbody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      const carId = Number(id);

      if (action === 'edit') enterEditMode(carId);
      if (action === 'delete') deleteCar(carId);
    });
  }

  // ----------------------------------------------------------------------------
  // Add/Edit form
  // ----------------------------------------------------------------------------
  function resetForm() {
    if (!addCarForm) return;
    addCarForm.reset();
    AdminState.editingCarId = null;
    AdminState.imagesTouched = false;

    const submitBtn = addCarForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Add Car';

    setImageError('');
  }

  async function handleAddCarFormSubmit(e) {
    e.preventDefault();
    if (!addCarForm) return;

    // Build FormData for multipart/form-data upload
    const formData = new FormData();

    // Core fields
    formData.append('year', fieldYear.value || '0');
    formData.append('make', (fieldMake.value || '').trim());
    formData.append('model', (fieldModel.value || '').trim());
    formData.append('trim', (fieldTrim.value || '').trim());
    formData.append('price', fieldPrice.value || '0');
    formData.append('mileage', fieldMileage.value || '0');
    formData.append('description', fieldDescription ? (fieldDescription.value || '').trim() : '');
    formData.append('status', fieldStatus ? (fieldStatus.value || 'available') : 'available');

    // Spec fields (snake_case for API)
    formData.append('exterior_color', fieldExteriorColor ? (fieldExteriorColor.value || '').trim() : '');
    formData.append('interior_color', fieldInteriorColor ? (fieldInteriorColor.value || '').trim() : '');
    formData.append('fuel_type', fieldFuelType ? (fieldFuelType.value || '') : '');
    formData.append('transmission', fieldTransmission ? (fieldTransmission.value || '') : '');
    formData.append('engine', fieldEngine ? (fieldEngine.value || '').trim() : '');
    formData.append('drivetrain', fieldDrivetrain ? (fieldDrivetrain.value || '') : '');

    // Images: file uploads
    const hasFiles = fieldImage && fieldImage.files && fieldImage.files.length > 0;
    if (hasFiles) {
      // Validate file types
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      for (const file of fieldImage.files) {
        if (!allowedTypes.includes(file.type)) {
          setImageError('Only JPG, PNG, and WEBP images are allowed.');
          return;
        }
        formData.append('images', file);
      }
      setImageError('');
    }

    // Images: URL (optional, can be combined with file uploads)
    const imageUrl = fieldImageUrl ? (fieldImageUrl.value || '').trim() : '';
    if (imageUrl) {
      if (!isValidImageUrl(imageUrl)) {
        setImageError('Unsupported image URL format. Use a direct JPG/PNG/WEBP URL.');
        return;
      }
      formData.append('image_url', imageUrl);
      setImageError('');
    }

    try {
      const url = AdminState.editingCarId ? API.one(AdminState.editingCarId) : API.list();
      const method = AdminState.editingCarId ? 'PUT' : 'POST';

      // Ensure we have a CSRF token
      if (!AdminState.csrfToken) {
        await fetchCsrfToken();
      }

      const res = await fetch(url, {
        method,
        headers: {
          'X-CSRF-Token': AdminState.csrfToken || ''
        },
        body: formData,  // Do NOT set Content-Type header; browser sets it with boundary
        credentials: 'include'
      });

      // Handle auth/CSRF errors
      if (res.status === 401) {
        AdminState.isLoggedIn = false;
        showLoginScreen();
        alert('Session expired. Please log in again.');
        return;
      }

      if (res.status === 403) {
        // Might be CSRF error - refresh token and retry
        await fetchCsrfToken();
        const retryRes = await fetch(url, {
          method,
          headers: { 'X-CSRF-Token': AdminState.csrfToken || '' },
          body: formData,
          credentials: 'include'
        });
        if (!retryRes.ok) {
          const text = await retryRes.text();
          throw new Error(`HTTP ${retryRes.status}: ${text}`);
        }
      } else if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      await fetchCarsAndRender();
      resetForm();
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save vehicle. ' + err.message);
    }
  }

  if (addCarForm) addCarForm.addEventListener('submit', handleAddCarFormSubmit);

  function enterEditMode(carId) {
    const car = AdminState.cars.find(c => c.id === carId);
    if (!car) return;

    AdminState.editingCarId = carId;
    AdminState.imagesTouched = false;

    fieldYear.value = car.year || '';
    fieldMake.value = car.make || '';
    fieldModel.value = car.model || '';
    fieldTrim.value = car.trim || '';
    fieldPrice.value = car.price || '';
    fieldMileage.value = car.mileage || '';
    if (fieldStatus) fieldStatus.value = car.status || 'available';
    if (fieldDescription) fieldDescription.value = car.description || '';
    if (fieldFeatures) fieldFeatures.value = (car.features || []).join(', ');
    if (fieldExteriorColor) fieldExteriorColor.value = car.exteriorColor || '';
    if (fieldInteriorColor) fieldInteriorColor.value = car.interiorColor || '';
    if (fieldFuelType) fieldFuelType.value = car.fuelType || '';
    if (fieldTransmission) fieldTransmission.value = car.transmission || '';
    if (fieldEngine) fieldEngine.value = car.engine || '';
    if (fieldDrivetrain) fieldDrivetrain.value = car.drivetrain || '';

    const submitBtn = addCarForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Update Car';

    updatePreviewWithCar(car);
  }

  async function deleteCar(carId) {
    const ok = confirm('Are you sure you want to delete this car?');
    if (!ok) return;

    try {
      await requestJson(API.one(carId), { method: 'DELETE' });
      await fetchCarsAndRender();
      if (AdminState.editingCarId === carId) resetForm();
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete vehicle. Check server logs/terminal for details.');
    }
  }

  // ----------------------------------------------------------------------------
  // Live Preview
  // ----------------------------------------------------------------------------
  function updatePreviewWithCar(car) {
    if (!previewContainer) return;
    previewContainer.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'car-card vehicle-card';

    const imgDiv = document.createElement('div');
    imgDiv.className = 'car-image vehicle-image';

    let images = [];
    if (car.images && car.images.length) images = car.images.slice();
    else if (car.mainImage) images = [car.mainImage];
    else images = [PLACEHOLDER_URL];

    const inner = document.createElement('div');
    inner.className = 'car-image-inner vehicle-image-inner';

    const mainImg = document.createElement('img');
    mainImg.src = images[0] || PLACEHOLDER_URL;
    mainImg.alt = `${car.make || ''} ${car.model || ''}`;
    mainImg.style.width = '100%';
    mainImg.style.borderRadius = '8px';
    mainImg.style.display = 'block';
    inner.appendChild(mainImg);

    imgDiv.appendChild(inner);

    if (images.length > 1) {
      const thumbs = document.createElement('div');
      thumbs.style.display = 'flex';
      thumbs.style.gap = '8px';
      thumbs.style.marginTop = '8px';
      images.forEach((src) => {
        const t = document.createElement('img');
        t.src = src;
        t.style.width = '60px';
        t.style.height = '40px';
        t.style.objectFit = 'cover';
        t.style.borderRadius = '4px';
        t.style.cursor = 'pointer';
        t.addEventListener('click', () => { mainImg.src = src; });
        thumbs.appendChild(t);
      });
      imgDiv.appendChild(thumbs);
    }

    const details = document.createElement('div');
    details.className = 'car-details vehicle-info';

    const title = document.createElement('h3');
    title.className = 'car-title vehicle-title';
    title.textContent = `${car.year || ''} ${car.make || ''} ${car.model || ''}`.trim();

    const price = document.createElement('p');
    price.className = 'car-price vehicle-price';
    price.textContent = `$${Number(car.price || 0).toLocaleString()}`;

    const info = document.createElement('div');
    info.className = 'car-info vehicle-specs';

    const mileageSpan = document.createElement('span');
    mileageSpan.className = 'vehicle-mileage car-info-item';
    mileageSpan.textContent = `🚗 ${Number(car.mileage || 0).toLocaleString()} mi`;
    info.appendChild(mileageSpan);

    if (car.trim) {
      const trimSpan = document.createElement('span');
      trimSpan.className = 'vehicle-trim car-info-item';
      trimSpan.textContent = `• ${car.trim}`;
      info.appendChild(trimSpan);
    }

    if (car.fuelType) {
      const fuelSpan = document.createElement('span');
      fuelSpan.className = 'vehicle-fuel car-info-item';
      fuelSpan.textContent = `• ${car.fuelType}`;
      info.appendChild(fuelSpan);
    }

    const statusSpan = document.createElement('span');
    statusSpan.className = 'car-info-item';
    statusSpan.textContent = car.status || 'available';
    info.appendChild(statusSpan);

    details.appendChild(title);
    details.appendChild(info);
    details.appendChild(price);

    if (car.description) {
      const desc = document.createElement('p');
      desc.className = 'car-description vehicle-desc';
      desc.textContent = car.description;
      details.appendChild(desc);
    }

    card.appendChild(imgDiv);
    card.appendChild(details);
    previewContainer.appendChild(card);
  }

  function setupLivePreview() {
    const fields = [fieldYear, fieldMake, fieldModel, fieldPrice, fieldMileage, fieldStatus];
    fields.forEach((f) => {
      if (!f) return;
      f.addEventListener('input', () => {
        const car = {
          year: Number(fieldYear.value) || 0,
          make: (fieldMake.value || '').trim(),
          model: (fieldModel.value || '').trim(),
          price: Number(fieldPrice.value) || 0,
          mileage: Number(fieldMileage.value) || 0,
          status: fieldStatus ? (fieldStatus.value || 'available') : 'available',
          mainImage: PLACEHOLDER_URL
        };
        updatePreviewWithCar(car);
      });
    });

    // URL preview only (no base64 file preview, to avoid encouraging 413 path)
    if (fieldImageUrl) {
      fieldImageUrl.addEventListener('input', () => {
        const url = (fieldImageUrl.value || '').trim();
        if (!url) return;

        if (!isValidImageUrl(url)) {
          setImageError('Unsupported image URL format — use a direct JPG/PNG/WEBP URL.');
          return;
        }

        setImageError('');
        AdminState.imagesTouched = true;
        const car = {
          year: Number(fieldYear.value) || 0,
          make: (fieldMake.value || '').trim(),
          model: (fieldModel.value || '').trim(),
          price: Number(fieldPrice.value) || 0,
          mileage: Number(fieldMileage.value) || 0,
          status: fieldStatus ? (fieldStatus.value || 'available') : 'available',
          images: [url],
          mainImage: url,
          description: fieldDescription ? (fieldDescription.value || '').trim() : ''
        };
        updatePreviewWithCar(car);
      });
    }

    if (fieldImage) {
      fieldImage.addEventListener('change', () => {
        if (fieldImage.files && fieldImage.files.length > 0) {
          // Validate file types
          const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
          const invalidFiles = Array.from(fieldImage.files).filter(f => !allowedTypes.includes(f.type));
          if (invalidFiles.length > 0) {
            setImageError('Only JPG, PNG, and WEBP images are allowed.');
            return;
          }
          setImageError('');
          AdminState.imagesTouched = true;

          // Show preview of first selected file
          const file = fieldImage.files[0];
          const reader = new FileReader();
          reader.onload = (e) => {
            const car = {
              year: Number(fieldYear.value) || 0,
              make: (fieldMake.value || '').trim(),
              model: (fieldModel.value) || '',
              price: Number(fieldPrice.value) || 0,
              mileage: Number(fieldMileage.value) || 0,
              status: fieldStatus ? (fieldStatus.value || 'available') : 'available',
              images: [e.target.result],
              mainImage: e.target.result,
              description: fieldDescription ? (fieldDescription.value || '').trim() : ''
            };
            updatePreviewWithCar(car);
          };
          reader.readAsDataURL(file);
        } else {
          setImageError('');
        }
      });
    }

    if (fieldDescription) {
      fieldDescription.addEventListener('input', () => {
        const car = {
          year: Number(fieldYear.value) || 0,
          make: (fieldMake.value || '').trim(),
          model: (fieldModel.value || '').trim(),
          price: Number(fieldPrice.value) || 0,
          mileage: Number(fieldMileage.value) || 0,
          status: fieldStatus ? (fieldStatus.value || 'available') : 'available',
          mainImage: PLACEHOLDER_URL,
          description: (fieldDescription.value || '').trim()
        };
        updatePreviewWithCar(car);
      });
    }
  }

  // ----------------------------------------------------------------------------
  // App init
  // ----------------------------------------------------------------------------
  async function init() {
    setupLivePreview();

    // Add logout button handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }

    // Check for existing session first
    const hasSession = await checkExistingSession();
    
    if (!hasSession) {
      showLoginScreen();
    }
  }

  init();
});

// End of admin.js
