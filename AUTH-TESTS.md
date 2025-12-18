# 🔐 Admin Authentication - Testing Guide

Complete test suite for verifying admin authentication, session management, and CSRF protection.

---

## 🚀 Quick Setup

Set the admin password via environment variable (or use default `bell1234` in development):

```powershell
$env:ADMIN_PASSWORD = "your-secure-password"
node server.js
```

```bash
# macOS/Linux
export ADMIN_PASSWORD="your-secure-password"
node server.js
```

---

## 1. Login Tests

### ✅ Successful Login

```powershell
# Login with correct password
$body = '{"password": "bell1234"}'
$response = Invoke-WebRequest -Uri "http://localhost:8080/api/admin/login" -Method POST -Body $body -ContentType "application/json" -SessionVariable session
$response.Content
```

**Expected Response:**
```json
{
  "success": true,
  "csrfToken": "abc123...",
  "expiresAt": "2025-12-18T02:30:00.000Z"
}
```

---

### ❌ Failed Login (Wrong Password)

```powershell
$body = '{"password": "wrongpassword"}'
Invoke-WebRequest -Uri "http://localhost:8080/api/admin/login" -Method POST -Body $body -ContentType "application/json"
```

**Expected Response:**
- **Status:** 401 Unauthorized
- **Body:** `{"error": "Invalid password"}`

---

### 🔒 Rate Limiting on Login (5 attempts/15min)

```powershell
# Test rate limiting - should fail on 6th attempt
for ($i = 1; $i -le 6; $i++) {
  try {
    $body = '{"password": "wrong"}'
    Invoke-WebRequest -Uri "http://localhost:8080/api/admin/login" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
    Write-Host "Attempt $i - Allowed"
  } catch {
    Write-Host "Attempt $i - Status: $($_.Exception.Response.StatusCode)"
  }
}
```

**Expected Result:**
- Attempts 1-5: 401 Unauthorized
- Attempt 6+: **429 Too Many Requests**

---

## 2. Session Tests

### Check Session Status (Not Logged In)

```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/admin/session" -Method GET
```

**Expected Response:**
```json
{
  "authenticated": false,
  "expiresAt": null
}
```

---

### Check Session Status (Logged In)

```powershell
# First login
$body = '{"password": "bell1234"}'
$login = Invoke-WebRequest -Uri "http://localhost:8080/api/admin/login" -Method POST -Body $body -ContentType "application/json" -SessionVariable session

# Then check session
Invoke-WebRequest -Uri "http://localhost:8080/api/admin/session" -Method GET -WebSession $session
```

**Expected Response:**
```json
{
  "authenticated": true,
  "expiresAt": "2025-12-18T02:30:00.000Z"
}
```

---

## 3. Protected Route Tests

### ❌ POST Vehicle Without Auth

```powershell
$body = '{"year": "2024", "make": "Test", "model": "NoAuth", "price": "1000"}'
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method POST -Body $body -ContentType "application/json"
```

**Expected Response:**
- **Status:** 401 Unauthorized
- **Body:** `{"error": "Authentication required"}`

---

### ❌ PUT Vehicle Without Auth

```powershell
$body = '{"year": "2024", "make": "Test", "model": "NoAuth", "price": "1000"}'
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles/1" -Method PUT -Body $body -ContentType "application/json"
```

**Expected Response:**
- **Status:** 401 Unauthorized
- **Body:** `{"error": "Authentication required"}`

---

### ❌ DELETE Vehicle Without Auth

```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles/1" -Method DELETE
```

**Expected Response:**
- **Status:** 401 Unauthorized
- **Body:** `{"error": "Authentication required"}`

---

### ✅ GET Vehicles (Public - No Auth Required)

```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method GET
```

**Expected Response:**
- **Status:** 200 OK
- **Body:** Array of vehicles (public data remains accessible)

---

## 4. CSRF Protection Tests

### ❌ POST Without CSRF Token

```powershell
# Login first
$body = '{"password": "bell1234"}'
$login = Invoke-WebRequest -Uri "http://localhost:8080/api/admin/login" -Method POST -Body $body -ContentType "application/json" -SessionVariable session

# Try POST without CSRF token
$body = '{"year": "2024", "make": "Test", "model": "NoCSRF", "price": "1000"}'
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method POST -Body $body -ContentType "application/json" -WebSession $session
```

