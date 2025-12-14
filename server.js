const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const { doubleCsrf } = require("csrf-csrf");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const { z } = require("zod");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
// const nodemailer = require("nodemailer"); // Replaced by SendGrid
const { sendContactEmail } = require("./utils/sendEmail");
const { cloudinary, uploadBufferToCloudinary } = require("./utils/cloudinary");

const app = express();
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

// Admin password from environment (REQUIRED in production, no fallback)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (isProduction && !ADMIN_PASSWORD) {
  console.error("FATAL: ADMIN_PASSWORD environment variable is required in production");
  process.exit(1);
}
if (!ADMIN_PASSWORD && !isProduction) {
  console.warn("WARNING: ADMIN_PASSWORD not set, using insecure default for development only");
}
const EFFECTIVE_ADMIN_PASSWORD = ADMIN_PASSWORD || "bell1234"; // Dev-only fallback

// Session secret (REQUIRED in production)
const SESSION_SECRET = process.env.SESSION_SECRET;
if (isProduction && !SESSION_SECRET) {
  console.error("FATAL: SESSION_SECRET environment variable is required in production");
  process.exit(1);
}
const EFFECTIVE_SESSION_SECRET = SESSION_SECRET || crypto.randomBytes(32).toString("hex");

/* ======================
   Data Directory (Persistent Storage)
====================== */
const DATA_DIR = process.env.DATA_DIR || __dirname;
if (DATA_DIR !== __dirname) {
  console.log(`Using persistent data directory: ${DATA_DIR}`);
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/* ======================
   Security Defaults
====================== */
app.disable("x-powered-by");

// Trust first proxy in production (for correct client IP from X-Forwarded-For)
// Required for rate limiting to use real client IP behind reverse proxy/load balancer
if (isProduction) {
  app.set("trust proxy", 1);
}

/* ======================
   Audit Logger
====================== */
function auditLog(action, details, req = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    action,
    ...details
  };
  // Add IP from request if provided and not already in details
  if (req && !details.ip) {
    logEntry.ip = req.ip || req.connection?.remoteAddress || 'unknown';
  }
  // Log to console (in production, you'd send this to a log aggregator)
  console.log(`[AUDIT] ${JSON.stringify(logEntry)}`);
}

/* ======================
   Email Configuration (SendGrid API)
====================== */
// Email is now handled via SendGrid in ./utils/sendEmail.js
// Required env vars: SENDGRID_API_KEY, CONTACT_TO, FROM_EMAIL
if (process.env.SENDGRID_API_KEY) {
  console.log(`Email notifications enabled via SendGrid (sending to ${process.env.CONTACT_TO})`);
} else {
  console.log("Email notifications disabled (SENDGRID_API_KEY not configured)");
}

/* ======================
   Uploads Directory
====================== */
const uploadsDir = path.join(DATA_DIR, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/* ======================
   Multer Configuration (Memory Storage for Cloudinary)
====================== */
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error("Only JPG, PNG, and WEBP images are allowed");
    err.code = "INVALID_FILE_TYPE";
    cb(err, false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { 
    fileSize: 15 * 1024 * 1024, // 15 MB per file (allows larger phone photos)
    files: 20 // Max 20 files
  }
});

/* ======================
   Helmet Security Headers
====================== */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for simplicity
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false, // Disable for external images
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow images to load
}));

/* ======================
   CORS Configuration
====================== */
// Build allowed origins from environment variable
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

