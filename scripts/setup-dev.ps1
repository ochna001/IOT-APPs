<#
Windows development setup script for the project.
Usage: .\scripts\setup-dev.ps1 [-Prebuild]

What it does:
- checks for node and npm
- runs npm ci (falls back to npm install)
- attempts to locate Android SDK and write android/local.properties
- optionally runs: npx expo prebuild --platform android
#>

param(
  [switch]$Prebuild
)

function Write-ErrAndExit($msg) {
  Write-Error $msg
  exit 1
}

Write-Output "Running project setup..."

# check node
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-ErrAndExit "Node.js not found. Install Node.js (16+) and re-run this script."
}

# check npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-ErrAndExit "npm not found. Ensure Node.js installation adds npm to PATH."
}

Write-Output "Installing JS dependencies (npm ci)..."
try {
  npm ci
} catch {
  Write-Output "npm ci failed, falling back to npm install"
  npm install
}

# try to detect Android SDK
$sdkPaths = @(
  "$env:LOCALAPPDATA\Android\Sdk",
  "$env:ANDROID_HOME",
  "$env:ANDROID_SDK_ROOT"
)

$found = $null
foreach ($p in $sdkPaths) {
  if ($p -and (Test-Path $p)) { $found = $p; break }
}

if ($found) {
  Write-Output "Found Android SDK at: $found"
  $localProps = Join-Path -Path (Get-Location) -ChildPath 'android\local.properties'
  $content = "sdk.dir=$found`n"
  Write-Output "Writing $localProps"
  New-Item -Path $localProps -ItemType File -Force -Value $content | Out-Null
} else {
  Write-Output "Android SDK not found in common locations. If you plan to build Android locally, install Android Studio and the SDK, then re-run this script."
}

if ($Prebuild) {
  Write-Output "Running: npx expo prebuild --platform android"
  npx expo prebuild --platform android
}

Write-Output "Setup complete."