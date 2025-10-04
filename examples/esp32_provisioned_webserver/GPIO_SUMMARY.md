# ESP32 GPIO Configuration Summary

## Problem
Your ESP32 board has only **7 available GPIOs**: 34, 35, 32, 33, 26, 27, 12

### GPIO Limitations
- **GPIO 34 & 35**: INPUT-ONLY (no output capability, no pull-up/down resistors)
- **GPIO 12, 26, 27, 32, 33**: Output-capable (only 5 pins!)

## TFT Display Requirements
The ST7789 TFT display requires **5 pins** for software SPI:
1. CS (Chip Select)
2. DC (Data/Command)
3. RST (Reset)
4. SDA/MOSI (Data)
5. SCL/SCLK (Clock)

## Final Configuration

### ✅ Active Features
- **WiFi Provisioning** - Web-based WiFi setup
- **Web Server** - Endpoints: `/`, `/status`, `/dht`, `/reset`
- **DHT22 Sensor** - Temperature & humidity on GPIO 34
- **TFT Display** - Real-time status display

### ❌ Disabled Features (Not Enough GPIOs)
- **LED Control** - Would need 1 extra GPIO
- **PIR Motion Sensor** - Would need 1 extra GPIO (GPIO 35 is input-only anyway)
- **MP3 Player** - Would need 2 extra GPIOs (32 & 33 used by TFT)

## Pin Mapping

| Component | GPIO | Type | Notes |
|-----------|------|------|-------|
| DHT22 Data | 34 | Input | Input-only GPIO, perfect for sensor |
| TFT CS | 27 | Output | Chip Select |
| TFT DC | 26 | Output | Data/Command |
| TFT RST | 12 | Output | Reset |
| TFT SDA | 32 | Output | Software SPI MOSI |
| TFT SCL | 33 | Output | Software SPI Clock |
| Unused | 35 | Input | Input-only, not used |

## Wiring Your TFT Module

Connect your module pins (left to right) to ESP32:

```
TFT Module → ESP32
-----------------
CS  → GPIO 27
DC  → GPIO 26
RST → GPIO 12
SDA → GPIO 32
SCL → GPIO 33
VCC → 3.3V
GND → GND
```

## Expected Serial Output

```
--- ESP32 provision + webserver + DHT22 + TFT boot ---
TFT Display initialized (ST7789 240x320)
E (4078) gpio: gpio_pullup_en(78): GPIO number error (input-only pad has no internal PU)
DHT22 sensor initialized on GPIO 34
Found stored SSID: YourNetwork
....
Connected, IP: 192.168.1.XX
Webserver started
```

**Note**: The GPIO error about "input-only pad" for GPIO 34 is **expected and harmless** - it's just the DHT library trying to enable pull-up on an input-only pin. The sensor will work fine.

## Web Endpoints

- `http://192.168.1.XX/` - Status message
- `http://192.168.1.XX/status` - WiFi status
- `http://192.168.1.XX/dht` - Temperature & humidity
- `http://192.168.1.XX/reset` - Clear WiFi credentials and reboot

## Display Information

The TFT shows:
- WiFi mode (AP or Station)
- SSID and IP address
- Signal strength (RSSI)
- Temperature and humidity
- System uptime
- Auto-refreshes every 2 seconds

## To Add More Features

You would need an ESP32 board with more available GPIOs, such as:
- ESP32 DevKit (30 GPIOs)
- ESP32-WROOM-32 (25+ usable GPIOs)
- ESP32-S3 (45 GPIOs)

Your current board appears to be a minimal/compact ESP32 variant with limited GPIO breakout.
