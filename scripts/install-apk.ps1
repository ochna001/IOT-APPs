<#
Installs the debug APK to a connected Android device using adb.
Usage: .\scripts\install-apk.ps1
It looks for the debug APK at android\app\build\outputs\apk\debug\app-debug.apk
Requires adb on PATH.
#>

$apk = Join-Path -Path (Get-Location) -ChildPath "android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apk)) {
  Write-Error "APK not found at $apk. Build it first with: cd android ; .\gradlew assembleDebug"
  exit 1
}

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
  Write-Error "adb not found on PATH. Install Android Platform Tools and add to PATH."
  exit 1
}

Write-Output "Looking for connected devices..."
$devices = & adb devices | Select-Object -Skip 1 | Where-Object { $_ -and ($_ -notmatch '^List') } | ForEach-Object { ($_ -split "\t")[0].Trim() }
if (-not $devices) {
  Write-Error "No Android devices detected. Connect a device or start an emulator and try again."
  exit 1
}

foreach ($d in $devices) {
  Write-Output "Installing APK to $d..."
  & adb -s $d install -r $apk
}

Write-Output "Done."