**Expected Response:**
- **Status:** 403 Forbidden
- **Body:** `{"error": "Invalid or missing CSRF token"}`

---

### ✅ POST With Valid CSRF Token

```powershell
# Login and extract CSRF token
$body = '{"password": "bell1234"}'
$login = Invoke-WebRequest -Uri "http://localhost:8080/api/admin/login" -Method POST -Body $body -ContentType "application/json" -SessionVariable session
$loginData = $login.Content | ConvertFrom-Json
$csrfToken = $loginData.csrfToken

# Make POST with CSRF token in header
$headers = @{ "X-CSRF-Token" = $csrfToken }
$body = '{"year": "2024", "make": "Test", "model": "WithCSRF", "price": "1000"}'
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method POST -Body $body -ContentType "application/json" -Headers $headers -WebSession $session
```

**Expected Response:**
- **Status:** 201 Created
- **Body:** `{"id": 5, "year": "2024", ...}`

---

### ✅ Get Fresh CSRF Token

```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/admin/csrf-token" -Method GET -WebSession $session
```

**Expected Response:**
```json
{
  "csrfToken": "xyz789..."
}
```

**Use case:** When the CSRF token expires or is lost, fetch a new one.

---

## 5. Logout Tests

### ✅ Successful Logout

```powershell
# Login first
$body = '{"password": "bell1234"}'
$login = Invoke-WebRequest -Uri "http://localhost:8080/api/admin/login" -Method POST -Body $body -ContentType "application/json" -SessionVariable session

# Logout
Invoke-WebRequest -Uri "http://localhost:8080/api/admin/logout" -Method POST -WebSession $session

# Verify session is destroyed
Invoke-WebRequest -Uri "http://localhost:8080/api/admin/session" -Method GET -WebSession $session
```

**Expected Logout Response:**
```json
{
  "success": true
}
```

**Expected Session Check After Logout:**
```json
{
  "authenticated": false,
  "expiresAt": null
}
```

---

## 6. Cookie Security Tests

### Verify HttpOnly Cookie

```powershell
$body = '{"password": "bell1234"}'
$login = Invoke-WebRequest -Uri "http://localhost:8080/api/admin/login" -Method POST -Body $body -ContentType "application/json" -SessionVariable session
$session.Cookies.GetCookies("http://localhost:8080") | Format-Table Name, HttpOnly, Secure
```

**Expected Output:**
```
Name      HttpOnly Secure
----      -------- ------
bell_sid  True     False  (False in dev, True in production)
```

**Security Properties:**
- **HttpOnly:** Prevents JavaScript access to cookie (XSS protection)
- **Secure:** Only sent over HTTPS in production
- **SameSite:** `strict` in production, `lax` in development

---

## 7. Browser Testing

### Admin Dashboard Flow

**Step-by-Step Test:**

1. Open `http://localhost:8080/admin.html`
2. Enter password: `bell1234`
3. Click **Login**
4. ✅ **Verify:** Dashboard loads, inventory visible
5. Click **Add Vehicle** and fill out form
6. ✅ **Verify:** Vehicle appears in list
7. Click **Edit** on a vehicle and modify data
8. ✅ **Verify:** Changes saved successfully
9. Click **Delete** on a vehicle
10. ✅ **Verify:** Vehicle removed from list
11. Click **Logout**
12. ✅ **Verify:** Returns to login screen
13. Refresh the page
14. ✅ **Verify:** Still on login screen (session destroyed)

---

### Session Persistence Test

**Test session cookie persistence:**

1. Login to admin panel
2. Close browser tab (not entire browser)
3. Open `http://localhost:8080/admin.html` again
4. ✅ **Verify:** Still logged in (session cookie persists)

---

### Session Expiry Test

**Test automatic session expiration:**

1. Login to admin panel
2. Wait 8+ hours (or temporarily modify `maxAge` in `server.js` for testing)
3. Try to perform any action (add/edit/delete vehicle)
4. ✅ **Verify:** Redirected to login screen with "Session expired" message

---

## 8. Audit Log Verification

Check server console for audit entries after performing actions:

**Expected Log Entries:**

