🚗 Bell Auto Sales
A production-ready used car dealership website featuring a modern customer-facing interface, comprehensive admin panel, and robust inventory management system.
Show Image
Show Image
Show Image
Modern, responsive vehicle inventory showcase

📋 Table of Contents

Features
Screenshots
Tech Stack
Quick Start
Project Structure
Development
Multi-Machine Development
API Documentation
Backup & Restore
Deployment
Contributing
License


✨ Features
Customer-Facing

Responsive Vehicle Catalog - Browse available inventory with filters and search
Detailed Vehicle Pages - High-quality image galleries with comprehensive specifications
Secure Contact Forms - Vehicle-specific inquiry system with email notifications
Mobile-Optimized - Seamless experience across all devices
Real-time Availability - Live status updates for vehicle inventory

Admin Panel

Inventory Management - Add, edit, and remove vehicles with ease
Multi-Image Upload System - Support for multiple photos per vehicle with preview
Comprehensive Vehicle Data - Track year, make, model, price, mileage, features, and more
Status Management - Mark vehicles as available, sold, or pending
Real-time Updates - Changes instantly reflected on the public site

Technical Highlights

SQLite database for lightweight, portable data storage
RESTful API architecture
Form validation and security measures
Automated backup and restore system
Zero-configuration local development
Clean, semantic HTML/CSS/JavaScript


📸 Screenshots
Homepage - Vehicle Inventory
Show Image
Clean card-based layout showcasing available vehicles with key details at a glance. Features include availability badges, pricing, mileage, and quick view options.

Vehicle Detail Page
Show Image
Comprehensive vehicle information with image gallery, detailed specifications, and integrated contact options. Customers can view all photos and get complete vehicle history.

Admin Panel
Show Image
Note: Screenshot shows the vehicle management interface for demonstration purposes. In production, this area is password-protected.
Intuitive admin interface for managing inventory. Features include:

Multi-field vehicle entry form
Image upload with multiple file support
Dropdown menus for standardized data (fuel type, transmission, drivetrain)
Rich text description editor
Status management


Contact Form
Show Image
User-friendly contact system with vehicle selection dropdown, ensuring inquiries are directed to specific inventory items.

🛠️ Tech Stack
Backend:

Node.js & Express.js
SQLite3 database
Multer (file uploads)
Nodemailer (email notifications)

Frontend:

Vanilla JavaScript (ES6+)
Modern CSS (Grid, Flexbox)
Responsive design principles
No framework dependencies

Development:

npm scripts for automation
Environment variable configuration
Git version control


🚀 Quick Start
Prerequisites

Node.js (v14 or higher)
npm (comes with Node.js)
Git

Installation
bash# Clone the repository
git clone https://github.com/ReginaldBell/Bell-Auto-Sales.git
cd Bell-Auto-Sales

# Install dependencies
npm install

# Start the development server
npm start
The application will be available at http://localhost:3000
First-Time Setup

Access the admin panel: Navigate to /admin.html
Add your first vehicle: Use the comprehensive inventory form
Upload vehicle images: Multi-image support included
Configure email (optional): Set up .env for contact form notifications


📁 Project Structure
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

💻 Development
Available Scripts
bashnpm start              # Start the server (port 3000)
npm run backup:db      # Create database backup
npm run restore:db     # Restore from backup (interactive)
Environment Variables
Create a .env file in the root directory (optional):
envPORT=3000
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
ADMIN_EMAIL=admin@bellautosales.com
Database Schema
The SQLite database (cars.db) includes:
vehicles table:

id - Primary key
year - Vehicle year
make - Manufacturer
model - Model name
trim - Trim level
price - Selling price
mileage - Odometer reading
status - available/sold/pending
exterior_color - Exterior color
interior_color - Interior color
fuel_type - Gasoline/Diesel/Hybrid/Electric
transmission - Automatic/Manual
drivetrain - FWD/RWD/AWD/4WD
engine - Engine specifications
features - Comma-separated features list
description - Full vehicle description
images - JSON array of image paths
stock_number - Internal tracking number
created_at - Timestamp
updated_at - Timestamp


🔄 Multi-Machine Development
Option A: Manual Database Sync
When working across multiple machines (e.g., home desktop & work laptop), you'll need to manually transfer data files since they're gitignored.
Step 1: On Machine A (source) — Stop & backup
bash# Stop the server (Ctrl+C)
npm run backup:db
Step 2: Transfer data files
Copy these files/folders:

cars.db (database)
uploads/ (vehicle images)
Optionally: backups/ (for safety)

Transfer Methods:

USB drive
Cloud storage (Google Drive, Dropbox, OneDrive)
scp via SSH (see commands below)

