#!/usr/bin/env bash
# Installs the debug APK to a connected Android device using adb.
# Usage: ./scripts/install-apk.sh

APK="android/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK" ]; then
  echo "APK not found at $APK. Build it first with: cd android && ./gradlew assembleDebug"
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found on PATH. Install Android Platform Tools and add to PATH."
  exit 1
fi

DEVICES=$(adb devices | sed '1d' | awk '{print $1}')
if [ -z "$DEVICES" ]; then
  echo "No Android devices detected. Connect a device or start an emulator and try again."
  exit 1
fi

for d in $DEVICES; do
  echo "Installing APK to $d..."
  adb -s "$d" install -r "$APK"
done

echo "Done."
