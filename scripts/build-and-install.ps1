<#
Builds and installs the debug APK in one step.
Usage: .\scripts\build-and-install.ps1

This creates a standalone APK that doesn't require Metro/Expo to be running.
#>

Write-Output "Building debug APK..."
Push-Location android
& .\gradlew assembleDebug
Pop-Location

if ($LASTEXITCODE -ne 0) {
  Write-Error "Build failed."
  exit 1
}

Write-Output "`nInstalling APK..."
& .\scripts\install-apk.ps1
