# DFPlayer Mini Integration Guide

## Test Sketch Location
The standalone test sketch is now at:
`c:\Users\janer\OneDrive\Documents\iotapp\IOT-APPs\examples\test_dfplayer_mini\test_dfplayer_mini.ino`

**Test it first** before integrating into the main sketch!

## Wiring
- **DFPlayer VCC** → 5V (or 3.3V with voltage divider on RX)
- **DFPlayer GND** → GND
- **DFPlayer RX** → ESP32 GPIO27 (through 1K resistor recommended)
- **DFPlayer TX** → ESP32 GPIO26
- **DFPlayer SPK+/SPK-** → Speaker

## SD Card Setup
1. Format SD card as FAT32
2. Create folder `/MP3` on the root
3. Add files: `0001.mp3`, `0002.mp3`, `0003.mp3`, etc.

---

## Integration Steps for `esp32_provisioned_webserver.ino`

### Step 1: Add Include (after line 24)
```cpp
#include <AnimatedGIF.h>
#include <DFMiniMp3.h>  // ← ADD THIS LINE
```

### Step 2: Add Pin Definitions (after line 34)
```cpp
#define TFT_RST   17

// DFPlayer Mini UART pins (avoid conflicts with TFT/DHT/SPI)
// ESP32 TX (to DFPlayer RX) and ESP32 RX (from DFPlayer TX)
#define MP3_TX_PIN 27
#define MP3_RX_PIN 26
```

### Step 3: Add DFPlayer Instance (after line 60, after `AnimatedGIF gif;`)
```cpp
AnimatedGIF gif;

// ===== DFPlayer Mini (DFMiniMp3) =====
// Use UART2 with custom pins
HardwareSerial MP3Serial(2);

class Mp3Notify {
public:
  static void OnError([[maybe_unused]] DFMiniMp3<HardwareSerial, Mp3Notify>& mp3, uint16_t errorCode) {
    Serial.print("DFMiniMp3 Error "); Serial.println(errorCode);
  }
  static void OnPlayFinished([[maybe_unused]] DFMiniMp3<HardwareSerial, Mp3Notify>& mp3, 
                             [[maybe_unused]] DfMp3_PlaySources source, 
                             uint16_t track) {
    Serial.print("DFMiniMp3 Finished track "); Serial.println(track);
  }
  static void OnPlaySourceOnline([[maybe_unused]] DFMiniMp3<HardwareSerial, Mp3Notify>& mp3, 
                                 [[maybe_unused]] DfMp3_PlaySources source) {
    Serial.println("DFMiniMp3 Source online");
  }
  static void OnPlaySourceInserted([[maybe_unused]] DFMiniMp3<HardwareSerial, Mp3Notify>& mp3, 
                                   [[maybe_unused]] DfMp3_PlaySources source) {
    Serial.println("DFMiniMp3 Source inserted");
  }
  static void OnPlaySourceRemoved([[maybe_unused]] DFMiniMp3<HardwareSerial, Mp3Notify>& mp3, 
                                  [[maybe_unused]] DfMp3_PlaySources source) {
    Serial.println("DFMiniMp3 Source removed");
  }
};

DFMiniMp3<HardwareSerial, Mp3Notify> mp3(MP3Serial);
```

### Step 4: Add HTTP Handlers (after line 347, after `displayAlert()` function)
```cpp
void displayAlert() {
  tft.fillScreen(ST77XX_RED);
  tft.setTextSize(5);
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(50, 90);
  tft.println("ALERT!");
  delay(200);
  tft.fillScreen(ST77XX_BLACK);
  delay(200);
  tft.fillScreen(ST77XX_RED);
  tft.setCursor(50, 90);
  tft.println("ALERT!");
}

// ===== MP3 HTTP Handlers =====
void handleMp3Play() {
  int track = 1;
  if (server.hasArg("track")) {
    track = server.arg("track").toInt();
    if (track <= 0) track = 1;
  }
  // Play from /MP3 folder: files should be 0001.mp3, 0002.mp3, ...
  mp3.playMp3FolderTrack(track);
  sendPlain(200, String("Playing track ") + track);
}

void handleMp3Stop() {
  mp3.stop();
  sendPlain(200, "Stopped");
}

void handleMp3Volume() {
  if (!server.hasArg("v")) {
    sendPlain(400, "Missing v (0-30)");
    return;
  }
  int v = server.arg("v").toInt();
  if (v < 0) v = 0;
  if (v > 30) v = 30;
  mp3.setVolume(v);
  sendPlain(200, String("Volume ") + v);
}
```

### Step 5: Add Endpoints in `startWebServer()` (after line 669)
```cpp
  server.on("/displayText", handleDisplayText);
  
  // MP3 endpoints
  server.on("/mp3/play", handleMp3Play);
  server.on("/mp3/stop", handleMp3Stop);
  server.on("/mp3/volume", handleMp3Volume);
  
  // GIF endpoints - support both GET and POST
```

### Step 6: Initialize in `setup()` (after line 780, before `tryConnectFromPreferences()`)
```cpp
  Serial.print("Free heap: ");
  Serial.println(ESP.getFreeHeap());
  
  // Initialize DFPlayer Mini on UART2
  MP3Serial.begin(9600, SERIAL_8N1, MP3_RX_PIN, MP3_TX_PIN);
  delay(200);
  mp3.begin();
  mp3.setVolume(20); // 0-30
  Serial.println("DFMiniMp3 initialized on UART2 (RX=26, TX=27)");
  
  tryConnectFromPreferences();
```

### Step 7: Add to `loop()` (before the closing brace at line 790)
```cpp
void loop() {
  server.handleClient();
  if (WiFi.getMode() == WIFI_AP) {
    dnsServer.processNextRequest();
  }
  // DFPlayer background tasks
  mp3.loop();
}
```

---

## API Endpoints

Once integrated, your app can call:

### Play Track
```
GET http://<device-ip>/mp3/play?track=1
```
Plays `0001.mp3` from `/MP3` folder on SD card.

### Stop Playback
```
GET http://<device-ip>/mp3/stop
```

### Set Volume
```
GET http://<device-ip>/mp3/volume?v=20
```
Volume range: 0-30

---

## Pin Summary (No Conflicts)

| Component | Pins Used |
|-----------|-----------|
| LED | GPIO2 |
| DHT22 | GPIO14 |
| TFT CS | GPIO5 |
| TFT DC | GPIO16 |
| TFT RST | GPIO17 |
| SPI SCK | GPIO18 |
| SPI MOSI | GPIO23 |
| **DFPlayer RX** | **GPIO27** |
| **DFPlayer TX** | **GPIO26** |

✅ No pin conflicts!

---

## Testing Steps

1. **Test standalone first**: Upload `test_dfplayer_mini.ino` and verify DFPlayer works
2. **Integrate**: Manually add the 7 code blocks above to your main sketch
3. **Upload main sketch**: Flash `esp32_provisioned_webserver.ino`
4. **Test from Serial Monitor**: Check for "DFMiniMp3 initialized" message
5. **Test from app**: Call `/mp3/play?track=1` endpoint

---

## Troubleshooting

- **No sound**: Check wiring, SD card format (FAT32), file names (0001.mp3, not 1.mp3)
- **Error codes**: Check Serial Monitor for DFMiniMp3 error messages
- **Compilation errors**: Ensure DFMiniMp3 library is installed (Arduino Library Manager)
- **Wrong volume**: DFPlayer volume range is 0-30, not 0-100