```
[AUDIT] {"timestamp":"2025-12-17T18:30:00.000Z","action":"LOGIN_SUCCESS","ip":"::1"}
[AUDIT] {"timestamp":"2025-12-17T18:31:00.000Z","action":"CREATE_VEHICLE","id":1,"make":"Test","model":"Car"}
[AUDIT] {"timestamp":"2025-12-17T18:32:00.000Z","action":"UPDATE_VEHICLE","id":1,"make":"Test","model":"Car"}
[AUDIT] {"timestamp":"2025-12-17T18:33:00.000Z","action":"DELETE_VEHICLE","id":1}
[AUDIT] {"timestamp":"2025-12-17T18:34:00.000Z","action":"LOGOUT","ip":"::1"}
[AUDIT] {"timestamp":"2025-12-17T18:35:00.000Z","action":"LOGIN_FAILED","ip":"::1"}
[AUDIT] {"timestamp":"2025-12-17T18:36:00.000Z","action":"LOGIN_RATE_LIMIT","ip":"::1"}
[AUDIT] {"timestamp":"2025-12-17T18:37:00.000Z","action":"CSRF_VIOLATION","ip":"::1","path":"/api/vehicles","method":"POST"}
```

---

## 🛡️ Security Features Summary

| Feature | Implementation | Status |
|---------|---------------|--------|
| **Session-based Auth** | express-session + connect-sqlite3 | ✅ |
| **HttpOnly Cookies** | `cookie.httpOnly: true` | ✅ |
| **Secure Cookies** | `cookie.secure: isProduction` | ✅ |
| **SameSite Cookies** | `strict` in prod, `lax` in dev | ✅ |
| **CSRF Protection** | csrf-csrf with double-submit pattern | ✅ |
| **Login Rate Limiting** | 5 attempts per 15 minutes | ✅ |
| **Session Expiry** | 8 hours with rolling refresh | ✅ |
| **Timing-Safe Comparison** | `crypto.timingSafeEqual()` | ✅ |
| **Session Fixation Prevention** | `session.regenerate()` on login | ✅ |
| **Audit Logging** | All auth events logged | ✅ |
| **Password from Env** | `ADMIN_PASSWORD` environment variable | ✅ |
| **Public GET Preserved** | `/api/vehicles` GET remains public | ✅ |

---

## 🚀 Production Deployment Checklist

Before deploying to production:

### 1. Set Environment Variables

```bash
# Required
export ADMIN_PASSWORD="your-very-secure-password-min-12-chars"
export SESSION_SECRET="$(openssl rand -hex 32)"
export NODE_ENV="production"

# Optional
export CORS_ORIGIN="https://yourdomain.com"
export PORT="8080"
```

**PowerShell (Windows):**
```powershell
$env:ADMIN_PASSWORD = "your-very-secure-password-min-12-chars"
$env:SESSION_SECRET = "generated-secret-key"
$env:NODE_ENV = "production"
```

---

### 2. Use HTTPS

**Required for secure cookies!**

- Deploy behind reverse proxy (nginx, Cloudflare)
- Use Let's Encrypt for free SSL certificates
- Ensure `cookie.secure: true` is set (automatic in production)

---

### 3. Additional Security Measures

**Recommended enhancements:**

- [ ] **2FA/TOTP** - Add two-factor authentication
- [ ] **IP Allowlisting** - Restrict admin access by IP
- [ ] **Reverse Proxy** - Use nginx or Cloudflare
- [ ] **Log Aggregation** - Send logs to centralized system (Papertrail, Logtail)
- [ ] **Monitoring** - Set up alerts for failed login attempts
- [ ] **Password Policy** - Enforce strong passwords (min 12 chars)
- [ ] **Backup Sessions** - Consider Redis for session storage
- [ ] **Account Lockout** - Temporary ban after X failed attempts

---

### 4. Password Security Best Practices

**For production admin passwords:**

```bash
# Generate a strong password
openssl rand -base64 32

# Example strong password
Admin2024!SecureP@ssw0rd$Bell#Auto
```

**Requirements:**
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- Avoid common words or patterns
- Store in environment variable, never in code
- Rotate periodically (every 90 days)

---

## 🧪 Automated Testing

### Quick Test Script

Save as `test-auth.ps1`:

