$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ConfigPath = Join-Path $ProjectRoot "miniprogram\config.js"
$ServerPath = Join-Path $ProjectRoot "server\server.js"

function Get-LanIPv4 {
  $route = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue |
    Sort-Object RouteMetric |
    Select-Object -First 1

  if ($route) {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -notlike "169.254.*" -and $_.IPAddress -ne "127.0.0.1" } |
      Select-Object -First 1 -ExpandProperty IPAddress
    if ($ip) { return $ip }
  }

  $fallback = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "169.254.*" -and $_.IPAddress -ne "127.0.0.1" } |
    Select-Object -First 1 -ExpandProperty IPAddress
  return $fallback
}

$Node = Get-Command node -ErrorAction SilentlyContinue
if (-not $Node) {
  throw "Node.js command was not found. Install Node.js or add it to PATH."
}

$LanIP = Get-LanIPv4
if (-not $LanIP) {
  throw "No LAN IPv4 address was found. Check WiFi or Ethernet connection."
}

$ApiBase = "http://${LanIP}:3000/api/v1"

$Config = @"
module.exports = {
  API_BASE: "$ApiBase",
  DEMO_API_KEY: "demo-public-key"
};
"@

Set-Content -Path $ConfigPath -Value $Config -Encoding UTF8

$env:HOST = "0.0.0.0"
$env:PORT = "3000"
if (-not $env:LBS_TOKEN_SECRET) {
  $env:LBS_TOKEN_SECRET = "local-phone-test-secret"
}

Write-Host ""
Write-Host "Mini Program API_BASE has been set to: $ApiBase" -ForegroundColor Green
Write-Host ""
Write-Host "Checklist:"
Write-Host "1. PC and phone must use the same WiFi."
Write-Host "2. If Windows Firewall asks, click Allow access."
Write-Host "3. Open this URL in your phone browser:"
Write-Host "   http://${LanIP}:3000/api/v1/health"
Write-Host ""
Write-Host "Server is starting. Keep this window open. Press Ctrl + C to stop."
Write-Host ""

Set-Location $ProjectRoot
& $Node.Source $ServerPath
