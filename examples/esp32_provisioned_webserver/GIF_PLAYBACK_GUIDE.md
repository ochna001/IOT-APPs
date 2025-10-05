# AnimatedGIF Playback Guide

## Overview
This implementation adds smooth animated GIF playback to your ESP32 TFT display with 10+ FPS performance using the AnimatedGIF library by Larry Bank.

## Features
- ✅ Smooth GIF animation at 10+ FPS
- ✅ Automatic looping
- ✅ Optimized for ESP32 (32K+ RAM required)
- ✅ Compatible with 320x240 ST7789 TFT display
- ✅ Mobile app integration for easy GIF upload
- ✅ Start/Stop controls

## Installation

### ESP32 Side
1. Open Arduino IDE
2. Go to **Tools > Manage Libraries**
3. Search for "AnimatedGIF" by Larry Bank
4. Install version **2.2.0 or higher**
5. Upload the `esp32_provisioned_webserver.ino` sketch

### Mobile App
No additional dependencies required - the GIF picker uses the existing ImagePicker library.

## Usage

### From Mobile App
1. Open the device screen in the app
2. Scroll to the **"🎬 Play Animated GIF"** section
3. Tap **"Select GIF File"**
4. Choose a GIF from your device
5. The GIF will upload and start playing automatically
6. Tap **"Stop GIF"** to stop playback

### API Endpoints

#### Upload GIF (Chunked)
```
GET /gifChunk?index=0&total=100&data=<base64_chunk>
```

#### Start GIF Playback
```
GET /playGif
```
Starts playing the uploaded GIF in a loop.

#### Stop GIF Playback
```
GET /stopGif
```
Stops the currently playing GIF.

## Performance Tips

### Optimal GIF Specifications
- **Resolution**: 320x240 or smaller (will auto-scale)
- **File Size**: Under 200KB for best performance
- **Frame Rate**: 10-30 FPS in the source GIF
- **Color Depth**: 256 colors or less
- **Duration**: 2-10 seconds works best

### Creating Optimized GIFs
Use online tools or software like:
- **ezgif.com** - Online GIF optimizer
- **GIMP** - Reduce colors to 128-256
- **Photoshop** - Export for web with reduced colors

### Example Optimization Steps:
1. Resize to 320x240 or smaller
2. Reduce to 128-256 colors
3. Set frame delay to 100ms (10 FPS)
4. Compress/optimize the file

## Technical Details

### Memory Usage
- **GIF Buffer**: 200KB max (configurable via `MAX_GIF_SIZE`)
- **Frame Buffer**: Allocated dynamically by AnimatedGIF library
- **Total RAM**: ~250KB during playback

### How It Works
1. Mobile app sends GIF as base64-encoded chunks
2. ESP32 receives and assembles chunks into buffer
3. AnimatedGIF library decodes frames on-the-fly
4. Each frame is rendered via the `GIFDraw()` callback
5. Display updates at the GIF's native frame rate
6. Animation loops automatically until stopped

### Callback Function
The `GIFDraw()` callback handles:
- Transparency support
- Disposal methods (clear, restore background)
- Line-by-line rendering to TFT
- Palette-to-RGB565 conversion

## Troubleshooting

### GIF Won't Play
- **Check file size**: Must be under 200KB
- **Verify format**: Must be a valid GIF file
- **Check memory**: ESP32 needs ~250KB free RAM
- **Serial monitor**: Check for error messages

### Slow/Choppy Playback
- **Reduce resolution**: Try 240x180 or smaller
- **Reduce colors**: Use 128 colors instead of 256
- **Simplify animation**: Fewer frames or simpler graphics
- **Lower frame rate**: 10 FPS is optimal

### Out of Memory Error
- **Reduce GIF size**: Compress or resize the GIF
- **Restart ESP32**: Free up memory
- **Check `MAX_GIF_SIZE`**: Adjust if needed

### Upload Fails
- **Check WiFi**: Ensure stable connection
- **Timeout**: Large files may timeout - reduce size
- **Chunk errors**: Check serial monitor for details

## Example GIFs to Try

Good examples:
- Simple loading spinners
- Weather icons with animation
- Status indicators
- Logo animations
- Simple character animations

Avoid:
- High-resolution photos
- Complex video conversions
- Very long animations (>30 seconds)
- High frame rate (>30 FPS) GIFs

## Comparison: GIF vs Video Streaming

| Feature | AnimatedGIF | Video Frame Streaming |
|---------|-------------|----------------------|
| FPS | 10-30 FPS | 5-10 FPS |
| Smoothness | Excellent | Choppy |
| Setup | Easy | Complex |
| File Size | Small (50-200KB) | N/A (streaming) |
| Looping | Built-in | Manual |
| CPU Usage | Low | High |
| Memory | ~250KB | Variable |

## Advanced Configuration

### Adjust Buffer Size
In `esp32_provisioned_webserver.ino`:
```cpp
const int MAX_GIF_SIZE = 200000; // Increase for larger GIFs
```

### Disable Auto-Loop
Modify `handlePlayGif()`:
```cpp
// Remove the gif.reset() call to play once
if (result == 0) {
  break; // Stop instead of looping
}
```

### Adjust Playback Speed
Modify the delay in `handlePlayGif()`:
```cpp
delay(gif.getFrameDelay() / 2); // 2x speed
delay(gif.getFrameDelay() * 2); // 0.5x speed
```

## Credits
- **AnimatedGIF Library**: Larry Bank (bitbank2)
- **JPEGDEC Library**: Larry Bank (bitbank2)
- **Adafruit GFX/ST7789**: Adafruit Industries

## License
This implementation follows the same license as the AnimatedGIF library (Apache 2.0).
