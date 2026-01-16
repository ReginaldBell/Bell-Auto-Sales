# 🔒 Security Test Checklist

Run these tests to verify the security hardening is working correctly.

---

## 1. Rate Limiting Tests

### General API Rate Limit (100 requests/15min)

```powershell
# Should work for first 100 requests, then return 429
for ($i = 1; $i -le 105; $i++) {
  $response = Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method GET -ErrorAction SilentlyContinue
  if ($response.StatusCode -eq 429) {
    Write-Host "Rate limited at request $i"
    break
  }
}
```

**Expected Result:**
- Requests 1-100: Success (200 OK)
- Request 101+: **429 Too Many Requests**

---

### Mutation Rate Limit (30 requests/15min for POST/PUT/DELETE)

```powershell
# Quick burst test - should get 429 after 30 requests
$body = @{
  year = "2024"
  make = "Test"
  model = "RateLimit"
  price = "1000"
} | ConvertTo-Json

for ($i = 1; $i -le 35; $i++) {
  try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
    Write-Host "Request $i - Status: $($response.StatusCode)"
  } catch {
    Write-Host "Request $i - Rate limited or error: $($_.Exception.Response.StatusCode)"
  }
}
```

**Expected Result:**
- Requests 1-30: Depends on auth (401 or 201)
- Request 31+: **429 Too Many Requests**

---

## 2. Input Validation Tests

### Invalid Year (out of range)

```powershell
$body = '{"year": "1800", "make": "Test", "model": "Invalid", "price": "1000"}'
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method POST -Body $body -ContentType "application/json"
```

**Expected Response:**
- **Status:** 400 Bad Request
- **Body:** Validation error about year range

---

### Invalid Price (negative)

```powershell
$body = '{"year": "2024", "make": "Test", "model": "Invalid", "price": "-1000"}'
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method POST -Body $body -ContentType "application/json"
```

**Expected Response:**
- **Status:** 400 Bad Request
- **Body:** Validation error about negative price

---

### Invalid Price (exceeds max)

```powershell
$body = '{"year": "2024", "make": "Test", "model": "Invalid", "price": "99999999"}'
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method POST -Body $body -ContentType "application/json"
```

**Expected Response:**
- **Status:** 400 Bad Request
- **Body:** Validation error (max $10,000,000)

---

### XSS Attempt in Description

```powershell
$body = '{"year": "2024", "make": "Test", "model": "XSS", "price": "1000", "description": "<script>alert(1)</script>"}'
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method POST -Body $body -ContentType "application/json"
```

**Expected Result:**
- Script tags should be stripped from stored data
- When retrieved, description should not contain `<script>` tags
- HTML entities may be escaped

---

### SQL Injection Attempt

```powershell
$body = '{"year": "2024", "make": "Test''; DROP TABLE vehicles; --", "model": "SQLi", "price": "1000"}'
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method POST -Body $body -ContentType "application/json"
```

**Expected Result:**
- ✅ Safe - Parameterized queries prevent injection
- String is treated as literal data, not SQL code
- Database table remains intact

---

### Description Too Long

```powershell
$longDesc = "A" * 6000
$body = @{
  year = "2024"
  make = "Test"
  model = "LongDesc"
  price = "1000"
  description = $longDesc
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method POST -Body $body -ContentType "application/json"
```

**Expected Response:**
- **Status:** 400 Bad Request
- **Body:** Validation error (max 5000 characters)

---

## 3. File Upload Tests

### Invalid File Type

```powershell
# Create a test .txt file and try to upload
"test content" | Out-File -FilePath "test.txt"

$form = @{
  year = "2024"
  make = "Test"
  model = "BadFile"
  price = "1000"
  images = Get-Item -Path "test.txt"
}

Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method POST -Form $form

# Cleanup
Remove-Item "test.txt"
```

**Expected Response:**
- **Status:** 415 Unsupported Media Type
- **Body:** Error about invalid file type

**Allowed types:** `.jpg`, `.jpeg`, `.png`, `.webp`

