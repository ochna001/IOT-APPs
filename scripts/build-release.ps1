<#
Builds a release APK with the JavaScript bundle properly packaged.
Usage: .\scripts\build-release.ps1

This creates a production-ready APK with:
- Minified JavaScript bundle
- Optimized assets
- ProGuard/R8 code shrinking (if enabled)
#>

Write-Output "Cleaning previous builds..."
Push-Location android
& .\gradlew clean
Pop-Location

Write-Output "`nBuilding release APK..."
Push-Location android
& .\gradlew assembleRelease
Pop-Location

if ($LASTEXITCODE -ne 0) {
  Write-Error "Release build failed."
  exit 1
}

$releaseApk = "android\app\build\outputs\apk\release\app-release.apk"
if (Test-Path $releaseApk) {
  $size = (Get-Item $releaseApk).Length / 1MB
  Write-Output "`nRelease APK built successfully!"
  Write-Output "Location: $releaseApk"
  Write-Output "Size: $([math]::Round($size, 2)) MB"
  Write-Output "`nTo install: adb install $releaseApk"
} else {
  Write-Error "Release APK not found at expected location."
  exit 1
}
