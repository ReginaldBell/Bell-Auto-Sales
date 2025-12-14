# Admin Authentication Test Checklist

## Quick Setup

Set the admin password via environment variable (or use default `bell1234` in development):

```powershell
$env:ADMIN_PASSWORD = "your-secure-password"
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
# Expected: {"success":true,"csrfToken":"...","expiresAt":"..."}
```

### ❌ Failed Login (wrong password)
```powershell
$body = '{"password": "wrongpassword"}'
Invoke-WebRequest -Uri "http://localhost:8080/api/admin/login" -Method POST -Body $body -ContentType "application/json"
# Expected: 401 {"error":"Invalid password"}
```

### 🔒 Rate Limiting on Login (5 attempts/15min)
```powershell
# After 5 failed attempts:
for ($i = 1; $i -le 6; $i++) {
  try {
    $body = '{"password": "wrong"}'
    Invoke-WebRequest -Uri "http://localhost:8080/api/admin/login" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
  } catch {
    Write-Host "Attempt $i - Status: $($_.Exception.Response.StatusCode)"
  }
}
# Expected: 429 on 6th attempt
```

---

## 2. Session Tests

### Check Session Status (Not Logged In)
```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/admin/session" -Method GET
# Expected: {"authenticated":false,"expiresAt":null}
```

### Check Session Status (Logged In)
```powershell
# First login, then check session
$body = '{"password": "bell1234"}'
$login = Invoke-WebRequest -Uri "http://localhost:8080/api/admin/login" -Method POST -Body $body -ContentType "application/json" -SessionVariable session
Invoke-WebRequest -Uri "http://localhost:8080/api/admin/session" -Method GET -WebSession $session
# Expected: {"authenticated":true,"expiresAt":"2025-12-13T..."}
```

---

## 3. Protected Route Tests

### ❌ POST Vehicle Without Auth
```powershell
$body = '{"year": "2024", "make": "Test", "model": "NoAuth", "price": "1000"}'
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method POST -Body $body -ContentType "application/json"
# Expected: 401 {"error":"Authentication required"}
```

### ❌ PUT Vehicle Without Auth
```powershell
$body = '{"year": "2024", "make": "Test", "model": "NoAuth", "price": "1000"}'
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles/1" -Method PUT -Body $body -ContentType "application/json"
# Expected: 401 {"error":"Authentication required"}
```

### ❌ DELETE Vehicle Without Auth
```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles/1" -Method DELETE
# Expected: 401 {"error":"Authentication required"}
```

### ✅ GET Vehicles (Public - No Auth Required)
```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method GET
# Expected: 200 with list of vehicles
```

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
# Expected: 403 {"error":"Invalid or missing CSRF token"}
```

### ✅ POST With Valid CSRF Token
```powershell
# Login and get CSRF token
$body = '{"password": "bell1234"}'
$login = Invoke-WebRequest -Uri "http://localhost:8080/api/admin/login" -Method POST -Body $body -ContentType "application/json" -SessionVariable session
$loginData = $login.Content | ConvertFrom-Json
$csrfToken = $loginData.csrfToken

# Make POST with CSRF token
$headers = @{ "X-CSRF-Token" = $csrfToken }
$body = '{"year": "2024", "make": "Test", "model": "WithCSRF", "price": "1000"}'
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method POST -Body $body -ContentType "application/json" -Headers $headers -WebSession $session
# Expected: 201 {"id": ...}
```

### ✅ Get Fresh CSRF Token
```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/admin/csrf-token" -Method GET -WebSession $session
# Expected: {"csrfToken":"..."}
```

---

## 5. Logout Tests

### ✅ Successful Logout
```powershell
# Login first
$body = '{"password": "bell1234"}'
$login = Invoke-WebRequest -Uri "http://localhost:8080/api/admin/login" -Method POST -Body $body -ContentType "application/json" -SessionVariable session

# Logout
Invoke-WebRequest -Uri "http://localhost:8080/api/admin/logout" -Method POST -WebSession $session
# Expected: {"success":true}