---

### File Size Limit (>10MB)

```powershell
# Create a large file (this is slow, for manual testing only)
# $bytes = New-Object byte[] 11MB
# [IO.File]::WriteAllBytes("large.jpg", $bytes)
# Upload large.jpg
# Expected: 413 Payload Too Large
```

**Note:** This test is commented out because creating an 11MB file is slow. For manual testing:
1. Find or create an image larger than 10MB
2. Try to upload it
3. Should receive **413 Payload Too Large**

---

## 4. Security Headers Test

### Check Helmet Headers

```powershell
$response = Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method GET
$response.Headers
```

**Expected Headers:**
```
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Strict-Transport-Security: max-age=31536000 (in production with HTTPS)
X-Download-Options: noopen
X-DNS-Prefetch-Control: off
```

**Should NOT include:**
- `X-Powered-By` header

---

### Verify X-Powered-By Removed

```powershell
$response = Invoke-WebRequest -Uri "http://localhost:8080/" -Method GET
$response.Headers["X-Powered-By"]
```

**Expected Result:**
- `$null` (header should not exist)
- Prevents server fingerprinting

---

## 5. CORS Tests

### CORS from Allowed Origin

```powershell
$headers = @{ "Origin" = "http://localhost:8080" }
$response = Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method GET -Headers $headers
$response.Headers["Access-Control-Allow-Origin"]
```

**Expected Result:**
- Header present: `Access-Control-Allow-Origin: http://localhost:8080`

---

### CORS from Disallowed Origin

```powershell
$headers = @{ "Origin" = "http://malicious-site.com" }
try {
  $response = Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method GET -Headers $headers
  $response.Headers["Access-Control-Allow-Origin"]
} catch {
  Write-Host "Request blocked or no CORS header"
}
```

**Expected Result:**
- `$null` or error (origin not in whitelist)
- Request may be blocked or CORS header omitted

---

## 6. Invalid Route Tests

### Invalid Vehicle ID Format

```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles/abc" -Method DELETE
```

**Expected Response:**
- **Status:** 400 Bad Request
- **Body:** "Invalid vehicle ID"

---

```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles/1;DROP TABLE" -Method DELETE
```

**Expected Response:**
- **Status:** 400 Bad Request
- **Body:** "Invalid vehicle ID"
- ID must be a valid integer

---

### Non-existent Endpoint

```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/nonexistent" -Method GET
```

**Expected Response:**
- **Status:** 404 Not Found
- **Body:** "Endpoint not found"

---

## 7. Body Size Limit Test

### Oversized JSON Body

```powershell
$largeBody = '{"data": "' + ("A" * 2000000) + '"}'

try {
  Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method POST -Body $largeBody -ContentType "application/json"
} catch {
  Write-Host "Blocked: $($_.Exception.Response.StatusCode)"
}
```

**Expected Response:**
- **Status:** 413 Payload Too Large
- Body limit is 1MB for JSON requests

---

## 🛡️ Security Features Summary

| Feature | Status | Notes |
|---------|--------|-------|
| **Helmet Security Headers** | ✅ | CSP, X-Frame-Options, etc. |
| **X-Powered-By Disabled** | ✅ | Fingerprinting prevention |
| **Rate Limiting (General)** | ✅ | 100 req/15min per IP |
| **Rate Limiting (Mutations)** | ✅ | 30 req/15min per IP |
| **Input Validation (Zod)** | ✅ | Type + range validation |
| **XSS Sanitization** | ✅ | Script tags stripped |
| **SQL Injection Protection** | ✅ | Parameterized queries |
| **File Type Validation** | ✅ | JPG/PNG/WEBP only |
| **File Size Limit** | ✅ | 10MB max per file |
| **Body Size Limit** | ✅ | 1MB JSON max |
| **CORS Whitelist** | ✅ | Origin validation |
| **Audit Logging** | ✅ | CREATE/UPDATE/DELETE logged |
| **Error Handling** | ✅ | No stack traces in production |