<details>
<summary><strong>SCP Commands (Mac/Linux)</strong></summary>
```bash
# From Machine A (send to Machine B)
scp cars.db user@machine-b:/path/to/bell-auto-sales/
scp -r uploads/ user@machine-b:/path/to/bell-auto-sales/
From Machine B (pull from Machine A)
scp user@machine-a:/path/to/bell-auto-sales/cars.db ./
scp -r user@machine-a:/path/to/bell-auto-sales/uploads/ ./
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
</details>
Step 3: On Machine B (destination) — Pull code & start
bash# Pull latest code changes
git pull origin main

# Start the server
npm start
⚠️ Critical Rules

Never run servers on both machines simultaneously with the same database
Always stop the server before copying cars.db
Backup before restore: Use npm run backup:db to create safety copies
Remember: cars.db, uploads/, and backups/ are gitignored


Option B: Shared Cloud Database (Recommended for Teams)
For frequent multi-machine development or team collaboration, migrate to a cloud database.
Quick Migration Guide

Choose a provider:

Supabase - PostgreSQL, generous free tier
PlanetScale - MySQL, serverless
Railway - PostgreSQL/MySQL with easy deployment


Install database driver:

bash   # For PostgreSQL
   npm install pg
   
   # For MySQL
   npm install mysql2

Add environment variables:
Create/update .env file:

env   DATABASE_URL=postgres://user:pass@host:5432/dbname

Update server.js:

Replace sqlite3 import with pg or mysql2
Change connection from file path to DATABASE_URL
Adjust SQL syntax for PostgreSQL/MySQL compatibility


Migrate existing data:

bash   # Export SQLite data
   sqlite3 cars.db .dump > dump.sql
   
   # Import to cloud database (adjust syntax as needed)

Modified files:

package.json - new database dependency
server.js - database connection logic
.env - connection string (never commit this)




📡 API Documentation
Endpoints
MethodEndpointDescriptionAuth RequiredGET/api/vehiclesList all vehiclesNoGET/api/vehicles/:idGet single vehicleNoPOST/api/vehiclesCreate new vehicleYes (future)PUT/api/vehicles/:idUpdate vehicleYes (future)DELETE/api/vehicles/:idDelete vehicleYes (future)POST/api/contactSubmit contact formNo
Example Requests
Fetch all vehicles:
javascriptfetch('/api/vehicles')
  .then(response => response.json())
  .then(data => console.log(data));
Get single vehicle:
javascriptfetch('/api/vehicles/4')
  .then(response => response.json())
  .then(vehicle => console.log(vehicle));
Create new vehicle (multipart/form-data):
javascriptconst formData = new FormData();
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
Submit contact form:
javascriptfetch('/api/contact', {
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

💾 Backup & Restore
Create Backup
bashnpm run backup:db
Output:
✅ Backup created: backups/cars-2025-01-15T10-30-00-000Z.db
Backups are timestamped and stored in the backups/ directory.
Restore from Backup
Interactive mode (shows list of available backups):
bashnpm run restore:db
Direct restore (specify backup file):
bashnpm run restore:db -- backups/cars-2025-01-15T10-30-00-000Z.db
Safety feature: Restoring automatically backs up your current cars.db first, so you never lose data.
Best Practices

Backup before major changes
Keep at least 3-5 recent backups
Test restores periodically
Store critical backups off-site (cloud storage)


🌐 Deployment
Prerequisites for Production

Update server.js to use environment variable for port
Set up .env with production email credentials
Configure a process manager (PM2 recommended)
Set up reverse proxy (nginx/Apache)
Implement admin authentication
Enable SSL/HTTPS

Recommended Platforms

Railway - Zero-config deployment with database hosting
Heroku - Classic PaaS (requires PostgreSQL addon for production)
DigitalOcean App Platform - Simple and affordable
VPS (DigitalOcean, Linode, Vultr) - Full control with nginx + PM2

Quick Deploy with Railway
bash# Install Railway CLI
npm i -g @railway/cli

# Login and initialize
railway login
railway init

# Deploy
railway up
VPS Deployment with PM2
bash# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start server.js --name bell-auto-sales

# Enable startup script
pm2 startup
pm2 save

# Monitor
pm2 monit
Nginx Configuration Example
nginxserver {
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
Production Checklist

 Environment variables configured (.env)
 Database backed up regularly (cron job)
 SSL certificate installed (Let's Encrypt)
 Admin routes protected with authentication
 Error monitoring set up (Sentry, LogRocket)
 Rate limiting implemented
 File upload limits configured
 CORS properly configured
 Security headers added (Helmet.js)
 Regular security updates scheduled


🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.
How to Contribute

Fork the repository
Create your feature branch (git checkout -b feature/AmazingFeature)
Commit your changes (git commit -m 'Add some AmazingFeature')
Push to the branch (git push origin feature/AmazingFeature)
Open a Pull Request

Contribution Guidelines

Follow existing code style and conventions
Add comments for complex logic
Update documentation for new features
Test thoroughly before submitting
Keep commits focused and atomic


📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

📧 Contact
Reginald Bell - @ReginaldBell
Project Link: https://github.com/ReginaldBell/Bell-Auto-Sales
Live Demo: https://bs-auto-sales.org

🙏 Acknowledgments

Built with Node.js and Express
SQLite for reliable, portable data storage
Inspired by modern dealership management systems
Community feedback and contributions


🔮 Future Enhancements

 User authentication for admin panel
 Advanced search and filtering
 Vehicle comparison feature
 Customer reviews and ratings
 Financing calculator
 Appointment scheduling system
 SMS notifications
 Analytics dashboard
 Multi-location support
 API rate limiting


⭐ If this project helped you, please consider giving it a star on GitHub!

📊 Project Stats
Show Image
Show Image
Show Image
Show Image