// Always allow localhost in development
if (!isProduction) {
  allowedOrigins.push(
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`
  );
}

function corsOrigin(origin, callback) {
  // Allow server-to-server or curl (no origin)
  if (!origin) return callback(null, true);

  // Allow configured origins
  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error("CORS not allowed"));
}

const corsOptions = {
  origin: corsOrigin,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  credentials: true,
  maxAge: 86400 // 24 hours
};

// Handle preflight OPTIONS requests
app.options("/*", cors(corsOptions));

app.use(cors(corsOptions));

/* ======================
   Session Configuration
====================== */
const sessionStore = new SQLiteStore({
  db: "sessions.db",
  dir: DATA_DIR,
  table: "sessions"
});

app.use(session({
  store: sessionStore,
  secret: EFFECTIVE_SESSION_SECRET,
  name: "bell_sid", // Custom name (not 'connect.sid')
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiry on activity
  cookie: {
    httpOnly: true,
    secure: isProduction, // HTTPS only in production
    sameSite: isProduction ? "strict" : "lax",
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  }
}));

/* ======================
   CSRF Protection
====================== */
const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => EFFECTIVE_SESSION_SECRET,
  cookieName: isProduction ? "__Host-csrf" : "csrf",
  cookieOptions: {
    httpOnly: true,
    sameSite: isProduction ? "strict" : "lax",
    secure: isProduction,
    path: "/"
  },
  getTokenFromRequest: (req) => {
    // Check header first, then body
    return req.headers["x-csrf-token"] || req.body?._csrf;
  }
});

// CSRF error handler
function csrfErrorHandler(err, req, res, next) {
  if (err.code === "EBADCSRFTOKEN" || err.message?.includes("csrf")) {
    auditLog("CSRF_VIOLATION", { ip: req.ip, path: req.path, method: req.method });
    return res.status(403).json({ error: "Invalid or missing CSRF token" });
  }
  next(err);
}

/* ======================
   Rate Limiting
====================== */
// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
  handler: (req, res, next, options) => {
    auditLog("RATE_LIMIT_EXCEEDED", {
      ip: req.ip,
      path: req.path,
      method: req.method,
      limiter: "api"
    });
    res.status(429).json(options.message);
  }
});

// Strict rate limiter for mutations (POST/PUT/DELETE)
const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 mutations per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many modification requests, please try again later" },
  handler: (req, res, next, options) => {
    auditLog("RATE_LIMIT_EXCEEDED", {
      ip: req.ip,
      path: req.path,
      method: req.method,
      limiter: "mutation"
    });
    res.status(429).json(options.message);
  }
});

// Apply general limiter to all API routes
app.use("/api", apiLimiter);

// Strict rate limiter for login attempts (brute force protection)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
  message: { error: "Too many login attempts, please try again in 15 minutes" },
  handler: (req, res, next, options) => {
    auditLog("LOGIN_RATE_LIMIT", { ip: req.ip });
    console.warn(`[Auth] Rate limit exceeded for login from ${req.ip}`);
    res.status(429).json(options.message);
  }
});

// Rate limiter for contact form (spam protection)
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 submissions per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages sent. Please try again later." },
  handler: (req, res, next, options) => {
    auditLog("CONTACT_RATE_LIMIT", { ip: req.ip });
    res.status(429).json(options.message);
  }
});

// Origin/Referer allowlist for contact form (anti-CSRF for public endpoints)
function getContactAllowedOrigins() {
  const origins = new Set();
  // Always allow localhost in dev
  if (!isProduction) {
    origins.add("http://localhost:8080");
    origins.add("http://127.0.0.1:8080");
    origins.add(`http://localhost:${PORT}`);
    origins.add(`http://127.0.0.1:${PORT}`);
  }
  // Add from env: CONTACT_ALLOWED_ORIGINS=https://example.com,https://www.example.com
  const envOrigins = process.env.CONTACT_ALLOWED_ORIGINS || process.env.CORS_ORIGIN;
  if (envOrigins) {
    envOrigins.split(",").map(o => o.trim()).filter(Boolean).forEach(o => origins.add(o));
  }
  return origins;
}

function contactOriginCheck(req, res, next) {
  const origin = req.get("Origin");
  const referer = req.get("Referer");
  const checkValue = origin || (referer ? new URL(referer).origin : null);
  
  if (!checkValue) {
    // No Origin/Referer - allow but log (some legitimate clients don't send these)
    auditLog("CONTACT_NO_ORIGIN", { ip: req.ip, userAgent: req.get("User-Agent") });
    return next();
  }
  
  const allowed = getContactAllowedOrigins();
  if (allowed.size === 0 || allowed.has(checkValue)) {
    return next();
  }
  
  auditLog("CONTACT_ORIGIN_BLOCKED", { ip: req.ip, origin: checkValue });
  return res.status(403).json({ error: "Request origin not allowed" });
}

/* ======================
   Authentication Middleware
====================== */
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  auditLog("AUTH_REQUIRED", { ip: req.ip, path: req.path, method: req.method });
  return res.status(401).json({ error: "Authentication required" });
}

/* ======================
   Body Parser with Limits
====================== */
app.use(cookieParser()); // Required for csrf-csrf
app.use(express.json({ limit: "1mb" })); // Reasonable JSON limit
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

