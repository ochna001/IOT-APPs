<#
Builds a standalone debug APK with JavaScript bundle included.
Usage: .\scripts\build-standalone-debug.ps1

This creates a debug APK that works WITHOUT Metro running.
#>

Write-Output "Creating standalone debug build..."
Write-Output "This will bundle the JavaScript into the APK."
Write-Output ""

# Step 1: Generate the bundle manually
Write-Output "Step 1: Bundling JavaScript..."
$bundleDir = "android\app\src\main\assets"
if (-not (Test-Path $bundleDir)) {
    New-Item -ItemType Directory -Path $bundleDir -Force | Out-Null
}

$bundleCmd = "npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output $bundleDir\index.android.bundle --assets-dest android\app\src\main\res"
Invoke-Expression $bundleCmd

if ($LASTEXITCODE -ne 0) {
    Write-Error "Bundle generation failed."
    exit 1
}

Write-Output "✓ Bundle created successfully"
Write-Output ""

# Step 2: Build the APK
Write-Output "Step 2: Building APK..."
Push-Location android
& .\gradlew assembleDebug
Pop-Location

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed."
    exit 1
}

Write-Output "✓ APK built successfully"
Write-Output ""

# Step 3: Install
Write-Output "Step 3: Installing to device..."
& .\scripts\install-apk.ps1

Write-Output ""
Write-Output "Done! The app should now work without Metro."
