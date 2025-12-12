// vehicle.js - Dynamic vehicle detail page functionality

(function() {
  'use strict';

  // ==================== DATA MODEL ====================
  function loadCarsFromStorage() {
    try {
      const raw = localStorage.getItem('bellAutoCars');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed;
    } catch (err) {
      console.warn('Failed to load cars from storage', err);
      return null;
    }
  }

  // Keep a static fallback list in case no localStorage exists (for demo)
  const staticCars = [
    {
      id: 1,
      title: "2020 Honda Accord EX",
      price: 22995,
      status: "Available",
      mainImage: "https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800&h=600&fit=crop",
      thumbnails: [
        "https://images.unsplash.com/photo-1590362891991-f776e747a588?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=200&h=200&fit=crop"
      ],
      specs: {
        year: "2020",
        mileage: "45,000 miles",
        transmission: "Automatic",
        engine: "1.5L Turbocharged I4",
        drivetrain: "Front-Wheel Drive",
        fuelType: "Gasoline",
        exteriorColor: "Modern Steel Metallic",
        stockNumber: "BA2020HA001"
      },
      description: "This 2020 Honda Accord EX is an exceptional value offering reliability, comfort, and modern technology. With only 45,000 miles on the odometer, this sedan has been meticulously maintained and is ready for its next owner. The Accord is known for its excellent fuel economy, spacious interior, and smooth ride quality, making it perfect for both city commuting and highway cruising. The EX trim comes well-equipped with premium features including a touchscreen infotainment system with Apple CarPlay and Android Auto, power moonroof, dual-zone automatic climate control, and Honda Sensing safety suite.",
      features: [
        "Apple CarPlay & Android Auto Integration",
        "Honda Sensing Safety Suite (Collision Mitigation, Lane Keep Assist, Adaptive Cruise Control)",
        "Power Moonroof",
        "Dual-Zone Automatic Climate Control",
        "8-Inch Touchscreen Display",
        "Bluetooth Connectivity",
        "Backup Camera with Dynamic Guidelines",
        "LED Headlights",
        "Push Button Start with Smart Entry",
        "Power Driver's Seat with Lumbar Support",
        "Heated Front Seats",
        "17-Inch Alloy Wheels"
      ]
    },
    {
      id: 2,
      title: "2019 Toyota Camry SE",
      price: 21495,
      status: "Available",
      mainImage: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&h=600&fit=crop",
      thumbnails: [
        "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1623869675781-80aa31af3b4e?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1627454820516-ac6e50b4e1ca?w=200&h=200&fit=crop"
      ],
      specs: {
        year: "2019",
        mileage: "52,000 miles",
        transmission: "Automatic",
        engine: "2.5L 4-Cylinder",
        drivetrain: "Front-Wheel Drive",
        fuelType: "Gasoline",
        exteriorColor: "Celestial Silver Metallic",
        stockNumber: "BA2019TC002"
      },
      description: "The 2019 Toyota Camry SE combines sporty styling with legendary Toyota reliability. This well-maintained sedan features aggressive styling, a comfortable interior, and excellent fuel economy. The SE trim adds sport-tuned suspension, paddle shifters, and unique exterior styling elements that set it apart from the base model. Perfect for drivers who want a reliable daily driver with a touch of sportiness.",
      features: [
        "Sport-Tuned Suspension",
        "Paddle Shifters",
        "Apple CarPlay & Android Auto",
        "Toyota Safety Sense 2.0",
        "Dual-Zone Climate Control",
        "Power Driver Seat",
        "19-Inch Machined Alloy Wheels",
        "LED Daytime Running Lights",
        "Smart Key System",
        "Rear Cross-Traffic Alert",
        "Blind Spot Monitor"
      ]
    },
    {
      id: 3,
      title: "2018 Ford F-150 XLT SuperCrew",
      price: 28995,
      status: "Available",
      mainImage: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&h=600&fit=crop",
      thumbnails: [
        "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1564951434112-64d74cc2a2d7?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=200&h=200&fit=crop"
      ],
      specs: {
        year: "2018",
        mileage: "68,000 miles",
        transmission: "Automatic",
        engine: "3.5L EcoBoost V6",
        drivetrain: "4-Wheel Drive",
        fuelType: "Gasoline",
        exteriorColor: "Magnetic Metallic",
        stockNumber: "BA2018FF003"
      },
      description: "This 2018 Ford F-150 XLT SuperCrew is the ultimate workhorse that doesn't compromise on comfort. Equipped with the powerful 3.5L EcoBoost engine and 4WD, this truck is ready for any job or adventure. The SuperCrew cab provides spacious seating for five adults, making it perfect for both work and family use. Features include SYNC 3 infotainment, a rearview camera, and plenty of interior storage solutions.",
      features: [
        "3.5L EcoBoost Twin-Turbo V6 Engine",
        "4-Wheel Drive",
        "SYNC 3 with 8-Inch Touchscreen",
        "Apple CarPlay & Android Auto",
        "Rearview Camera",
        "Trailer Sway Control",
        "Power Adjustable Pedals",
        "Remote Start System",
        "Cruise Control",
        "Rear Window Defroster",
        "Class IV Trailer Hitch",
        "Spray-In Bedliner"
      ]
    },
    {
      id: 4,
      title: "2021 Mazda CX-5 Grand Touring",
      price: 26995,
      status: "Available",
      mainImage: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&h=600&fit=crop",
      thumbnails: [
        "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1611566026373-c6c8da0ea861?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1617791160588-241658c0f566?w=200&h=200&fit=crop"
      ],
      specs: {
        year: "2021",
        mileage: "32,000 miles",
        transmission: "Automatic",
        engine: "2.5L Turbocharged I4",
        drivetrain: "All-Wheel Drive",
        fuelType: "Gasoline",
        exteriorColor: "Soul Red Crystal Metallic",
        stockNumber: "BA2021MC004"
      },
      description: "The 2021 Mazda CX-5 Grand Touring offers a premium driving experience with its upscale interior, turbocharged engine, and engaging handling. This crossover SUV combines practicality with luxury, featuring leather seats, a Bose sound system, and advanced safety features. With low mileage and excellent condition, this CX-5 is perfect for families or individuals who want a refined driving experience.",
      features: [
        "Turbocharged 2.5L Engine with 250HP",
        "All-Wheel Drive",
        "Leather Interior",
        "10.25-Inch Infotainment Display",
        "Bose 10-Speaker Premium Audio",
        "Power Liftgate",
        "Heated Front Seats",
        "Heated Steering Wheel",
        "Mazda Radar Cruise Control",
        "Lane Keep Assist",
        "Blind Spot Monitoring",
        "19-Inch Alloy Wheels"
      ]
    },
    {
      id: 5,
      title: "2017 Chevrolet Silverado 1500 LT",
      price: 24995,
      status: "Sold",
      mainImage: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&h=600&fit=crop",
      thumbnails: [
        "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1564951434112-64d74cc2a2d7?w=200&h=200&fit=crop"
      ],
      specs: {
        year: "2017",
        mileage: "75,000 miles",
        transmission: "Automatic",
        engine: "5.3L V8",
        drivetrain: "4-Wheel Drive",
        fuelType: "Gasoline",
        exteriorColor: "Summit White",
        stockNumber: "BA2017CS005"
      },
      description: "This 2017 Chevrolet Silverado 1500 LT is a capable full-size truck with the legendary 5.3L V8 engine. With 4WD and a spacious crew cab, it's ready for both work and play. Features include Chevrolet MyLink infotainment, a rearview camera, and comfortable cloth seating. This truck has been well-maintained and is ready for its next owner.",
      features: [
        "5.3L V8 Engine",
        "4-Wheel Drive",
        "Chevrolet MyLink",
        "Rearview Camera",
        "Bluetooth Connectivity",
        "USB Ports",
        "Power Windows and Locks",
        "Cruise Control",
        "Tow/Haul Mode",
        "Chrome Exterior Trim"
      ]
    },
    {
      id: 6,
      title: "2020 Subaru Outback Premium",
      price: 25995,
      status: "Available",
      mainImage: "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&h=600&fit=crop",
      thumbnails: [
        "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1611566026373-c6c8da0ea861?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1617791160588-241658c0f566?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=200&h=200&fit=crop"
      ],
      specs: {
        year: "2020",
        mileage: "38,000 miles",
        transmission: "CVT",
        engine: "2.5L 4-Cylinder",
        drivetrain: "All-Wheel Drive",
        fuelType: "Gasoline",
        exteriorColor: "Autumn Green Metallic",
        stockNumber: "BA2020SO006"
      },
      description: "The 2020 Subaru Outback Premium is the perfect adventure companion with legendary Subaru all-wheel drive and impressive ground clearance. This versatile wagon offers ample cargo space, comfortable seating for five, and advanced safety features. Whether you're commuting to work or heading to the mountains, the Outback delivers confidence and capability.",
      features: [
        "Symmetrical All-Wheel Drive",
        "EyeSight Driver Assist Technology",
        "11.6-Inch Touchscreen",
        "Apple CarPlay & Android Auto",
        "Power Liftgate",
        "Roof Rails",
        "X-Mode with Hill Descent Control",
        "Automatic Climate Control",
        "Heated Front Seats",
        "StarLink Connected Services",
        "8.7 Inches of Ground Clearance"
      ]
    },
    {
      id: 7,
      title: "2019 Jeep Grand Cherokee Limited",
      price: 29995,
      status: "Available",
      mainImage: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&h=600&fit=crop",
      thumbnails: [
        "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1564951434112-64d74cc2a2d7?w=200&h=200&fit=crop"
      ],
      specs: {
        year: "2019",
        mileage: "48,000 miles",
        transmission: "Automatic",
        engine: "3.6L V6",
        drivetrain: "4-Wheel Drive",
        fuelType: "Gasoline",
        exteriorColor: "Diamond Black Crystal Pearl",
        stockNumber: "BA2019JG007"
      },
      description: "This 2019 Jeep Grand Cherokee Limited combines luxury and capability in a timeless package. Equipped with a powerful V6 engine and advanced 4WD system, it's ready for any terrain. The Limited trim features leather seats, a panoramic sunroof, heated seats, and the Uconnect infotainment system. With only 48,000 miles, this Grand Cherokee offers years of reliable service ahead.",
      features: [
        "3.6L Pentastar V6 Engine",
        "Quadra-Trac II 4WD System",
        "Leather-Trimmed Seats",
        "Heated Front and Rear Seats",
        "Dual-Pane Panoramic Sunroof",
        "Uconnect 4C with 8.4-Inch Touchscreen",
        "Apple CarPlay & Android Auto",
        "Alpine Premium Audio System",
        "Power Liftgate",
        "Remote Start",
        "Blind Spot Monitoring",
        "Rear Cross Path Detection"
      ]
    }
  ];

  const cars = loadCarsFromStorage() || staticCars;

  // ==================== HELPER FUNCTIONS ====================
  
  /**
   * Get query parameter value from URL
   * @param {string} name - Parameter name
   * @returns {string|null} Parameter value or null if not found
   */
  function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }

  /**
   * Format price as currency
   * @param {number} value - Price value
   * @returns {string} Formatted price string
   */
  function formatPrice(value) {
    return '$' + value.toLocaleString('en-US');
  }

  /**
   * Render vehicle details to the page
   * @param {object} car - Car object
   */
  function renderVehicle(car) {
    // Set title
    const titleEl = document.getElementById('vehicle-title');
    if (titleEl) {
      titleEl.textContent = car.title;
    }

    // Set price
    const priceEl = document.getElementById('vehicle-price');
    if (priceEl) {
      priceEl.textContent = formatPrice(car.price);
    }

    // Set status
    const statusEl = document.getElementById('vehicle-status');
    if (statusEl) {
      statusEl.textContent = car.status;
      // Remove existing status classes and add appropriate one
      statusEl.classList.remove('sold');
      if (car.status.toLowerCase() === 'sold') {
        statusEl.classList.add('sold');
      }
    }

    // Set subtitle (if exists)
    const subtitleEl = document.getElementById('vehicle-subtitle');
    if (subtitleEl && car.subtitle) {
      subtitleEl.textContent = car.subtitle;
    }

    // Set main image
    const mainImageEl = document.getElementById('vehicle-main-image');
    if (mainImageEl) {
      const primary = car.mainImage || (car.images && car.images.length ? car.images[0] : (car.thumbnails && car.thumbnails[0])) || '';
      mainImageEl.src = primary || '';
      mainImageEl.alt = car.title || '';
    }

    // Render thumbnails
    renderThumbnails(car);

    // Render specs
    renderSpecs(car);

    // Set description
    const descriptionEl = document.getElementById('vehicle-description');
    if (descriptionEl) {
      descriptionEl.textContent = car.description;
    }

    // Render features
    renderFeatures(car);

    // Update CTA button
    updateCTAButton(car);
  }

  /**
   * Render thumbnail images
   * @param {object} car - Car object
   */
  function renderThumbnails(car) {
    const thumbnailsContainer = document.getElementById('vehicle-thumbnails');
    if (!thumbnailsContainer) {
      console.warn('Thumbnails container not found');
      return;
    }

    // Clear existing thumbnails
    thumbnailsContainer.innerHTML = '';

    // Determine sources: support `images` for base64/urls or fallback to `thumbnails` when present
    // Prefer `images` (uploaded or base64) first; if not present but mainImage exists, include it as first thumbnail
    let sources = [];
    if (car.images && car.images.length) {
      sources = car.images.slice();
      if (car.mainImage && sources[0] !== car.mainImage) {
        const idx = sources.indexOf(car.mainImage);
        if (idx > 0) sources.splice(idx, 1);
        sources.unshift(car.mainImage);
      }
    } else if (car.mainImage) {
      const t = car.thumbnails && car.thumbnails.length ? car.thumbnails.slice() : [];
      sources = [car.mainImage].concat(t.filter(Boolean));
    } else {
      sources = car.thumbnails || [];
    }
    // Create thumbnail elements
    sources.forEach((url, index) => {
      const thumbnailDiv = document.createElement('div');
      thumbnailDiv.className = 'vehicle-thumbnail';

      const img = document.createElement('img');
      img.src = url;
      img.alt = `${car.title} thumbnail ${index + 1}`;
      img.dataset.fullUrl = url;

      thumbnailDiv.appendChild(img);
      thumbnailsContainer.appendChild(thumbnailDiv);
    });

    // Add click event listener to thumbnails container (event delegation)
    thumbnailsContainer.addEventListener('click', function(e) {
      const thumbnail = e.target.closest('.vehicle-thumbnail img');
      if (thumbnail) {
        const mainImageEl = document.getElementById('vehicle-main-image');
        if (mainImageEl) {
          mainImageEl.src = thumbnail.dataset.fullUrl || thumbnail.src;
        }
      }
    });
  }

  /**
   * Render vehicle specifications
   * @param {object} car - Car object
   */
  function renderSpecs(car) {
    const specsContainer = document.getElementById('vehicle-specs');
    if (!specsContainer) {
      console.warn('Specs container not found');
      return;
    }

    // Find all spec items and update them
    const specItems = specsContainer.querySelectorAll('.spec-item');
    
    // Create a mapping of spec labels to values
    // Support cars with either a nested `specs` object or properties at top-level
    const specsMap = {
      'year': (car.specs && car.specs.year) || car.year || 'N/A',
      'mileage': (car.specs && car.specs.mileage) || (car.mileage ? `${ Number(car.mileage).toLocaleString() } miles` : 'N/A'),
      'transmission': (car.specs && car.specs.transmission) || car.transmission || 'N/A',
      'engine': (car.specs && car.specs.engine) || car.engine || 'N/A',
      'drivetrain': (car.specs && car.specs.drivetrain) || car.drivetrain || 'N/A',
      'fuel type': (car.specs && car.specs.fuelType) || car.fuelType || 'N/A',
      'exterior color': (car.specs && car.specs.exteriorColor) || car.exteriorColor || 'N/A',
      'interior color': (car.specs && car.specs.interiorColor) || car.interiorColor || 'N/A',
      'stock #': (car.specs && car.specs.stockNumber) || car.stockNumber || 'N/A'
    };

    // Update each spec item
    specItems.forEach(item => {
      const labelEl = item.querySelector('.spec-label');
      const valueEl = item.querySelector('.spec-value');
      
      if (labelEl && valueEl) {
        const labelText = labelEl.textContent.toLowerCase();
        
        // Match the label to the appropriate spec value
        for (const [key, value] of Object.entries(specsMap)) {
          if (labelText === key) {
            valueEl.textContent = value;
            break;
          }
        }
      }
    });
  }

  /**
   * Render vehicle features list
   * @param {object} car - Car object
   */
  function renderFeatures(car) {
    const featuresContainer = document.getElementById('vehicle-features');
    if (!featuresContainer) {
      console.warn('Features container not found');
      return;
    }

    // Clear existing features
    featuresContainer.innerHTML = '';

    // Create list items for each feature
    car.features.forEach(feature => {
      const li = document.createElement('li');
      li.textContent = feature;
      featuresContainer.appendChild(li);
    });
  }

  /**
   * Update CTA button with vehicle title
   * @param {object} car - Car object
   */
  function updateCTAButton(car) {
    const ctaButton = document.querySelector('.vehicle-cta-button');
    if (ctaButton) {
      ctaButton.dataset.vehicleTitle = car.title;
    }
  }

  /**
   * Show vehicle not found message
   */
  function showNotFound() {
    const titleEl = document.getElementById('vehicle-title');
    if (titleEl) {
      titleEl.textContent = 'Vehicle Not Found';
    }

    // Hide other sections
    const priceEl = document.getElementById('vehicle-price');
    if (priceEl) {
      priceEl.style.display = 'none';
    }

    const statusEl = document.getElementById('vehicle-status');
    if (statusEl) {
      statusEl.style.display = 'none';
    }

    const specsEl = document.querySelector('.vehicle-specs');
    if (specsEl) {
      specsEl.style.display = 'none';
    }

    const descriptionEl = document.getElementById('vehicle-description');
    if (descriptionEl) {
      descriptionEl.textContent = 'Sorry, the vehicle you are looking for could not be found. Please return to the inventory page to browse our available vehicles.';
    }

    const featuresEl = document.getElementById('vehicle-features');
    if (featuresEl) {
      featuresEl.innerHTML = '';
    }

    const thumbnailsEl = document.getElementById('vehicle-thumbnails');
    if (thumbnailsEl) {
      thumbnailsEl.innerHTML = '';
    }
  }

  // ==================== INITIALIZATION ====================
  
  /**
   * Initialize the vehicle detail page
   */
  function init() {
    // Get vehicle ID from query parameter
    const vehicleIdParam = getQueryParam('id');
    
    if (!vehicleIdParam) {
      console.warn('No vehicle ID provided in URL');
      showNotFound();
      return;
    }

    // Convert to number
    const vehicleId = parseInt(vehicleIdParam, 10);
    
    if (isNaN(vehicleId)) {
      console.warn('Invalid vehicle ID:', vehicleIdParam);
      showNotFound();
      return;
    }

    // Find the car in the array
    const car = cars.find(c => c.id === vehicleId);
    
    if (!car) {
      console.warn('Vehicle not found for ID:', vehicleId);
      showNotFound();
      return;
    }

    // Render the vehicle
    renderVehicle(car);
  }

  // Run initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

    // custom event from admin for same-tab updates
    window.addEventListener('bellAutoCars:updated', (e) => {
      try {
        const vehicleIdParam = getQueryParam('id'); if (!vehicleIdParam) return;
        const vehicleId = parseInt(vehicleIdParam, 10);
        const newestCars = loadCarsFromStorage() || staticCars;
        const car = newestCars.find(c => c.id === vehicleId);
        if (car) renderVehicle(car);
        else showNotFound();
      } catch (err) { console.warn('Failed to re-render vehicle page after custom event', err); }
    });

  // Listen for storage changes and update the page when the current vehicle data changes
  window.addEventListener('storage', (e) => {
    if (e.key === 'bellAutoCars') {
      const vehicleIdParam = getQueryParam('id');
      if (!vehicleIdParam) return;
      const vehicleId = parseInt(vehicleIdParam, 10);
      const newestCars = loadCarsFromStorage() || staticCars;
      const car = newestCars.find(c => c.id === vehicleId);
      if (car) {
        renderVehicle(car);
      } else {
        showNotFound();
      }
    }
  });

})();