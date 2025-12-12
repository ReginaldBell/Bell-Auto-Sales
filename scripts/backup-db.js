/**
 * Backup Script: Copies cars.db to backups/ with timestamp
 * Usage: npm run backup:db
 */
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "..", "cars.db");
const backupsDir = path.join(__dirname, "..", "backups");

// Ensure backups directory exists
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.error("❌ No cars.db found. Nothing to backup.");
  process.exit(1);
}

// Create timestamped backup filename
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFilename = `cars-${timestamp}.db`;
const backupPath = path.join(backupsDir, backupFilename);

// Copy the database
fs.copyFileSync(dbPath, backupPath);
console.log(`✅ Backup created: backups/${backupFilename}`);

// List existing backups
const backups = fs.readdirSync(backupsDir).filter(f => f.endsWith(".db"));
console.log(`📦 Total backups: ${backups.length}`);