# Verify session is destroyed
Invoke-WebRequest -Uri "http://localhost:8080/api/admin/session" -Method GET -WebSession $session
# Expected: {"authenticated":false,"expiresAt":null}
```

---

## 6. Cookie Security Tests

### Verify HttpOnly Cookie
```powershell
$body = '{"password": "bell1234"}'
$login = Invoke-WebRequest -Uri "http://localhost:8080/api/admin/login" -Method POST -Body $body -ContentType "application/json" -SessionVariable session
$session.Cookies.GetCookies("http://localhost:8080") | Format-Table Name, HttpOnly, Secure
# Expected: bell_sid cookie with HttpOnly=True
# Note: Secure=False in development, True in production
```

---

## 7. Browser Testing

### Admin Dashboard Flow
1. Open http://localhost:8080/admin.html
2. Enter password: `bell1234`
3. Click Login
4. **Verify**: Dashboard loads, inventory visible
5. Try adding a vehicle
6. **Verify**: Vehicle appears in list
7. Try editing a vehicle
8. **Verify**: Changes saved
9. Try deleting a vehicle
10. **Verify**: Vehicle removed
11. Click Logout
12. **Verify**: Returns to login screen
13. Refresh page
14. **Verify**: Still on login screen (session destroyed)

### Session Persistence Test
1. Login to admin
2. Close browser tab (not whole browser)
3. Open http://localhost:8080/admin.html again
4. **Verify**: Still logged in (session cookie persists)

### Session Expiry Test
1. Login to admin
2. Wait 8+ hours (or modify maxAge in server.js for testing)
3. Try to perform an action
4. **Verify**: Redirected to login screen

---

## 8. Audit Log Verification

Check server console for audit entries:

```
[AUDIT] {"timestamp":"...","action":"LOGIN_SUCCESS","ip":"::1"}
[AUDIT] {"timestamp":"...","action":"CREATE_VEHICLE","id":1,"make":"Test","model":"Car"}
[AUDIT] {"timestamp":"...","action":"UPDATE_VEHICLE","id":1,"make":"Test","model":"Car"}
[AUDIT] {"timestamp":"...","action":"DELETE_VEHICLE","id":1}
[AUDIT] {"timestamp":"...","action":"LOGOUT","ip":"::1"}
[AUDIT] {"timestamp":"...","action":"LOGIN_FAILED","ip":"::1"}
[AUDIT] {"timestamp":"...","action":"LOGIN_RATE_LIMIT","ip":"::1"}
[AUDIT] {"timestamp":"...","action":"CSRF_VIOLATION","ip":"::1","path":"/api/vehicles","method":"POST"}
```

---

## Security Features Summary

| Feature | Implementation | Status |
|---------|---------------|--------|
| Session-based Auth | express-session + connect-sqlite3 | ✅ |
| HttpOnly Cookies | `cookie.httpOnly: true` | ✅ |
| Secure Cookies (prod) | `cookie.secure: isProduction` | ✅ |
| SameSite Cookies | `strict` in prod, `lax` in dev | ✅ |
| CSRF Protection | csrf-csrf with double-submit | ✅ |
| Login Rate Limiting | 5 attempts / 15 minutes | ✅ |
| Session Expiry | 8 hours with rolling refresh | ✅ |
| Timing-Safe Comparison | `crypto.timingSafeEqual` | ✅ |
| Session Fixation Prevention | `session.regenerate()` on login | ✅ |
| Audit Logging | All auth events logged | ✅ |
| Password from Env | `ADMIN_PASSWORD` env var | ✅ |
| Public GET Preserved | `/api/vehicles` GET is public | ✅ |

---

## Production Deployment Checklist

Before deploying to production:

1. **Set environment variables:**
   ```bash
   export ADMIN_PASSWORD="your-very-secure-password"
   export SESSION_SECRET="$(openssl rand -hex 32)"
   export NODE_ENV="production"
   export CORS_ORIGIN="https://yourdomain.com"
   ```

2. **Use HTTPS** - Required for `secure: true` cookies

3. **Consider additional measures:**
   - Add 2FA for admin login
   - Use a reverse proxy (nginx/Cloudflare)
   - Set up proper log aggregation
   - Consider IP allowlisting for admin routes