/* ======================
   Static Files
====================== */
app.use(express.static(__dirname));
app.use("/uploads", express.static(uploadsDir));

/* ======================
   Database Setup
====================== */
const dbPath = path.join(DATA_DIR, "cars.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to connect to SQLite:", err);
  } else {
    console.log("Connected to SQLite database at", dbPath);
  }
});

db.serialize(() => {
  // Create vehicles table with status column
  db.run(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER,
      make TEXT,
      model TEXT,
      trim TEXT,
      price INTEGER,
      mileage INTEGER,
      exterior_color TEXT,
      interior_color TEXT,
      fuel_type TEXT,
      transmission TEXT,
      engine TEXT,
      drivetrain TEXT,
      description TEXT,
      images_json TEXT,
      status TEXT NOT NULL DEFAULT 'available',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Add status column if missing (for existing databases)
  db.run(`
    ALTER TABLE vehicles ADD COLUMN status TEXT NOT NULL DEFAULT 'available'
  `, (err) => {
    // Ignore error if column already exists
    if (err && !err.message.includes('duplicate column')) {
      console.error('Migration error:', err.message);
    } else if (!err) {
      console.log('Migration: Added status column to vehicles table');
    }
  });

  // Create leads table for contact form submissions
  db.run(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      message TEXT NOT NULL,
      vehicle_id INTEGER,
      vehicle_title TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

/* ======================
   API Routes
====================== */

/* ======================
   Admin Authentication Routes
====================== */

// Get CSRF token (call this before any mutation)
app.get("/api/admin/csrf-token", (req, res) => {
  const token = generateToken(req, res);
  res.json({ csrfToken: token });
});

// Check session status
app.get("/api/admin/session", (req, res) => {
  res.json({
    authenticated: !!(req.session && req.session.isAdmin),
    expiresAt: req.session?.cookie?.expires || null
  });
});

// Admin login
app.post("/api/admin/login", loginLimiter, (req, res) => {
  const { password } = req.body;

  // Log login attempt (without password)
  console.log(`[Auth] Login attempt from ${req.ip}`);

  // Check for missing password in request
  if (!password) {
    auditLog("LOGIN_FAILED", { ip: req.ip, reason: "empty_password" });
    console.warn(`[Auth] Login failed: empty password from ${req.ip}`);
    return res.status(401).json({ error: "Password is required" });
  }

  // Constant-time comparison to prevent timing attacks
  const passwordBuffer = Buffer.from(password || "");
  const adminBuffer = Buffer.from(EFFECTIVE_ADMIN_PASSWORD);
  
  // Ensure buffers are same length for comparison
  const isValid = passwordBuffer.length === adminBuffer.length && 
    crypto.timingSafeEqual(passwordBuffer, adminBuffer);

  if (!isValid) {
    auditLog("LOGIN_FAILED", { ip: req.ip, reason: "invalid_password" });
    console.warn(`[Auth] Login failed: invalid password from ${req.ip}`);
    return res.status(401).json({ error: "Invalid password" });
  }

  // Regenerate session on login (prevent session fixation)
  req.session.regenerate((err) => {
    if (err) {
      console.error("[Auth] Session regeneration failed:", err);
      auditLog("LOGIN_FAILED", { ip: req.ip, reason: "session_error" });
      return res.status(500).json({ error: "Login failed" });
    }

    req.session.isAdmin = true;
    req.session.loginTime = new Date().toISOString();

    auditLog("LOGIN_SUCCESS", { ip: req.ip });
    console.log(`[Auth] Login successful from ${req.ip}`);
    
    // Generate fresh CSRF token for authenticated session
    const csrfToken = generateToken(req, res);
    res.json({ 
      success: true, 
      csrfToken,
      expiresAt: req.session.cookie.expires
    });
  });
});

// Admin logout
app.post("/api/admin/logout", (req, res) => {
  const wasAdmin = req.session?.isAdmin;
  
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction failed:", err);
      return res.status(500).json({ error: "Logout failed" });
    }
    
    // Clear session cookie
    res.clearCookie("bell_sid", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax"
    });
    
    if (wasAdmin) {
      auditLog("LOGOUT", { ip: req.ip });
    }
    
    res.json({ success: true });
  });
});

