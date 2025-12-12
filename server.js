const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const PORT = 8080;

/* ======================
   Uploads Directory
====================== */
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/* ======================
   Multer Configuration
====================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `vehicle-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG, and WEBP images are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB per file
});

/* ======================
   Middleware
====================== */
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(__dirname));
app.use("/uploads", express.static(uploadsDir));

/* ======================
   Database Setup
====================== */
const dbPath = path.join(__dirname, "cars.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to connect to SQLite:", err);
  } else {
    console.log("Connected to SQLite database at", dbPath);
  }
});

db.serialize(() => {
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

/* ======================
   API Routes
====================== */

/**
 * Helper: Parse vehicle fields from multipart form (strings → proper types)
 */
function parseVehicleFields(body) {
  return {
    year: parseInt(body.year, 10) || null,
    make: body.make || "",
    model: body.model || "",
    trim: body.trim || "",
    price: parseInt(body.price, 10) || null,
    mileage: parseInt(body.mileage, 10) || null,
    exterior_color: body.exterior_color || "",
    interior_color: body.interior_color || "",
    fuel_type: body.fuel_type || "",
    transmission: body.transmission || "",
    engine: body.engine || "",
    drivetrain: body.drivetrain || "",
    description: body.description || "",
    status: body.status || "available"
  };
}

/**
 * Helper: Build images array from uploaded files + optional image_url
 */
function buildImagesArray(files, body, existingImages = []) {
  let images = [];

  // Add uploaded file paths
  if (files && files.length > 0) {
    images = files.map((f) => `/uploads/${f.filename}`);
  }

  // Add image_url if provided (single URL or JSON array string)
  if (body.image_url) {
    try {
      const parsed = JSON.parse(body.image_url);
      if (Array.isArray(parsed)) {
        images = images.concat(parsed);
      } else if (typeof parsed === "string" && parsed.trim()) {
        images.push(parsed.trim());
      }
    } catch (e) {
      // Not JSON, treat as single URL
      if (typeof body.image_url === "string" && body.image_url.trim()) {
        images.push(body.image_url.trim());
      }
    }
  }

  // If no new images provided, keep existing
  if (images.length === 0 && existingImages.length > 0) {
    images = existingImages;
  }

  return images;
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
  { name: 'images', maxCount: 10 },
  { name: 'image', maxCount: 10 }
]);

app.post("/api/vehicles", uploadFields, (req, res) => {
  const v = parseVehicleFields(req.body);
  // Combine files from both field names
  const allFiles = [...(req.files?.images || []), ...(req.files?.image || [])];
  const images = buildImagesArray(allFiles, req.body);

  const stmt = `
    INSERT INTO vehicles (
      year, make, model, trim, price, mileage,
      exterior_color, interior_color, fuel_type,
      transmission, engine, drivetrain,
      description, images_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      JSON.stringify(images)
    ],
    function (err) {
      if (err) {
        console.error("Insert error:", err);
        return res.status(500).json({ error: "Insert failed" });
      }
      res.status(201).json({ id: this.lastID });
    }
  );
});

/* UPDATE vehicle (supports multipart/form-data with images) */
app.put("/api/vehicles/:id", uploadFields, (req, res) => {
  const vehicleId = req.params.id;

  // First, get existing images to preserve if no new ones uploaded
  db.get("SELECT images_json FROM vehicles WHERE id = ?", [vehicleId], (err, row) => {
    if (err) {
      console.error("Lookup error:", err);
      return res.status(500).json({ error: "Database read failed" });
    }
    if (!row) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    let existingImages = [];
    try {
      existingImages = JSON.parse(row.images_json || "[]");
    } catch (e) {
      existingImages = [];
    }

    const v = parseVehicleFields(req.body);
    // Combine files from both field names
    const allFiles = [...(req.files?.images || []), ...(req.files?.image || [])];
    const images = buildImagesArray(allFiles, req.body, existingImages);

    const stmt = `
      UPDATE vehicles SET
        year = ?, make = ?, model = ?, trim = ?,
        price = ?, mileage = ?,
        exterior_color = ?, interior_color = ?,
        fuel_type = ?, transmission = ?,
        engine = ?, drivetrain = ?,
        description = ?, images_json = ?,
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
        res.json({ success: true });
      }
    );
  });
});

/* DELETE vehicle */
app.delete("/api/vehicles/:id", (req, res) => {
  db.run(
    "DELETE FROM vehicles WHERE id = ?",
    [req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "Delete failed" });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      res.json({ success: true });
    }
  );
});

/* ======================
   Server Start
====================== */
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
