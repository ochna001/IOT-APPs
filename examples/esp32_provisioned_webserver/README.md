# ESP32 Provisioned Webserver

This firmware provides the same functionality as the ESP8266 version, adapted for ESP32.

## Features
- WiFi provisioning via captive portal (AP mode)
- Credentials stored in ESP32 Preferences (NVS)
- Web server with endpoints: `/`, `/on`, `/off`, `/status`, `/reset`
- Auto-reconnect on boot
- Compatible with the IoT app

## Setup Instructions

1. **Install ESP32 board support** in Arduino IDE:
   - Go to File → Preferences
   - Add to Additional Board Manager URLs:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Go to Tools → Board → Boards Manager
   - Search "ESP32" and install "esp32 by Espressif Systems"

2. **Select your ESP32 board**:
   - Tools → Board → ESP32 Arduino → (your board, e.g., "ESP32 Dev Module")

3. **Upload the sketch**

## First Use
1. Device creates AP: `ESP32-Setup` (no password)
2. Connect phone/computer to this AP
3. Navigate to `http://192.168.4.1` (should auto-open captive portal)
4. Enter your WiFi SSID and password
5. Device reboots and connects to your WiFi
6. Check Serial Monitor for the assigned IP address
7. Add the IP to your IoT app

## LED Pin
- Default: GPIO 2
- Adjust `LED_PIN` constant if your board uses a different pin

## API Endpoints
- `GET /` - Returns "ESP32 ready"
- `GET /on` - Turns LED on
- `GET /off` - Turns LED off
- `GET /status` - Returns connection status and IP
- `GET /reset` - Clears WiFi credentials and reboots to provisioning mode