/* ======================
   Zod Validation Schema
====================== */
// Sanitize string to prevent XSS (basic - strips HTML tags)
const sanitizeString = (str) => {
  if (typeof str !== "string") return str;
  return str.replace(/<[^>]*>/g, "").trim();
};

// Allowed fields whitelist
const ALLOWED_VEHICLE_FIELDS = [
  "year", "make", "model", "trim", "price", "mileage",
  "exterior_color", "interior_color", "fuel_type",
  "transmission", "engine", "drivetrain", "description",
  "status", "image_url"
];

// Vehicle validation schema
const vehicleSchema = z.object({
  year: z.preprocess(
    (val) => (val === "" || val === null || val === undefined) ? null : Number(val),
    z.number().int().min(1900).max(new Date().getFullYear() + 2).nullable()
  ),
  make: z.preprocess(
    sanitizeString,
    z.string().max(50).optional().default("")
  ),
  model: z.preprocess(
    sanitizeString,
    z.string().max(50).optional().default("")
  ),
  trim: z.preprocess(
    sanitizeString,
    z.string().max(50).optional().default("")
  ),
  price: z.preprocess(
    (val) => (val === "" || val === null || val === undefined) ? null : Number(val),
    z.number().int().min(0).max(10000000).nullable() // Max $10M
  ),
  mileage: z.preprocess(
    (val) => (val === "" || val === null || val === undefined) ? null : Number(val),
    z.number().int().min(0).max(1000000).nullable() // Max 1M miles
  ),
  exterior_color: z.preprocess(
    sanitizeString,
    z.string().max(50).optional().default("")
  ),
  interior_color: z.preprocess(
    sanitizeString,
    z.string().max(50).optional().default("")
  ),
  fuel_type: z.preprocess(
    sanitizeString,
    z.string().max(30).optional().default("")
  ),
  transmission: z.preprocess(
    sanitizeString,
    z.string().max(30).optional().default("")
  ),
  engine: z.preprocess(
    sanitizeString,
    z.string().max(50).optional().default("")
  ),
  drivetrain: z.preprocess(
    sanitizeString,
    z.string().max(30).optional().default("")
  ),
  description: z.preprocess(
    sanitizeString,
    z.string().max(5000).optional().default("") // Max 5000 chars
  ),
  status: z.preprocess(
    sanitizeString,
    z.enum(["available", "sold", "pending"]).optional().default("available")
  ),
  image_url: z.string().max(2000).optional() // For URL-based images
}).strict(); // Reject unknown fields

// Contact form validation schema
const contactSchema = z.object({
  name: z.preprocess(
    sanitizeString,
    z.string().min(1, "Name is required").max(100, "Name too long")
  ),
  phone: z.preprocess(
    sanitizeString,
    z.string()
      .min(1, "Phone is required")
      .max(30, "Phone number too long")
      .regex(/^[\d\s()\-+.]+$/, "Invalid phone format")
  ),
  message: z.preprocess(
    sanitizeString,
    z.string().min(1, "Message is required").max(2000, "Message too long")
  ),
  vehicleId: z.preprocess(
    (val) => (val === "" || val === null || val === undefined) ? null : Number(val),
    z.number().int().positive().nullable().optional()
  ),
  vehicleTitle: z.preprocess(
    sanitizeString,
    z.string().max(200).optional().default("")
  ),
  // Honeypot field - must be empty (bots fill this)
  website: z.preprocess(
    (val) => (val === undefined || val === null) ? "" : String(val),
    z.string().max(0, "spam_detected")
  )
}).strict(); // Reject unknown fields

/**
 * Validate contact form submission
 */
function validateContactForm(body) {
  const result = contactSchema.safeParse(body);
  if (!result.success) {
    const errors = result.error.errors.map(e => ({
      field: e.path.join("."),
      message: e.message
    }));
    // Check for honeypot trigger
    if (errors.some(e => e.message === "spam_detected")) {
      return { success: false, isSpam: true, errors: [{ field: "form", message: "Invalid submission" }] };
    }
    return { success: false, errors };
  }
  return { success: true, data: result.data };
}

/**
 * Validate and parse vehicle fields
 * Returns { success: true, data } or { success: false, errors }
 */
