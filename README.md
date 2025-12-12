# Bell Auto Sales

Vehicle inventory management system with Node.js, Express, and SQLite.

## Quick Start

```bash
# Install dependencies
npm install

# Start the server (production)
npm start

# Start with auto-reload (development)
npm run dev
```

Server runs at: **http://localhost:8080**

## NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `start` | `npm start` | Production server |
| `dev` | `npm run dev` | Development with nodemon auto-reload |
| `backup:db` | `npm run backup:db` | Backup database to `backups/` folder |
| `restore:db` | `npm run restore:db` | Restore database from backup (interactive) |

## Project Structure

```
bell-auto-sales/
├── server.js          # Express API server
├── cars.db            # SQLite database (auto-created)
├── uploads/           # Vehicle images
├── backups/           # Database backups (gitignored)
├── scripts/           # Helper scripts
│   ├── backup-db.js
│   └── restore-db.js
├── index.html         # Public inventory page
├── admin.html         # Admin dashboard
└── vehicle.html       # Single vehicle details
```

---

## 🔄 Syncing Between Machines

### Option A: GitHub + Manual DB Transfer (Recommended)

Use GitHub for code, manually transfer `cars.db` and `uploads/` between machines.

#### Initial Setup (Both Machines)

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/bell-auto-sales.git
cd bell-auto-sales

# Install dependencies
npm install
```

#### Workflow: Transfer Data from Machine A → Machine B

**Step 1: On Machine A (source) — Stop server & backup**

```bash
# Stop the server (Ctrl+C or close terminal)

# Create a backup
npm run backup:db
```

**Step 2: Copy files to Machine B**

Copy these files/folders:
- `cars.db` (database)
- `uploads/` (images)
- Optionally: `backups/` (for safety)

**Transfer methods:**
- USB drive
- Cloud storage (Google Drive, Dropbox, OneDrive)
- `scp` (SSH): see commands below

<details>
<summary><strong>SCP Commands (Mac/Linux)</strong></summary>

```bash
# From Machine A (send to Machine B)
scp cars.db user@machine-b:/path/to/bell-auto-sales/
scp -r uploads/ user@machine-b:/path/to/bell-auto-sales/

# From Machine B (pull from Machine A)
scp user@machine-a:/path/to/bell-auto-sales/cars.db ./
scp -r user@machine-a:/path/to/bell-auto-sales/uploads/ ./
```

</details>

<details>
<summary><strong>Copy Commands (Windows PowerShell)</strong></summary>

```powershell
# Copy to USB or network drive
Copy-Item cars.db -Destination "D:\backup\"
Copy-Item -Recurse uploads -Destination "D:\backup\"

# Copy from USB or network drive
Copy-Item "D:\backup\cars.db" -Destination ".\"
Copy-Item -Recurse "D:\backup\uploads" -Destination ".\"
```

</details>

**Step 3: On Machine B (destination) — Pull code & start**

```bash
# Pull latest code changes
git pull origin main

# Start the server
npm start
```

#### ⚠️ Important Rules

1. **Never run servers on both machines simultaneously** with the same DB
2. **Always stop the server** before copying `cars.db`
3. **Backup before restore**: `npm run backup:db` creates safety copies
4. **Git ignores data files**: `cars.db`, `uploads/`, and `backups/` are gitignored

---

### Option B: Shared Database (PostgreSQL/MySQL)

For teams or frequent multi-machine development, migrate to a cloud database.

#### High-Level Migration Steps

1. **Set up cloud database**
   - [Supabase](https://supabase.com) (PostgreSQL, free tier)
   - [PlanetScale](https://planetscale.com) (MySQL, free tier)
   - [Railway](https://railway.app) (PostgreSQL/MySQL)

2. **Install database driver**
   ```bash
   # For PostgreSQL
   npm install pg

   # For MySQL
   npm install mysql2
   ```

3. **Add environment variables**
   Create `.env` file (gitignored):
   ```env
   DATABASE_URL=postgres://user:pass@host:5432/dbname
   ```

4. **Update server.js**
   - Replace `sqlite3` import with `pg` or `mysql2`
   - Change connection from file path to `DATABASE_URL`
   - Update SQL syntax if needed (SQLite → PostgreSQL/MySQL differences)

5. **Migrate data**
   - Export SQLite data: `sqlite3 cars.db .dump > dump.sql`
   - Import to cloud DB (adjust syntax as needed)

6. **Files that change:**
   - `package.json` — new dependency
   - `server.js` — database connection code
   - `.env` — connection string (not committed)

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vehicles` | List all vehicles |
| GET | `/api/vehicles/:id` | Get single vehicle |
| POST | `/api/vehicles` | Create vehicle (multipart) |
| PUT | `/api/vehicles/:id` | Update vehicle |
| DELETE | `/api/vehicles/:id` | Delete vehicle |

---

## Backup & Restore

### Create Backup
```bash
npm run backup:db
# Output: ✅ Backup created: backups/cars-2025-01-15T10-30-00-000Z.db
```

### Restore from Backup
```bash
# Interactive (shows list of backups)
npm run restore:db

# Direct restore
npm run restore:db -- backups/cars-2025-01-15T10-30-00-000Z.db
```

Restoring automatically backs up the current `cars.db` first (safety net).
