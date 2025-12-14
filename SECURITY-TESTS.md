# Security Test Checklist

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

---

## 2. Input Validation Tests

### Invalid Year (out of range)
```powershell
$body = '{"year": "1800", "make": "Test", "model": "Invalid", "price": "1000"}'
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method POST -Body $body -ContentType "application/json"
# Expected: 400 Bad Request with validation error
```

### Invalid Price (negative)
```powershell
$body = '{"year": "2024", "make": "Test", "model": "Invalid", "price": "-1000"}'
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method POST -Body $body -ContentType "application/json"
# Expected: 400 Bad Request
```

### Invalid Price (exceeds max)
```powershell
$body = '{"year": "2024", "make": "Test", "model": "Invalid", "price": "99999999"}'
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method POST -Body $body -ContentType "application/json"
# Expected: 400 Bad Request (max $10,000,000)
```

### XSS Attempt in Description
```powershell
$body = '{"year": "2024", "make": "Test", "model": "XSS", "price": "1000", "description": "<script>alert(1)</script>"}'
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method POST -Body $body -ContentType "application/json"
# Expected: Script tags should be stripped from stored data
```

### SQL Injection Attempt
```powershell
$body = '{"year": "2024", "make": "Test''; DROP TABLE vehicles; --", "model": "SQLi", "price": "1000"}'
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method POST -Body $body -ContentType "application/json"
# Expected: Safe - parameterized queries prevent injection
```

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
# Expected: 400 Bad Request (max 5000 chars)
```

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
# Expected: 415 Unsupported Media Type
Remove-Item "test.txt"
```

### File Size Limit (>10MB)
```powershell
# Create a large file (this is slow, for manual testing only)
# $bytes = New-Object byte[] 11MB
# [IO.File]::WriteAllBytes("large.jpg", $bytes)
# Expected: 413 Payload Too Large
```

---

## 4. Security Headers Test

### Check Helmet Headers
```powershell
$response = Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method GET
$response.Headers
# Expected headers:
# - Content-Security-Policy
# - X-Content-Type-Options: nosniff
# - X-Frame-Options: SAMEORIGIN
# - Strict-Transport-Security (in production with HTTPS)
# - NO X-Powered-By header
```

### Verify X-Powered-By Removed
```powershell
$response = Invoke-WebRequest -Uri "http://localhost:8080/" -Method GET
$response.Headers["X-Powered-By"]
# Expected: $null (header should not exist)
```

---

## 5. CORS Tests

### CORS from Allowed Origin
```powershell
$headers = @{ "Origin" = "http://localhost:8080" }
$response = Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method GET -Headers $headers
$response.Headers["Access-Control-Allow-Origin"]
# Expected: http://localhost:8080
```

### CORS from Disallowed Origin
```powershell
$headers = @{ "Origin" = "http://malicious-site.com" }
$response = Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles" -Method GET -Headers $headers
$response.Headers["Access-Control-Allow-Origin"]
# Expected: $null or error (origin not allowed)
```

---

## 6. Invalid Route Tests

### Invalid Vehicle ID Format
```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles/abc" -Method DELETE
# Expected: 400 Bad Request - Invalid vehicle ID
```

```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/vehicles/1;DROP TABLE" -Method DELETE
# Expected: 400 Bad Request - Invalid vehicle ID
```

### Non-existent Endpoint
```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/nonexistent" -Method GET
# Expected: 404 - Endpoint not found
```

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
# Expected: 413 Payload Too Large (body limit is 1MB)
```

---

## Security Features Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Helmet Security Headers | ✅ | CSP, X-Frame-Options, etc. |
| X-Powered-By Disabled | ✅ | Fingerprinting prevention |
| Rate Limiting (General) | ✅ | 100 req/15min per IP |
| Rate Limiting (Mutations) | ✅ | 30 req/15min per IP |
| Input Validation (Zod) | ✅ | Type + range validation |
| XSS Sanitization | ✅ | Script tags stripped |
| SQL Injection Protection | ✅ | Parameterized queries |
| File Type Validation | ✅ | JPG/PNG/WEBP only |
| File Size Limit | ✅ | 10MB max |
| Body Size Limit | ✅ | 1MB JSON max |
| CORS Whitelist | ✅ | Origin validation |
| Audit Logging | ✅ | CREATE/UPDATE/DELETE logged |
| Error Handling | ✅ | No stack traces in production |