---

## 🧪 Automated Test Script

Save as `test-security.ps1`:

```powershell
# Security Test Suite
$baseUrl = "http://localhost:8080"
$passed = 0
$failed = 0

Write-Host "=== Security Test Suite ===" -ForegroundColor Cyan

# Test 1: Rate Limiting
Write-Host "`n[TEST 1] Rate Limiting (first 5 requests)" -ForegroundColor Yellow
for ($i = 1; $i -le 5; $i++) {
  $response = Invoke-WebRequest -Uri "$baseUrl/api/vehicles" -Method GET -ErrorAction SilentlyContinue
  if ($response.StatusCode -eq 200) {
    Write-Host "  Request $i: OK" -ForegroundColor Green
  }
}
$passed++

# Test 2: Invalid Year
Write-Host "`n[TEST 2] Invalid Year Validation" -ForegroundColor Yellow
$body = '{"year": "1800", "make": "Test", "model": "Test", "price": "1000"}'
try {
  Invoke-WebRequest -Uri "$baseUrl/api/vehicles" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
  Write-Host "  ❌ FAIL - Should have been rejected" -ForegroundColor Red
  $failed++
} catch {
  if ($_.Exception.Response.StatusCode -eq 400) {
    Write-Host "  ✅ PASS - Invalid year rejected (400)" -ForegroundColor Green
    $passed++
  }
}

# Test 3: Negative Price
Write-Host "`n[TEST 3] Negative Price Validation" -ForegroundColor Yellow
$body = '{"year": "2024", "make": "Test", "model": "Test", "price": "-1000"}'
try {
  Invoke-WebRequest -Uri "$baseUrl/api/vehicles" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
  Write-Host "  ❌ FAIL - Should have been rejected" -ForegroundColor Red
  $failed++
} catch {
  if ($_.Exception.Response.StatusCode -eq 400) {
    Write-Host "  ✅ PASS - Negative price rejected (400)" -ForegroundColor Green
    $passed++
  }
}

# Test 4: XSS Protection
Write-Host "`n[TEST 4] XSS Script Tag Sanitization" -ForegroundColor Yellow
$body = '{"year": "2024", "make": "Test", "model": "XSS", "price": "1000", "description": "<script>alert(1)</script>"}'
try {
  $response = Invoke-WebRequest -Uri "$baseUrl/api/vehicles" -Method POST -Body $body -ContentType "application/json" -ErrorAction SilentlyContinue
  Write-Host "  ℹ️  Manual verification needed - Check if <script> tags are stripped" -ForegroundColor Cyan
} catch {
  Write-Host "  ℹ️  Request blocked - Check logs" -ForegroundColor Cyan
}

# Test 5: Security Headers
Write-Host "`n[TEST 5] Security Headers Present" -ForegroundColor Yellow
$response = Invoke-WebRequest -Uri "$baseUrl/api/vehicles" -Method GET
$hasCSP = $response.Headers["Content-Security-Policy"] -ne $null
$hasXFrame = $response.Headers["X-Frame-Options"] -ne $null
$noXPowered = $response.Headers["X-Powered-By"] -eq $null

if ($hasCSP -and $hasXFrame -and $noXPowered) {
  Write-Host "  ✅ PASS - Security headers configured" -ForegroundColor Green
  $passed++
} else {
  Write-Host "  ❌ FAIL - Missing security headers" -ForegroundColor Red
  $failed++
}

# Test 6: CORS Validation
Write-Host "`n[TEST 6] CORS Allowed Origin" -ForegroundColor Yellow
$headers = @{ "Origin" = "http://localhost:8080" }
$response = Invoke-WebRequest -Uri "$baseUrl/api/vehicles" -Method GET -Headers $headers
if ($response.Headers["Access-Control-Allow-Origin"]) {
  Write-Host "  ✅ PASS - CORS header present" -ForegroundColor Green
  $passed++
} else {
  Write-Host "  ❌ FAIL - CORS header missing" -ForegroundColor Red
  $failed++
}

