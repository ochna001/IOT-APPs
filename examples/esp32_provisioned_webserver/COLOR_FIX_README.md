# TFT Display Color Corruption Fix - GMT020-02 Module

## Problem
When uploading colored images to the ESP32 TFT display (ST7789V GMT020-02), colors appear inverted or corrupted. Black and white images render correctly, and solid color tests (RED, GREEN, BLUE) work fine.

## Root Cause
The issue is caused by **RGB565 byte order mismatch** between the JPEG decoder (TJpg_Decoder library) and the ST7789 display driver (Adafruit_ST7789).

- **RGB565 format**: Each pixel is 16 bits (2 bytes) with 5 bits for red, 6 for green, 5 for blue
- **Byte order matters**: The two bytes can be arranged as big-endian or little-endian
- When the byte order doesn't match, red and blue channels swap, causing color corruption
- Black and white images work because grayscale pixels (R=G=B) look the same regardless of byte order

## Solutions Applied

### Fix 1: Added Missing setAddrWindow (CRITICAL)
The callback function was missing the address window setup:

```cpp
// Line 56-64: Fixed callback function
bool tft_output(int16_t x, int16_t y, uint16_t w, uint16_t h, uint16_t* bitmap) {
  if (y >= tft.height()) return 0;
  tft.startWrite();
  tft.setAddrWindow(x, y, w, h);  // THIS WAS MISSING!
  tft.writePixels(bitmap, w * h);
  tft.endWrite();
  return 1;
}
```

### Fix 2: Byte Swap Setting
Line 377 - Currently set to `true`:

```cpp
TJpgDec.setSwapBytes(true);
```

**If colors are STILL wrong after uploading, try toggling this:**
- Change to `TJpgDec.setSwapBytes(false);`
- Re-upload and test again

## How It Works

The `TJpgDec.setSwapBytes()` function controls whether the library swaps the byte order of RGB565 pixels:
- `true`: Swaps bytes (converts between big-endian and little-endian)
- `false`: No swapping (uses native byte order)

Different ST7789 displays may expect different byte orders depending on:
- Manufacturer
- Display controller firmware
- SPI configuration

## Testing Steps

### Step 1: Upload Current Code
1. Open Arduino IDE
2. Upload the modified `esp32_provisioned_webserver.ino` to your ESP32
3. Wait for "Done uploading" message

### Step 2: Test Color Display
1. Open Serial Monitor (115200 baud) to see debug output
2. Connect to your ESP32's WiFi or AP
3. Use the React Native app to upload a **colorful test image** (not black & white)
4. Observe the colors on the display

### Step 3: Verify Results
**Expected**: Colors should now appear correct
- ✅ Red objects appear red
- ✅ Blue objects appear blue  
- ✅ Green objects appear green
- ✅ Skin tones look natural

**If colors are STILL inverted:**
1. Go to line 377 in the `.ino` file
2. Change `TJpgDec.setSwapBytes(true);` to `TJpgDec.setSwapBytes(false);`
3. Re-upload to ESP32
4. Test again

## Alternative Solutions

If changing `setSwapBytes()` doesn't work, you can manually swap bytes in the callback function:

```cpp
bool tft_output(int16_t x, int16_t y, uint16_t w, uint16_t h, uint16_t* bitmap) {
  if (y >= tft.height()) return 0;
  
  // Manual byte swap for each pixel
  int pixelCount = w * h;
  for (int i = 0; i < pixelCount; i++) {
    bitmap[i] = (bitmap[i] >> 8) | (bitmap[i] << 8);
  }
  
  tft.startWrite();
  tft.setAddrWindow(x, y, w, h);
  tft.writePixels(bitmap, pixelCount);
  tft.endWrite();
  return 1;
}
```

## Why Black & White Works

Grayscale pixels have equal RGB values:
- White: R=31, G=63, B=31 → `0xFFFF` (all bits set)
- Black: R=0, G=0, B=0 → `0x0000` (all bits clear)
- Gray: R=15, G=31, B=15 → Symmetric pattern

When you swap bytes on symmetric patterns, they remain the same, so grayscale images display correctly regardless of byte order.

## Files Modified

- `examples/esp32_provisioned_webserver/esp32_provisioned_webserver.ino` (line 376)

## Next Steps

1. Upload the modified code to your ESP32
2. Test with a colored image
3. If colors are still wrong, toggle `setSwapBytes()` back to `true`
4. Report back which setting works for your specific display