function validateVehicleFields(body) {
  // Filter to only allowed fields
  const filtered = {};
  for (const key of ALLOWED_VEHICLE_FIELDS) {
    if (body[key] !== undefined) {
      filtered[key] = body[key];
    }
  }
  
  const result = vehicleSchema.safeParse(filtered);
  if (!result.success) {
    const errors = result.error.errors.map(e => ({
      field: e.path.join("."),
      message: e.message
    }));
    return { success: false, errors };
  }
  return { success: true, data: result.data };
}

/**
 * Helper: Parse vehicle fields from multipart form (strings → proper types)
 * @deprecated Use validateVehicleFields instead
 */
function parseVehicleFields(body) {
  return {
    year: parseInt(body.year, 10) || null,
    make: sanitizeString(body.make) || "",
    model: sanitizeString(body.model) || "",
    trim: sanitizeString(body.trim) || "",
    price: parseInt(body.price, 10) || null,
    mileage: parseInt(body.mileage, 10) || null,
    exterior_color: sanitizeString(body.exterior_color) || "",
    interior_color: sanitizeString(body.interior_color) || "",
    fuel_type: sanitizeString(body.fuel_type) || "",
    transmission: sanitizeString(body.transmission) || "",
    engine: sanitizeString(body.engine) || "",
    drivetrain: sanitizeString(body.drivetrain) || "",
    description: sanitizeString(body.description) || "",
    status: sanitizeString(body.status) || "available"
  };
}

/**
 * Helper: Build images array from Cloudinary uploads + optional image_url
 * Now stores objects with { url, publicId } for reliable deletion
 * @param {Array} cloudinaryResults - Array of { url, publicId } from uploads
 * @param {Object} body - Request body (may contain image_url)
 * @param {Array} existingImages - Existing images to preserve if no new ones
 * @returns {Array} Array of { url, publicId } objects
 */
function buildImagesArray(cloudinaryResults, body, existingImages = []) {
  let images = [];

  // Add Cloudinary results from uploaded files (already {url, publicId} format)
  if (cloudinaryResults && cloudinaryResults.length > 0) {
    images = [...cloudinaryResults];
  }

  // Add image_url if provided (for external URLs without publicId)
  if (body.image_url) {
    try {
      const parsed = JSON.parse(body.image_url);
      if (Array.isArray(parsed)) {
        // Could be array of URLs or array of {url, publicId}
        parsed.forEach(item => {
          if (typeof item === 'string' && item.trim()) {
            images.push({ url: item.trim(), publicId: null });
          } else if (item && item.url) {
            images.push({ url: item.url, publicId: item.publicId || null });
          }
        });
      } else if (typeof parsed === "string" && parsed.trim()) {
        images.push({ url: parsed.trim(), publicId: null });
      }
    } catch (e) {
      // Not JSON, treat as single URL
      if (typeof body.image_url === "string" && body.image_url.trim()) {
        images.push({ url: body.image_url.trim(), publicId: null });
      }
    }
  }

  // If no new images provided, keep existing
  if (images.length === 0 && existingImages.length > 0) {
    images = existingImages;
  }

  return images;
}

/**
 * Helper: Normalize images from DB (handles both old URL-only and new {url, publicId} format)
 * @param {string} imagesJson - JSON string from images_json column
 * @returns {Array} Array of { url, publicId } objects
 */
function normalizeImagesFromDb(imagesJson) {
  try {
    const parsed = JSON.parse(imagesJson || "[]");
    if (!Array.isArray(parsed)) return [];
    
    return parsed.map(item => {
      // Already in new format
      if (item && typeof item === 'object' && item.url) {
        return { url: item.url, publicId: item.publicId || null };
      }
      // Old format: just a URL string
      if (typeof item === 'string') {
        return { url: item, publicId: extractPublicIdFromUrl(item) };
      }
      return null;
    }).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Helper: Extract public IDs from images array for deletion
 * @param {Array} images - Array of { url, publicId } objects
 * @returns {Array} Array of publicId strings (excluding nulls)
 */
function getPublicIdsFromImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .map(img => img?.publicId || extractPublicIdFromUrl(img?.url))
    .filter(Boolean);
}

/**
 * Helper: Upload multiple files to Cloudinary with partial failure cleanup
 * If any upload fails, deletes all successful uploads and throws error
 * @param {Array} files - Array of multer file objects (with buffer)
 * @returns {Promise<Array<{url: string, publicId: string}>>} Array of { url, publicId } objects
 */
async function uploadFilesToCloudinary(files) {
  if (!files || files.length === 0) return [];

  const folder = process.env.CLOUDINARY_FOLDER || "bs-auto-sales";
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const result = await uploadBufferToCloudinary(file.buffer, { folder });
      results.push({
        url: result.secure_url,
        publicId: result.public_id
      });
      console.log(`[Cloudinary] Upload OK (${i + 1}/${files.length}): ${result.public_id}`);
    } catch (err) {
      console.error(`[Cloudinary] Upload FAILED (${i + 1}/${files.length}):`, {
        message: err.message,
        status: err?.http_code || err?.statusCode || null
      });
      
      // Cleanup: delete all successful uploads before this failure
      if (results.length > 0) {
        const publicIdsToDelete = results.map(r => r.publicId).filter(Boolean);
        console.log(`[Cloudinary] Cleaning up ${publicIdsToDelete.length} successful uploads due to failure...`);
        await deleteFromCloudinary(publicIdsToDelete).catch(cleanupErr => {
          console.error(`[Cloudinary] Cleanup error (non-fatal):`, cleanupErr.message);
        });
      }
      
      throw err;
    }
  }

  return results;
}

