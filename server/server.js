// Load environment variables from .env file BEFORE any other imports
// This must be the first line to ensure all modules receive env vars
require("dotenv").config();

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