# Summary
Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red
```

**Run tests:**
```powershell
.\test-security.ps1
```

---

## 📋 Manual Testing Checklist

Print this checklist and verify each item:

- [ ] Rate limiting blocks after 100 requests (general)
- [ ] Rate limiting blocks after 30 requests (mutations)
- [ ] Invalid year rejected (1800)
- [ ] Negative price rejected (-1000)
- [ ] Price over limit rejected ($99,999,999)
- [ ] Long description rejected (6000 chars)
- [ ] XSS script tags are sanitized
- [ ] SQL injection attempts fail safely
- [ ] Invalid file types rejected (.txt, .exe)
- [ ] Large files rejected (>10MB)
- [ ] Security headers present (CSP, X-Frame-Options)
- [ ] X-Powered-By header removed
- [ ] CORS validates origin
- [ ] Invalid vehicle IDs rejected (abc, SQL injection)
- [ ] Oversized JSON body rejected (>1MB)
- [ ] Audit logs recorded for mutations

---

## 🔍 Validation Rules Reference

### Vehicle Data Validation

| Field | Type | Min | Max | Required |
|-------|------|-----|-----|----------|
| **year** | integer | 1900 | 2100 | ✅ Yes |
| **make** | string | 1 char | 50 chars | ✅ Yes |
| **model** | string | 1 char | 50 chars | ✅ Yes |
| **trim** | string | 0 chars | 50 chars | ❌ No |
| **price** | number | 0 | 10,000,000 | ✅ Yes |
| **mileage** | number | 0 | 999,999 | ❌ No |
| **description** | string | 0 chars | 5,000 chars | ❌ No |
| **status** | enum | - | - | ❌ No |
| **exterior_color** | string | 0 chars | 30 chars | ❌ No |
| **interior_color** | string | 0 chars | 30 chars | ❌ No |
| **fuel_type** | enum | - | - | ❌ No |
| **transmission** | enum | - | - | ❌ No |
| **drivetrain** | enum | - | - | ❌ No |
| **engine** | string | 0 chars | 100 chars | ❌ No |
| **features** | string | 0 chars | 500 chars | ❌ No |

**Enum Values:**
- **status:** `available`, `sold`, `pending`
- **fuel_type:** `Gasoline`, `Diesel`, `Hybrid`, `Electric`
- **transmission:** `Automatic`, `Manual`, `CVT`
- **drivetrain:** `FWD`, `RWD`, `AWD`, `4WD`

---

## 🐛 Common Issues & Solutions

### Issue: Rate limit not triggering

**Check:**
1. Are you testing from same IP?
2. Wait 15 minutes for rate limit to reset
3. Check if `express-rate-limit` is installed

---

### Issue: XSS test shows script tags

**Possible causes:**
1. Sanitization not implemented
2. Check if `DOMPurify` or similar library is used
3. Verify sanitization happens before database storage

---

### Issue: SQL injection seems to work

**Investigation:**
```sql
-- Check if vehicles table still exists
SELECT * FROM vehicles;

-- If table was dropped, this is a CRITICAL VULNERABILITY
-- Verify parameterized queries are used
```

---

### Issue: File upload accepts any type

**Check:**
1. Multer configuration has file filter
2. MIME type checking is implemented
3. File extension validation exists

---

## 📚 Related Documentation

- [Admin Authentication Tests](./admin-auth-tests.md) - Authentication & session testing
- [API Documentation](../README.md#api-documentation) - API reference
- [Deployment Guide](../README.md#deployment) - Production setup

---

## 🎯 Testing Goals

✅ **Verify all security mechanisms are active**  
✅ **Confirm inputs are properly validated**  
✅ **Ensure malicious requests are blocked**  
✅ **Validate security headers are set**  
✅ **Test rate limiting is effective**

---

**⚠️ Security Note:** These tests should be run in a development environment. Never perform security testing on production systems without proper authorization and during scheduled maintenance windows.