/**
 * Helper: Delete images from Cloudinary by public_id
 * @param {Array} publicIds - Array of Cloudinary public_id strings
 */
async function deleteFromCloudinary(publicIds) {
  if (!publicIds || publicIds.length === 0) return;

  for (const publicId of publicIds) {
    try {
      await cloudinary.uploader.destroy(publicId);
      console.log(`[Cloudinary] Deleted: ${publicId}`);
    } catch (err) {
      console.error(`[Cloudinary] Delete failed for ${publicId}:`, err.message);
    }
  }
}

/**
 * Helper: Extract Cloudinary public_id from secure_url
 * @param {string} url - Cloudinary secure_url
 * @returns {string|null} public_id or null
 */
function extractPublicIdFromUrl(url) {
  if (!url || !url.includes('cloudinary.com')) return null;
  try {
    // URL format: https://res.cloudinary.com/{cloud}/image/upload/{version}/{folder}/{public_id}.{ext}
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.[^.]+$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/* GET all vehicles */
app.get("/api/vehicles", (req, res) => {
  db.all("SELECT * FROM vehicles ORDER BY created_at DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Database read failed" });
    }
    res.json(rows);
  });
});

/* GET vehicle by ID */
app.get("/api/vehicles/:id", (req, res) => {
  db.get(
    "SELECT * FROM vehicles WHERE id = ?",
    [req.params.id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: "Database read failed" });
      }
      if (!row) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      res.json(row);
    }
  );
});

/* CREATE vehicle (supports multipart/form-data with images) */
const uploadFields = upload.fields([
  { name: 'images', maxCount: 20 },
  { name: 'image', maxCount: 20 }
]);

