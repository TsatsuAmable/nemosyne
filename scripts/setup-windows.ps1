# Nemosyne Developer Setup for Windows (PowerShell)
# Requires PowerShell 5.1+ or PowerShell Core 7+

$ErrorActionPreference = "Stop"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "          Nemosyne Developer Setup for Windows                  " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# 1. Check Node.js
Write-Host "`n[1/6] Checking Node.js (v20+ required)..." -ForegroundColor Yellow
$nodeInstalled = $false
try {
    $nodeVersionOutput = node -v 2>$null
    if ($nodeVersionOutput) {
        $nodeMajor = [int]($nodeVersionOutput.TrimStart('v').Split('.')[0])
        if ($nodeMajor -ge 20) {
            Write-Host "✓ Node.js $nodeVersionOutput is installed." -ForegroundColor Green
            $nodeInstalled = $true
        } else {
            Write-Host "Your Node.js version ($nodeVersionOutput) is older than 20. Please update Node.js." -ForegroundColor Red
        }
    }
} catch {
    $nodeInstalled = $false
}

if (-not $nodeInstalled) {
    Write-Host "Node.js not found or outdated. Installing via winget..." -ForegroundColor Yellow
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        # Refresh environment PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    } else {
        Write-Host "Please install Node.js 20+ from https://nodejs.org/" -ForegroundColor Red
        exit 1
    }
}

# 2. Install NPM dependencies
Write-Host "`n[2/6] Installing npm dependencies..." -ForegroundColor Yellow
npm install

# 3. Check Rust and Cargo
Write-Host "`n[3/6] Checking Rust and WebAssembly Toolchain..." -ForegroundColor Yellow
$cargoHome = "$env:USERPROFILE\.cargo\bin"
if ($env:Path -notlike "*$cargoHome*") {
    $env:Path = "$cargoHome;$env:Path"
}

$rustInstalled = $false
try {
    $rustcVersion = rustc --version 2>$null
    if ($rustcVersion) {
        Write-Host "✓ Rust/Cargo is installed ($rustcVersion)." -ForegroundColor Green
        $rustInstalled = $true
    }
} catch {
    $rustInstalled = $false
}

if (-not $rustInstalled) {
    Write-Host "Rust toolchain manager (rustup) not found. Installing..." -ForegroundColor Yellow
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install Rustlang.Rustup --accept-package-agreements --accept-source-agreements
        $env:Path = "$cargoHome;$env:Path"
    } else {
        $installerUrl = "https://win.rustup.rs/x86_64"
        $installerPath = "$env:TEMP\rustup-init.exe"
        Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath
        Start-Process -FilePath $installerPath -ArgumentList "-y" -Wait
        Remove-Item $installerPath -Force
        $env:Path = "$cargoHome;$env:Path"
    }
}

Write-Host "Ensuring WebAssembly (wasm32-unknown-unknown) target is installed..." -ForegroundColor Yellow
rustup target add wasm32-unknown-unknown

# 4. Check wasm-pack
Write-Host "`n[4/6] Checking wasm-pack..." -ForegroundColor Yellow
$wasmPackInstalled = $false
try {
    $wasmPackVersion = wasm-pack --version 2>$null
    if ($wasmPackVersion) {
        Write-Host "✓ wasm-pack is installed ($wasmPackVersion)." -ForegroundColor Green
        $wasmPackInstalled = $true
    }
} catch {
    $wasmPackInstalled = $false
}

if (-not $wasmPackInstalled) {
    Write-Host "wasm-pack not found. Installing via cargo..." -ForegroundColor Yellow
    cargo install wasm-pack
}

# 5. Generate Self-Signed Certificates (WebXR requirement)
Write-Host "`n[5/6] Setting up secure local development certificates (WebXR requirement)..." -ForegroundColor Yellow
if ((Test-Path "certs\key.pem") -and (Test-Path "certs\cert.pem")) {
    Write-Host "✓ Secure certificates found in certs\ directory." -ForegroundColor Green
} else {
    Write-Host "Generating self-signed certificates for localhost..." -ForegroundColor Yellow
    if (-not (Test-Path "certs")) {
        New-Item -ItemType Directory -Path "certs" | Out-Null
    }

    if (Get-Command openssl -ErrorAction SilentlyContinue) {
        openssl req -x509 -newkey rsa:2048 -keyout certs\key.pem -out certs\cert.pem -subj "/CN=localhost" -nodes
        Write-Host "✓ Generated certs\key.pem and certs\cert.pem via OpenSSL" -ForegroundColor Green
    } else {
        # Fallback using PowerShell Self-Signed Certificate export
        $cert = New-SelfSignedCertificate -DnsName "localhost", "127.0.0.1" -CertStoreLocation "cert:\CurrentUser\My" -NotAfter (Get-Date).AddYears(1)
        $certPem = @"
-----BEGIN CERTIFICATE-----
$([System.Convert]::ToBase64String($cert.RawData, 'InsertLineBreaks'))
-----END CERTIFICATE-----
"@
        Set-Content -Path "certs\cert.pem" -Value $certPem
        Write-Host "✓ Generated certs\cert.pem via Windows PKI (Note: Install OpenSSL for key.pem if needed for full WebXR HTTPS)." -ForegroundColor Yellow
    }
}

# 6. Compile WASM and Run Test Suite
Write-Host "`n[6/6] Compiling WebAssembly Analytical Kernel and verifying test suite..." -ForegroundColor Yellow
npm run wasm:dev
npm run test:all

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host "         Setup Completed Successfully! Nemosyne is ready!        " -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host "`nTo start developing on Windows:"
Write-Host "1. Start the Vite development server with WASM compilation enabled:"
Write-Host "   npm run dev:wasm" -ForegroundColor Cyan
Write-Host "2. Open your Meta Quest or local browser and navigate to:"
Write-Host "   https://<your-local-ip>:5173" -ForegroundColor Cyan
Write-Host "3. Accept the self-signed HTTPS certificate warning and enter VR!`n"
