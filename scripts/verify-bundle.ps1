<#
Verifies that the JavaScript bundle is correctly packaged in the APK.
Usage: .\scripts\verify-bundle.ps1 [debug|release]

Requires: apktool or unzip
#>

param(
    [string]$BuildType = "debug"
)

$apkPath = if ($BuildType -eq "release") {
    "android\app\build\outputs\apk\release\app-release.apk"
} else {
    "android\app\build\outputs\apk\debug\app-debug.apk"
}

if (-not (Test-Path $apkPath)) {
    Write-Error "APK not found at $apkPath. Build it first."
    exit 1
}

Write-Output "Verifying bundle in: $apkPath"
Write-Output ""

# Create temp directory
$tempDir = Join-Path $env:TEMP "apk-verify-$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
    # Extract APK (it's just a ZIP file)
    Write-Output "Extracting APK..."
    Expand-Archive -Path $apkPath -DestinationPath $tempDir -Force

    # Check for bundle
    $bundlePath = Join-Path $tempDir "assets\index.android.bundle"
    if (Test-Path $bundlePath) {
        $bundleSize = (Get-Item $bundlePath).Length / 1KB
        Write-Output "✓ JavaScript bundle found!"
        Write-Output "  Location: assets\index.android.bundle"
        Write-Output "  Size: $([math]::Round($bundleSize, 2)) KB"
        
        # Check if it's minified (release builds should be)
        $content = Get-Content $bundlePath -Raw -Encoding UTF8
        if ($content -match "^\s*var\s+\w+\s*=") {
            Write-Output "  Status: Minified (production-ready)"
        } else {
            Write-Output "  Status: Not minified (debug build)"
        }
    } else {
        Write-Warning "✗ JavaScript bundle NOT found in APK!"
        Write-Output "This means the app will try to load from Metro (dev mode only)."
    }

    # Check for other assets
    Write-Output ""
    Write-Output "Other assets:"
    $assetsDir = Join-Path $tempDir "assets"
    if (Test-Path $assetsDir) {
        Get-ChildItem $assetsDir -File | ForEach-Object {
            $size = $_.Length / 1024
            $sizeRounded = [math]::Round($size, 2)
            $fileName = $_.Name
            Write-Host "  - $fileName ($sizeRounded KB)"
        }
    }

} finally {
    # Cleanup
    Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
}

Write-Output ""
Write-Output "Verification complete."