app.post("/api/vehicles", requireAuth, mutationLimiter, uploadFields, doubleCsrfProtection, csrfErrorHandler, async (req, res) => {
  try {
    // Validate input
    const validation = validateVehicleFields(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.errors
      });
    }

    const v = parseVehicleFields(req.body);
    
    // Combine files from both field names
    const allFiles = [...(req.files?.images || []), ...(req.files?.image || [])];
    
    // Upload to Cloudinary (returns {url, publicId} objects)
    let cloudinaryResults = [];
    if (allFiles.length > 0) {
      cloudinaryResults = await uploadFilesToCloudinary(allFiles);
    }
    
    // Build images array with {url, publicId} for each image
    const images = buildImagesArray(cloudinaryResults, req.body);

    const stmt = `
      INSERT INTO vehicles (
        year, make, model, trim, price, mileage,
        exterior_color, interior_color, fuel_type,
        transmission, engine, drivetrain,
        description, images_json, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(
      stmt,
      [
        v.year,
        v.make,
        v.model,
        v.trim,
        v.price,
        v.mileage,
        v.exterior_color,
        v.interior_color,
        v.fuel_type,
        v.transmission,
        v.engine,
        v.drivetrain,
        v.description,
        JSON.stringify(images),
        v.status || 'available'
      ],
      function (err) {
        if (err) {
          console.error("Insert error:", err);
          return res.status(500).json({ error: "Insert failed" });
        }
        auditLog("CREATE_VEHICLE", { id: this.lastID, make: v.make, model: v.model }, req);
        res.status(201).json({ id: this.lastID });
      }
    );
  } catch (err) {
    console.error("[Cloudinary] Upload error:", err);
    return res.status(500).json({ error: "Image upload failed", details: err.message });
  }
});

/* UPDATE vehicle (supports multipart/form-data with images) */
app.put("/api/vehicles/:id", requireAuth, mutationLimiter, uploadFields, doubleCsrfProtection, csrfErrorHandler, async (req, res) => {
  const vehicleId = req.params.id;

  // Validate ID is numeric
  if (!/^\d+$/.test(vehicleId)) {
    return res.status(400).json({ error: "Invalid vehicle ID" });
  }

  // Validate input
  const validation = validateVehicleFields(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: validation.errors
    });
  }

  try {
    // First, get existing images to preserve if no new ones uploaded
    const row = await new Promise((resolve, reject) => {
      db.get("SELECT images_json FROM vehicles WHERE id = ?", [vehicleId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!row) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    // Normalize existing images to {url, publicId} format
    const existingImages = normalizeImagesFromDb(row.images_json);

    const v = parseVehicleFields(req.body);
    
    // Combine files from both field names
    const allFiles = [...(req.files?.images || []), ...(req.files?.image || [])];
    
    // Upload new files to Cloudinary (returns {url, publicId} objects)
    let cloudinaryResults = [];
    if (allFiles.length > 0) {
      cloudinaryResults = await uploadFilesToCloudinary(allFiles);
    }
    
    // Build new images array
    const images = buildImagesArray(cloudinaryResults, req.body, existingImages);
    
    // Determine which old images are being replaced (for cleanup)
    const oldPublicIds = getPublicIdsFromImages(existingImages);
    const newPublicIds = new Set(getPublicIdsFromImages(images));
    const publicIdsToDelete = oldPublicIds.filter(id => !newPublicIds.has(id));

    const stmt = `
      UPDATE vehicles SET
        year = ?, make = ?, model = ?, trim = ?,
        price = ?, mileage = ?,
        exterior_color = ?, interior_color = ?,
        fuel_type = ?, transmission = ?,
        engine = ?, drivetrain = ?,
        description = ?, images_json = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    db.run(
      stmt,
      [
        v.year,
        v.make,
        v.model,
        v.trim,
        v.price,
        v.mileage,
        v.exterior_color,
        v.interior_color,
        v.fuel_type,
        v.transmission,
        v.engine,
        v.drivetrain,
        v.description,
        JSON.stringify(images),
        v.status || 'available',
        vehicleId
      ],
      function (err) {
        if (err) {
          console.error("Update error:", err);
          return res.status(500).json({ error: "Update failed" });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: "Vehicle not found" });
        }
        auditLog("UPDATE_VEHICLE", { id: vehicleId, make: v.make, model: v.model }, req);
        
        // Clean up replaced Cloudinary images (non-blocking, after DB success)
        if (publicIdsToDelete.length > 0) {
          deleteFromCloudinary(publicIdsToDelete).catch(err => {
            console.warn(`[Cloudinary] Old image cleanup warning: ${err.message}`);
          });
        }
        
        res.json({ success: true });
      }
    );
  } catch (err) {
    console.error("[Cloudinary] Upload error:", err);
    return res.status(500).json({ error: "Image upload failed", details: err.message });
  }
});

