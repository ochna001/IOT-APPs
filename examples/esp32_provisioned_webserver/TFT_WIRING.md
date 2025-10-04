# TFT Display Wiring Guide for ESP32

## GMT020-02 Display (ST7789 Driver) - 240x320 pixels

### Pin Connections (For Your Working Setup)

Connect your TFT module pins **left to right** to ESP32:

| TFT Module Pin | → | ESP32 GPIO | Description |
|----------------|---|------------|-------------|
| **CS** | → | **GPIO 27** | Chip Select |
| **DC** | → | **GPIO 26** | Data/Command |
| **RST** | → | **GPIO 12** | Reset |
| **SDA** | → | **GPIO 32** | MOSI - Software SPI |
| **SCL** | → | **GPIO 33** | SCLK - Software SPI |
| **VCC** | → | **3.3V** | Power supply (3.3V) |
| **GND** | → | **GND** | Ground |

### Important Notes

1. **Voltage**: The GMT020-02 display runs on **3.3V logic**. Do not connect to 5V!

2. **Software SPI**: Due to limited available GPIOs, this configuration uses **software SPI** instead of hardware SPI:
   - Software SPI is slower but works with any GPIO pins
   - The display will still update every 2 seconds

3. **Backlight**: The GMT020-02 has a hardwired backlight that cannot be controlled via software. It will always be on when powered.

4. **Complete Pin Assignment**:
   - **LED**: GPIO 2 (built-in LED)
   - **DHT22**: GPIO 14 (temperature & humidity sensor)
   - **TFT CS**: GPIO 27
   - **TFT DC**: GPIO 26
   - **TFT RST**: GPIO 12
   - **TFT SDA**: GPIO 32
   - **TFT SCL**: GPIO 33

### Required Libraries

Install these libraries via Arduino Library Manager:

1. **Adafruit ST7789** (for ST7789 display driver)
2. **Adafruit GFX Library** (graphics library dependency)

### Display Features

The code displays:
- **WiFi Status**: Mode (AP/Station), SSID, IP address, signal strength
- **Sensor Data**: Temperature, humidity from DHT22, motion detection from PIR
- **System Status**: LED state, MP3 player availability, system uptime
- **Auto-refresh**: Updates every 2 seconds

### Customization

To change display pins, modify these defines in the code:
```cpp
#define TFT_CS    5   // Chip select
#define TFT_RST   17  // Reset
#define TFT_DC    16  // Data/Command
```

To change update frequency, modify:
```cpp
const unsigned long displayUpdateInterval = 2000; // milliseconds
```

### Troubleshooting

1. **Blank screen**: Check power connections and ensure 3.3V is supplied
2. **Garbled display**: Verify SPI pins (MOSI/SCLK) are correct for your ESP32 board
3. **No display**: Check CS, DC, and RST connections
4. **Slow updates**: The display clears and redraws every update cycle - this is normal

### Alternative: Software SPI

If hardware SPI pins conflict with other peripherals, you can use software SPI by modifying the TFT initialization:

```cpp
// Define MOSI and SCLK pins
#define TFT_MOSI 23
#define TFT_SCLK 18

// Use software SPI constructor
Adafruit_ST7789 tft = Adafruit_ST7789(TFT_CS, TFT_DC, TFT_MOSI, TFT_SCLK, TFT_RST);
```

Note: Software SPI is slower than hardware SPI.
