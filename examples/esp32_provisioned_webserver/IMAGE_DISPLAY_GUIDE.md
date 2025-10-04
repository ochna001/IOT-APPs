# 🖼️ Image Display Feature Guide

## Overview
Your IoT app can now send images to the ESP32 TFT display! The app picks an image, resizes it, and sends it in chunks to the ESP32.

## Features Added

### 📱 App Side (DeviceTabScreen_Enhanced.js)
1. **Image Picker** - Select images from your photo library
2. **Auto-resize** - Images are resized to 160x120 for faster transfer
3. **Chunked Upload** - Large images are split into 1000-character chunks
4. **Progress Tracking** - Shows upload progress

### 🔧 ESP32 Side
1. **Chunk Receiver** - `/imageChunk` endpoint receives image data
2. **Image Display** - `/displayImage` shows colorful pattern when image received
3. **Text Display** - `/displayText?text=Hello` displays custom text
4. **Display Modes** - `/display?mode=smiley|heart|alert|data`

## How to Use

### Step 1: Update Your App Navigation
Replace `DeviceTabScreen` with `DeviceTabScreen_Enhanced` in your navigation:

```javascript
// In your navigation file (e.g., App.js or navigation/index.js)
import DeviceTabScreen from './src/screens/DeviceTabScreen_Enhanced';
```

### Step 2: Install Required Packages
```bash
npm install expo-image-picker expo-image-manipulator
```

### Step 3: Upload ESP32 Code
Upload the updated `esp32_provisioned_webserver.ino` to your ESP32.

### Step 4: Test It!
1. Open your app
2. Go to a device
3. Tap "📸 Pick & Send Image"
4. Select an image from your gallery
5. Watch it upload and display on the TFT!

## API Endpoints

### Image Upload (from app)
```
GET /imageChunk?index=0&total=10&data=<base64_chunk>
```
- Receives image data in chunks
- App automatically handles chunking

### Display Image
```
GET /displayImage
```
- Displays the received image (currently shows colorful pattern)
- Called automatically after all chunks received

### Display Text
```
GET /displayText?text=Hello%20World
```
- Displays custom text on screen
- Example: `http://192.168.1.XX/displayText?text=Temperature%20Alert`

### Display Modes
```
GET /display?mode=smiley
GET /display?mode=heart
GET /display?mode=alert
GET /display?mode=data
```

## How It Works

### App → ESP32 Flow:
1. **User picks image** from gallery
2. **App resizes** to 160x120 pixels
3. **Converts to JPEG** with compression
4. **Encodes to base64** string
5. **Splits into chunks** (1000 chars each)
6. **Sends chunks** one by one to ESP32
7. **ESP32 assembles** chunks into complete image
8. **Displays** confirmation with colorful pattern

### Memory Considerations:
- **Small images** (160x120) to fit in ESP32 RAM
- **Chunked transfer** to avoid memory overflow
- **Base64 encoding** for HTTP transfer

## Future Enhancements

### To Display Actual Images (Advanced):
You would need to:
1. Decode base64 to binary JPEG
2. Use a JPEG decoder library (e.g., TJpgDec)
3. Convert pixels to RGB565 format
4. Draw pixels to TFT

Example libraries:
- **TJpgDec** - JPEG decoder for Arduino
- **PNGdec** - PNG decoder

### For Video (Very Advanced):
- Send frames as individual images
- Display at 5-10 FPS (limited by ESP32 speed)
- Use motion JPEG format
- Requires significant optimization

## Troubleshooting

### Image not displaying
- Check Serial Monitor for chunk reception
- Verify all chunks received (count should match total)
- Try smaller image (lower resolution)

### Upload fails
- Check WiFi connection
- Ensure ESP32 has enough free memory
- Try restarting ESP32

### Slow upload
- Normal for WiFi transfer
- 160x120 image takes ~10-20 seconds
- Reduce image size for faster transfer

## Example Usage in App

```javascript
// Add to your device actions:
{
  id: 'show_smiley',
  name: 'Smiley',
  icon: '😊',
  path: 'display?mode=smiley',
  color: '#FFD700'
},
{
  id: 'show_text',
  name: 'Alert',
  icon: '⚠️',
  path: 'displayText?text=ALERT!',
  color: '#FF0000'
}
```

## Performance Tips

1. **Use small images** - 160x120 is optimal
2. **JPEG compression** - Reduces transfer size
3. **WiFi signal** - Strong signal = faster transfer
4. **Chunk size** - 1000 chars balances speed and reliability

Enjoy your new image display feature! 🎨