/* DELETE vehicle */
app.delete("/api/vehicles/:id", requireAuth, mutationLimiter, doubleCsrfProtection, csrfErrorHandler, async (req, res) => {
  const vehicleId = req.params.id;

  // Validate ID is numeric
  if (!/^\d+$/.test(vehicleId)) {
    return res.status(400).json({ error: "Invalid vehicle ID" });
  }

  try {
    // Get vehicle images before deleting (for Cloudinary cleanup)
    const row = await new Promise((resolve, reject) => {
      db.get("SELECT images_json FROM vehicles WHERE id = ?", [vehicleId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!row) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    // Delete from database
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM vehicles WHERE id = ?", [vehicleId], function (err) {
        if (err) reject(err);
        else if (this.changes === 0) reject(new Error("Vehicle not found"));
        else resolve();
      });
    });

    auditLog("DELETE_VEHICLE", { id: vehicleId }, req);

    // Clean up Cloudinary images (non-blocking, DB already deleted)
    try {
      const images = normalizeImagesFromDb(row.images_json);
      const publicIds = getPublicIdsFromImages(images);
      
      if (publicIds.length > 0) {
        // Don't await - let it run in background (DB delete already succeeded)
        deleteFromCloudinary(publicIds).catch(err => {
          console.warn(`[Cloudinary] Cleanup warning (vehicle ${vehicleId}): ${err.message}`);
        });
      }
    } catch (parseErr) {
      console.warn("[Cloudinary] Failed to parse images for cleanup:", parseErr.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    if (err.message === "Vehicle not found") {
      return res.status(404).json({ error: "Vehicle not found" });
    }
    return res.status(500).json({ error: "Delete failed" });
  }
});

/* ======================
   Contact Form API
====================== */

/* POST contact form submission */
app.post("/api/contact", contactOriginCheck, contactLimiter, (req, res) => {
  // Validate input
  const validation = validateContactForm(req.body);
  
  // Silent rejection for spam (honeypot triggered)
  if (validation.isSpam) {
    auditLog("SPAM_BLOCKED", { ip: req.ip, type: "honeypot" });
    // Return success to not tip off bots
    return res.json({ success: true });
  }
  
  if (!validation.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: validation.errors
    });
  }

  const { name, phone, message, vehicleId, vehicleTitle } = validation.data;
  const ipAddress = req.ip || req.connection?.remoteAddress || "unknown";
  const userAgent = req.get("User-Agent") || "unknown";

  db.run(
    `INSERT INTO leads (name, phone, message, vehicle_id, vehicle_title, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, phone, message, vehicleId || null, vehicleTitle || "", ipAddress, userAgent],
    function (err) {
      if (err) {
        console.error("Failed to save lead:", err);
        return res.status(500).json({ error: "Failed to send message" });
      }
      
      const leadId = this.lastID;
      
      auditLog("CONTACT_FORM", {
        leadId,
        name,
        vehicleId: vehicleId || null,
        ip: ipAddress
      });
      
      // Send email notification via SendGrid (non-blocking, don't fail if email fails)
      sendContactEmail({
        name,
        email: "", // Contact form doesn't collect email
        phone,
        message,
        vehicle: vehicleTitle || "",
      }).catch(err => console.error("Email notification error:", err));
      
      res.json({ success: true, message: "Message sent successfully" });
    }
  );
});

/* GET all leads (admin only) */
app.get("/api/leads", requireAuth, (req, res) => {
  db.all(
    "SELECT * FROM leads ORDER BY created_at DESC",
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Database read failed" });
      }
      auditLog("VIEW_LEADS", { count: rows.length, ip: req.ip });
      res.json(rows);
    }
  );
});

/* DELETE lead (admin only) */
app.delete("/api/leads/:id", requireAuth, mutationLimiter, doubleCsrfProtection, csrfErrorHandler, (req, res) => {
  const leadId = parseInt(req.params.id, 10);
  if (isNaN(leadId)) {
    return res.status(400).json({ error: "Invalid lead ID" });
  }

  db.run("DELETE FROM leads WHERE id = ?", [leadId], function (err) {
    if (err) {
      return res.status(500).json({ error: "Delete failed" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Lead not found" });
    }
    auditLog("DELETE_LEAD", { id: leadId, ip: req.ip });
    res.json({ success: true });
  });
});

/* ======================
   Error Handling Middleware
====================== */

// Handle Multer errors (file uploads)
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "Image too large. Please upload under 15MB per image." });
  }
  if (err.code === "INVALID_FILE_TYPE") {
    return res.status(415).json({ error: "Invalid file type. Only JPG, PNG, and WEBP are allowed." });
  }
  if (err.name === "MulterError") {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  next(err);
});

// Generic error handler - hide stack traces in production
app.use((err, req, res, next) => {
  // If headers already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }
  
  console.error("Unhandled error:", err);
  auditLog("SERVER_ERROR", {
    message: err.message,
    path: req.path,
    method: req.method
  }, req);

  res.status(err.status || 500).json({
    error: isProduction ? "Internal server error" : err.message,
    ...(isProduction ? {} : { stack: err.stack })
  });
});

// 404 handler for API routes
app.use("/api", (req, res, next) => {
  res.status(404).json({ error: "Endpoint not found" });
});

/* ======================
   Server Start
====================== */
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
});