```powershell
# Test suite for admin authentication
$baseUrl = "http://localhost:8080"

Write-Host "=== Admin Auth Test Suite ===" -ForegroundColor Cyan

# Test 1: Login
Write-Host "`n[TEST] Login with correct password" -ForegroundColor Yellow
$body = '{"password": "bell1234"}'
try {
  $login = Invoke-WebRequest -Uri "$baseUrl/api/admin/login" -Method POST -Body $body -ContentType "application/json" -SessionVariable session
  $loginData = $login.Content | ConvertFrom-Json
  Write-Host "✅ PASS - Logged in successfully" -ForegroundColor Green
  Write-Host "   CSRF Token: $($loginData.csrfToken.Substring(0,20))..."
} catch {
  Write-Host "❌ FAIL - Login failed" -ForegroundColor Red
}

# Test 2: Protected route without CSRF
Write-Host "`n[TEST] POST without CSRF token" -ForegroundColor Yellow
$body = '{"year": "2024", "make": "Test", "model": "Test", "price": "1000"}'
try {
  Invoke-WebRequest -Uri "$baseUrl/api/vehicles" -Method POST -Body $body -ContentType "application/json" -WebSession $session -ErrorAction Stop
  Write-Host "❌ FAIL - Should have been blocked" -ForegroundColor Red
} catch {
  if ($_.Exception.Response.StatusCode -eq 403) {
    Write-Host "✅ PASS - Correctly blocked (403 Forbidden)" -ForegroundColor Green
  }
}

# Test 3: Protected route with CSRF
Write-Host "`n[TEST] POST with valid CSRF token" -ForegroundColor Yellow
$headers = @{ "X-CSRF-Token" = $loginData.csrfToken }
try {
  $response = Invoke-WebRequest -Uri "$baseUrl/api/vehicles" -Method POST -Body $body -ContentType "application/json" -Headers $headers -WebSession $session
  Write-Host "✅ PASS - Vehicle created with auth" -ForegroundColor Green
} catch {
  Write-Host "❌ FAIL - Should have succeeded" -ForegroundColor Red
}

# Test 4: Logout
Write-Host "`n[TEST] Logout" -ForegroundColor Yellow
try {
  Invoke-WebRequest -Uri "$baseUrl/api/admin/logout" -Method POST -WebSession $session | Out-Null
  Write-Host "✅ PASS - Logged out successfully" -ForegroundColor Green
} catch {
  Write-Host "❌ FAIL - Logout failed" -ForegroundColor Red
}

Write-Host "`n=== Test Suite Complete ===" -ForegroundColor Cyan
```

**Run tests:**
```powershell
.\test-auth.ps1
```

---

## 📚 API Reference

### Authentication Endpoints

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| POST | `/api/admin/login` | Login to admin | `{"password": "..."}` |
| POST | `/api/admin/logout` | Logout and destroy session | None |
| GET | `/api/admin/session` | Check session status | None |
| GET | `/api/admin/csrf-token` | Get fresh CSRF token | None |

### Protected Endpoints

| Method | Endpoint | Auth Required | CSRF Required |
|--------|----------|--------------|---------------|
| GET | `/api/vehicles` | ❌ No | ❌ No |
| GET | `/api/vehicles/:id` | ❌ No | ❌ No |
| POST | `/api/vehicles` | ✅ Yes | ✅ Yes |
| PUT | `/api/vehicles/:id` | ✅ Yes | ✅ Yes |
| DELETE | `/api/vehicles/:id` | ✅ Yes | ✅ Yes |

---

## ❓ Troubleshooting

### Issue: "Invalid or missing CSRF token"

**Solution:** Include CSRF token in request header:
```javascript
headers: {
  'X-CSRF-Token': csrfToken
}
```

### Issue: Session expires too quickly

**Solution:** Adjust `maxAge` in `server.js`:
```javascript
maxAge: 8 * 60 * 60 * 1000  // 8 hours (default)
```

### Issue: Can't login with correct password

**Check:**
1. Environment variable is set: `echo $env:ADMIN_PASSWORD`
2. Server was restarted after setting env var
3. No extra whitespace in password
4. Check server logs for errors

### Issue: Cookies not persisting

**Check:**
1. Browser allows cookies
2. Not using incognito/private mode
3. `sameSite` setting matches your setup (dev vs prod)

---

## 📖 Related Documentation

- [Security Test Checklist](./security-tests.md) - General security testing
- [API Documentation](../README.md#api-documentation) - Full API reference
- [Deployment Guide](../README.md#deployment) - Production setup

---

**💡 Tip:** For testing, use a tool like [Postman](https://www.postman.com/) or [Insomnia](https://insomnia.rest/) to easily manage sessions and CSRF tokens.
