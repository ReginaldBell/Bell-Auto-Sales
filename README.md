# 🚗 Bell Auto Sales

A production-ready used car dealership website featuring a modern customer-facing interface, comprehensive admin panel, and robust inventory management system.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org)

![Bell Auto Sales Homepage](screenshots/homepage-hero.png)
*Modern, responsive vehicle inventory showcase*

---

## 📋 Table of Contents

- [Features](#-features)
- [Screenshots](#-screenshots)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [Multi-Machine Development](#-multi-machine-development)
- [API Documentation](#-api-documentation)
- [Backup & Restore](#-backup--restore)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### Customer-Facing
- **Responsive Vehicle Catalog** - Browse available inventory with filters and search
- **Detailed Vehicle Pages** - High-quality image galleries with comprehensive specifications
- **Secure Contact Forms** - Vehicle-specific inquiry system with email notifications
- **Mobile-Optimized** - Seamless experience across all devices
- **Real-time Availability** - Live status updates for vehicle inventory

### Admin Panel
- **Inventory Management** - Add, edit, and remove vehicles with ease
- **Multi-Image Upload System** - Support for multiple photos per vehicle with preview
- **Comprehensive Vehicle Data** - Track year, make, model, price, mileage, features, and more
- **Status Management** - Mark vehicles as available, sold, or pending
- **Real-time Updates** - Changes instantly reflected on the public site

### Technical Highlights
- SQLite database for lightweight, portable data storage
- RESTful API architecture
- Form validation and security measures
- Automated backup and restore system
- Zero-configuration local development
- Clean, semantic HTML/CSS/JavaScript

---

## 📸 Screenshots

> 🔍 **Visual Walkthrough:** Homepage → Inventory → Vehicle → Contact → Admin

### Homepage – Hero & Call to Action
![Homepage hero section](screenshots/homepage-hero.png)
Clean, modern landing page with strong call-to-action and brand-focused messaging.

---

### Inventory Grid
![Inventory grid](screenshots/inventory-grid.png)
Card-based inventory layout displaying pricing, mileage, availability, and preview images.

---

### Vehicle Detail Page
![Vehicle detail gallery](screenshots/vehicle-detail-gallery.png)
Full vehicle detail view with multi-image gallery, specifications, and inquiry access.

---

### Contact Form
![Contact form](screenshots/contact-form.png)
Vehicle-aware contact form allowing customers to inquire about specific listings.

---

### Footer Contact CTA
![Footer contact CTA](screenshots/contact-form-footer-cta.png)
Secondary conversion path via footer call-to-action for Facebook or direct contact.

---

### Admin Panel – Add Vehicle
![Admin add vehicle](screenshots/admin-add-vehicle.png)
Secure admin interface for adding vehicles with full metadata and multi-image upload support.

---

## 🛠️ Tech Stack

**Backend:**
- Node.js & Express.js
- SQLite3 database
- Multer (file uploads)
- Nodemailer (email notifications)

**Frontend:**
- Vanilla JavaScript (ES6+)
- Modern CSS (Grid, Flexbox)
- Responsive design principles
- No framework dependencies

**Development:**
- npm scripts for automation
- Environment variable configuration
- Git version control

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/ReginaldBell/Bell-Auto-Sales.git
cd Bell-Auto-Sales

# Install dependencies
npm install

# Start the development server
npm start
```

The application will be available at `http://localhost:3000`

### First-Time Setup

1. **Access the admin panel:** Navigate to `/admin.html`
2. **Add your first vehicle:** Use the comprehensive inventory form
3. **Upload vehicle images:** Multi-image support included
4. **Configure email (optional):** Set up `.env` for contact form notifications

---

## 📁 Project Structure

```
bell-auto-sales/
├── public/              # Static assets & client-side code
│   ├── css/            # Stylesheets
│   ├── js/             # Frontend JavaScript
│   ├── index.html      # Main landing page
│   ├── vehicle.html    # Vehicle detail page
│   ├── contact.html    # Contact form
│   └── admin.html      # Admin panel
├── uploads/            # Vehicle images (gitignored)
├── backups/            # Database backups (gitignored)
├── screenshots/        # README images
├── server.js           # Express server & API routes
├── cars.db             # SQLite database (gitignored)
├── package.json        # Dependencies & scripts
└── README.md           # Documentation
```

---

## 💻 Development

### Available Scripts

```bash
npm start              # Start the server (port 3000)
npm run backup:db      # Create database backup
npm run restore:db     # Restore from backup (interactive)
```

### Environment Variables

Create a `.env` file in the root directory (optional):

```env
PORT=3000
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
ADMIN_EMAIL=admin@bellautosales.com
```

### Database Schema

The SQLite database (`cars.db`) includes:

**vehicles table:**
- `id` - Primary key
- `year` - Vehicle year
- `make` - Manufacturer
- `model` - Model name
- `trim` - Trim level
- `price` - Selling price
- `mileage` - Odometer reading
- `status` - available/sold/pending
- `exterior_color` - Exterior color
- `interior_color` - Interior color
- `fuel_type` - Gasoline/Diesel/Hybrid/Electric
- `transmission` - Automatic/Manual
- `drivetrain` - FWD/RWD/AWD/4WD
- `engine` - Engine specifications
- `features` - Comma-separated features list
- `description` - Full vehicle description
- `images` - JSON array of image paths
- `stock_number` - Internal tracking number
- `created_at` - Timestamp
- `updated_at` - Timestamp

---

## 🔄 Multi-Machine Development

### Option A: Manual Database Sync

When working across multiple machines (e.g., home desktop & work laptop), you'll need to manually transfer data files since they're gitignored.

#### Step 1: On Machine A (source) — Stop & backup

```bash
# Stop the server (Ctrl+C)
npm run backup:db
```

#### Step 2: Transfer data files

Copy these files/folders:
- `cars.db` (database)
- `uploads/` (vehicle images)
- Optionally: `backups/` (for safety)

**Transfer Methods:**
- USB drive
- Cloud storage (Google Drive, Dropbox, OneDrive)
- `scp` via SSH (see commands below)

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

#### Step 3: On Machine B (destination) — Pull code & start

```bash
# Pull latest code changes
git pull origin main

# Start the server
npm start
```

#### ⚠️ Critical Rules

1. **Never run servers on both machines simultaneously** with the same database
2. **Always stop the server** before copying `cars.db`
3. **Backup before restore:** Use `npm run backup:db` to create safety copies
4. **Remember:** `cars.db`, `uploads/`, and `backups/` are gitignored

---

### Option B: Shared Cloud Database (Recommended for Teams)

For frequent multi-machine development or team collaboration, migrate to a cloud database.

#### Quick Migration Guide

1. **Choose a provider:**
   - [Supabase](https://supabase.com) - PostgreSQL, generous free tier
   - [PlanetScale](https://planetscale.com) - MySQL, serverless
   - [Railway](https://railway.app) - PostgreSQL/MySQL with easy deployment

2. **Install database driver:**
   ```bash
   # For PostgreSQL
   npm install pg
   
   # For MySQL
   npm install mysql2
   ```

3. **Add environment variables:**
   
   Create/update `.env` file:
   ```env
   DATABASE_URL=postgres://user:pass@host:5432/dbname
   ```

4. **Update `server.js`:**
   - Replace `sqlite3` import with `pg` or `mysql2`
   - Change connection from file path to `DATABASE_URL`
   - Adjust SQL syntax for PostgreSQL/MySQL compatibility

5. **Migrate existing data:**
   ```bash
   # Export SQLite data
   sqlite3 cars.db .dump > dump.sql
   
   # Import to cloud database (adjust syntax as needed)
   ```

6. **Modified files:**
   - `package.json` - new database dependency
   - `server.js` - database connection logic
   - `.env` - connection string (never commit this)

---

## 📡 API Documentation

### Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/vehicles` | List all vehicles | No |
| GET | `/api/vehicles/:id` | Get single vehicle | No |
| POST | `/api/vehicles` | Create new vehicle | Yes (future) |
| PUT | `/api/vehicles/:id` | Update vehicle | Yes (future) |
| DELETE | `/api/vehicles/:id` | Delete vehicle | Yes (future) |
| POST | `/api/contact` | Submit contact form | No |

### Example Requests

**Fetch all vehicles:**
```javascript
fetch('/api/vehicles')
  .then(response => response.json())
  .then(data => console.log(data));
```

**Get single vehicle:**
```javascript
fetch('/api/vehicles/4')
  .then(response => response.json())
  .then(vehicle => console.log(vehicle));
```

**Create new vehicle (multipart/form-data):**
```javascript
const formData = new FormData();
formData.append('year', '2020');
formData.append('make', 'Toyota');
formData.append('model', 'Camry');
formData.append('trim', 'SE');
formData.append('price', '18500');
formData.append('mileage', '45000');
formData.append('status', 'available');
formData.append('images', imageFile1);
formData.append('images', imageFile2);

fetch('/api/vehicles', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => console.log('Vehicle added:', data));
```

**Submit contact form:**
```javascript
fetch('/api/contact', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'John Doe',
    phone: '555-1234',
    vehicle_id: 4,
    message: 'Interested in test drive'
  })
})
.then(response => response.json())
.then(data => console.log('Message sent:', data));
```

---

## 💾 Backup & Restore

### Create Backup

```bash
npm run backup:db
```

**Output:**
```
✅ Backup created: backups/cars-2025-01-15T10-30-00-000Z.db
```

Backups are timestamped and stored in the `backups/` directory.

### Restore from Backup

**Interactive mode (shows list of available backups):**
```bash
npm run restore:db
```

**Direct restore (specify backup file):**
```bash
npm run restore:db -- backups/cars-2025-01-15T10-30-00-000Z.db
```

**Safety feature:** Restoring automatically backs up your current `cars.db` first, so you never lose data.

### Best Practices

- Backup before major changes
- Keep at least 3-5 recent backups
- Test restores periodically
- Store critical backups off-site (cloud storage)

---

## 🌐 Deployment

### Prerequisites for Production

1. Update `server.js` to use environment variable for port
2. Set up `.env` with production email credentials
3. Configure a process manager (PM2 recommended)
4. Set up reverse proxy (nginx/Apache)
5. Implement admin authentication
6. Enable SSL/HTTPS

### Recommended Platforms

- **Railway** - Zero-config deployment with database hosting
- **Heroku** - Classic PaaS (requires PostgreSQL addon for production)
- **DigitalOcean App Platform** - Simple and affordable
- **VPS** (DigitalOcean, Linode, Vultr) - Full control with nginx + PM2

### Quick Deploy with Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and initialize
railway login
railway init

# Deploy
railway up
```

### VPS Deployment with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start server.js --name bell-auto-sales

# Enable startup script
pm2 startup
pm2 save

# Monitor
pm2 monit
```

### Nginx Configuration Example

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Production Checklist

- [ ] Environment variables configured (`.env`)
- [ ] Database backed up regularly (cron job)
- [ ] SSL certificate installed (Let's Encrypt)
- [ ] Admin routes protected with authentication
- [ ] Error monitoring set up (Sentry, LogRocket)
- [ ] Rate limiting implemented
- [ ] File upload limits configured
- [ ] CORS properly configured
- [ ] Security headers added (Helmet.js)
- [ ] Regular security updates scheduled

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### How to Contribute

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Contribution Guidelines

- Follow existing code style and conventions
- Add comments for complex logic
- Update documentation for new features
- Test thoroughly before submitting
- Keep commits focused and atomic

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📧 Contact

Reginald Bell - [@ReginaldBell](https://github.com/ReginaldBell)

Project Link: [https://github.com/ReginaldBell/Bell-Auto-Sales](https://github.com/ReginaldBell/Bell-Auto-Sales)

Live Demo: [https://bs-auto-sales.org](https://bs-auto-sales.org)

---

## 🙏 Acknowledgments

- Built with Node.js and Express
- SQLite for reliable, portable data storage
- Inspired by modern dealership management systems
- Community feedback and contributions

---

## 🔮 Future Enhancements

- [ ] User authentication for admin panel
- [ ] Advanced search and filtering
- [ ] Vehicle comparison feature
- [ ] Customer reviews and ratings
- [ ] Financing calculator
- [ ] Appointment scheduling system
- [ ] SMS notifications
- [ ] Analytics dashboard
- [ ] Multi-location support
- [ ] API rate limiting

---

**⭐ If this project helped you, please consider giving it a star on GitHub!**

---

## 📊 Project Stats

![GitHub stars](https://img.shields.io/github/stars/ReginaldBell/Bell-Auto-Sales?style=social)
![GitHub forks](https://img.shields.io/github/forks/ReginaldBell/Bell-Auto-Sales?style=social)
![GitHub issues](https://img.shields.io/github/issues/ReginaldBell/Bell-Auto-Sales)
![GitHub last commit](https://img.shields.io/github/last-commit/ReginaldBell/Bell-Auto-Sales)
