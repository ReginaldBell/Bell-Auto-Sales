/**
 * Restore Script: Restores cars.db from a backup
 * Usage: npm run restore:db
 *        npm run restore:db -- backups/cars-2025-01-01T12-00-00-000Z.db
 */
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const dbPath = path.join(__dirname, "..", "cars.db");
const backupsDir = path.join(__dirname, "..", "backups");

// Get backup file from command line args
const args = process.argv.slice(2);
let backupFile = args[0];

// List available backups
function listBackups() {
  if (!fs.existsSync(backupsDir)) {
    console.log("❌ No backups folder found.");
    return [];
  }
  const backups = fs.readdirSync(backupsDir)
    .filter(f => f.endsWith(".db"))
    .sort()
    .reverse(); // newest first
  return backups;
}

// Restore from a specific backup
function restore(filename) {
  const sourcePath = path.join(backupsDir, filename);
  
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Backup not found: ${filename}`);
    process.exit(1);
  }

  // Create backup of current DB before overwriting
  if (fs.existsSync(dbPath)) {
    const preRestoreBackup = path.join(backupsDir, `cars-pre-restore-${Date.now()}.db`);
    fs.copyFileSync(dbPath, preRestoreBackup);
    console.log(`📦 Current DB backed up to: ${path.basename(preRestoreBackup)}`);
  }

  // Restore
  fs.copyFileSync(sourcePath, dbPath);
  console.log(`✅ Restored from: ${filename}`);
}

// Interactive mode if no backup specified
async function interactive() {
  const backups = listBackups();
  
  if (backups.length === 0) {
    console.log("❌ No backups available to restore.");
    process.exit(1);
  }

  console.log("\n📋 Available backups (newest first):\n");
  backups.forEach((b, i) => {
    console.log(`  [${i + 1}] ${b}`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question("\nEnter backup number to restore (or 'q' to quit): ", (answer) => {
    rl.close();
    
    if (answer.toLowerCase() === "q") {
      console.log("Cancelled.");
      process.exit(0);
    }

    const index = parseInt(answer, 10) - 1;
    if (isNaN(index) || index < 0 || index >= backups.length) {
      console.error("❌ Invalid selection.");
      process.exit(1);
    }

    restore(backups[index]);
  });
}

// Main
if (backupFile) {
  // Direct restore from argument
  const filename = path.basename(backupFile);
  restore(filename);
} else {
  // Interactive mode
  interactive();
}
