# IoT ESP32 Controller — Development setup

This repo contains an Expo React Native app for controlling ESP devices and example ESP sketches.

This README explains how to get a development environment ready on another machine (Windows), and includes a helper PowerShell script that installs project dependencies and does basic Android SDK detection.

Quick summary
- Clone the repo
- Run the setup script to install Node dependencies and optionally run `expo prebuild` to generate the native Android project
- Open Android Studio to finish SDK/NDK install (if needed) and build/run the APK

Prerequisites (install on the machine manually if missing)
- Node.js (16+ recommended)
- npm (comes with Node)
- Android Studio (for building APKs) or Android SDK + command line tools
- Optional: Git, adb

Automated project setup (Windows PowerShell)
1. Open PowerShell (Run as Administrator if you plan to install global packages).
2. From the project folder run:

```powershell
cd 'C:\path\to\iotApp'
# IoT ESP32 Controller — Development setup

This repo contains an Expo React Native app for controlling ESP devices and example ESP sketches.

This README explains how to get a development environment ready on another machine (Windows), and includes a helper PowerShell script that installs project dependencies and does basic Android SDK detection.

Quick summary
- Clone the repo
- Run the setup script to install Node dependencies and optionally run `expo prebuild` to generate the native Android project
- Open Android Studio to finish SDK/NDK install (if needed) and build/run the APK

Prerequisites (install on the machine manually if missing)
- Node.js (16+ recommended)
- npm (comes with Node)
- Android Studio (for building APKs) or Android SDK + command line tools
- Optional: Git, adb

Automated project setup (Windows PowerShell)
1. Open PowerShell (Run as Administrator if you plan to install global packages).
2. From the project folder run:

```powershell
cd 'C:\path\to\iotApp'
.\scripts\setup-dev.ps1 -Prebuild
```

The script will:
- check Node/npm are present
- install JS dependencies (npm ci or npm install)
- detect an Android SDK and write `android/local.properties` if found
- optionally run `npx expo prebuild --platform android` to create the `android/` native project

After the script:
- Open Android Studio and choose "Open" then select the `android` folder inside the project. Android Studio will prompt to install SDK/NDK components if missing.
- In Android Studio you can Build > Build APK(s) or Run on a device/emulator.

Developer workflow
- For iterative JS development continue using Expo/Metro:

```powershell
npm run start
# open the app in Expo Go or run on a device that can access the Metro server
```

- If you want an installable debug APK (no keystore required):

```powershell
# from project root
cd android
.\gradlew assembleDebug
# APK will be at android\app\build\outputs\apk\debug\app-debug.apk
```

Notes
- The script does not install Android Studio. It's recommended to use Android Studio the first time to satisfy any missing SDK components.
- If you want cloud builds with Expo Application Services (EAS), see https://docs.expo.dev/build/introduction/ — I can add an `eas.json` if you want.

If you want, I can also add a small shell script for macOS/Linux.

# IoT ESP32 Controller (React Native / Expo)

This is a minimal Expo-based React Native app to discover and control simple IoT devices like ESP32 boards that expose HTTP endpoints.

Features
- Add devices by IP or hostname.
- Open device control screen and send simple GET requests to endpoints (e.g., /on, /off).

Run locally

1. Install Expo CLI (if you don't have it):

   npm install -g expo-cli

2. Install dependencies:

   npm install

3. Start the app:

   npm run start

4. Open on your phone using Expo Go (scan QR) or run in emulator.

Common ESP32 example

If you flashed a basic web server on ESP32 that toggles GPIOs with endpoints:

- http://<ESP32_IP>/on
- http://<ESP32_IP>/off

You can also implement custom endpoints like /gpio/2/1 to set gpio 2 to 1.

Notes
- The app assumes devices are reachable on your mobile network. Make sure your phone and ESP32 are on the same LAN.
- This scaffold uses GET requests for simplicity. For production use prefer POST, authentication, and TLS.
