/*
  ESP32 with JPEGDEC + AnimatedGIF Display
  
  Features:
  1. JPEGDEC for fast static image display
  2. AnimatedGIF for smooth GIF playback (10+ FPS)
  3. Optimized memory usage
  4. Auto-scaling for any image/GIF size
  
  Install:
  - Arduino Library Manager -> "JPEGDEC" by bitbank2
  - Arduino Library Manager -> "AnimatedGIF" by bitbank2 (v2.2.0+)
*/

#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <DNSServer.h>
#include <DHT.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <SPI.h>
#include <JPEGDEC.h>
#include <AnimatedGIF.h>

const char* apSSID = "ESP32-Setup";
const int LED_PIN = 2;
const int DHT_PIN = 14;
#define DHT_TYPE DHT22

// TFT Display pins (ST7789 - 240x320)
#define TFT_CS    5
#define TFT_DC    16
#define TFT_RST   17

WebServer server(80);
DNSServer dnsServer;
Preferences prefs;
DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_ST7789 tft = Adafruit_ST7789(TFT_CS, TFT_DC, TFT_RST);

String storedSSID = "";
String storedPass = "";

// Image buffers
uint8_t* jpegBuffer = nullptr;
int jpegBufferSize = 0;
const int MAX_JPEG_SIZE = 80000; // 80KB max

// GIF buffer
uint8_t* gifBuffer = nullptr;
int gifBufferSize = 0;
const int MAX_GIF_SIZE = 150000; // 150KB max for GIFs (reduced for memory constraints)
bool isPlayingGif = false;

// JPEGDEC instance
JPEGDEC jpeg;

// AnimatedGIF instance
AnimatedGIF gif;

// ===== JPEGDEC Callback Function =====
int JPEGDraw(JPEGDRAW *pDraw) {
  tft.startWrite();
  tft.setAddrWindow(pDraw->x, pDraw->y, pDraw->iWidth, pDraw->iHeight);
  tft.writePixels((uint16_t*)pDraw->pPixels, pDraw->iWidth * pDraw->iHeight);
  tft.endWrite();
  return 1;
}

// ===== AnimatedGIF Callback Function =====
void GIFDraw(GIFDRAW *pDraw) {
  uint8_t *s;
  uint16_t *usPalette, usTemp[320];
  int x, y, iWidth;

  iWidth = pDraw->iWidth;
  if (iWidth > 320) iWidth = 320;
  
  usPalette = pDraw->pPalette;
  y = pDraw->iY + pDraw->y; // current line
  
  // Skip lines outside display area
  if (y >= 240) return;
  
  s = pDraw->pPixels;
  
  // Simplified rendering - ignore transparency for speed
  // Convert palette indices to RGB565 colors
  for (x = 0; x < iWidth; x++) {
    usTemp[x] = usPalette[s[x]];
  }
  
  // Fast bulk write to display
  tft.startWrite();
  tft.setAddrWindow(pDraw->iX, y, iWidth, 1);
  tft.writePixels(usTemp, iWidth);
  tft.endWrite();
}

// ===== TFT Display Functions =====
void initDisplay() {
  Serial.println("Initializing TFT display...");
  
  tft.init(240, 320);
  tft.setRotation(1); // Landscape mode (320x240)
  
  // Quick color test
  tft.fillScreen(ST77XX_RED);
  delay(500);
  tft.fillScreen(ST77XX_GREEN);
  delay(500);
  tft.fillScreen(ST77XX_BLUE);
  delay(500);
  tft.fillScreen(ST77XX_BLACK);
  
  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(4);
  tft.setCursor(30, 80);
  tft.println("READY!");
  
  Serial.println("TFT Display initialized");
  delay(2000);
}

void updateDisplay() {
  Serial.println("Updating display...");
  tft.fillScreen(ST77XX_BLACK);
  
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  
  tft.setTextSize(3);
  tft.setTextColor(ST77XX_CYAN);
  tft.setCursor(10, 10);
  tft.println("DHT22");
  
  tft.setTextSize(2);
  tft.setCursor(10, 60);
  if (!isnan(t)) {
    tft.setTextColor(ST77XX_GREEN);
    tft.print("Temp: ");
    tft.print(t, 1);
    tft.println(" C");
  } else {
    tft.setTextColor(ST77XX_RED);
    tft.println("Temp: ERROR");
  }
  
  tft.setCursor(10, 100);
  if (!isnan(h)) {
    tft.setTextColor(ST77XX_GREEN);
    tft.print("Humid: ");
    tft.print(h, 1);
    tft.println(" %");
  } else {
    tft.setTextColor(ST77XX_RED);
    tft.println("Humid: ERROR");
  }
  
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_YELLOW);
  tft.setCursor(10, 150);
  if (WiFi.status() == WL_CONNECTED) {
    tft.print("WiFi: ");
    tft.println(WiFi.localIP());
  } else if (WiFi.getMode() == WIFI_AP) {
    tft.println("WiFi: AP Mode");
  } else {
    tft.println("WiFi: Disconnected");
  }
  
  tft.setCursor(10, 170);
  tft.setTextColor(ST77XX_WHITE);
  tft.print("LED: ");
  tft.println(digitalRead(LED_PIN) ? "ON" : "OFF");
}

// ===== Base64 Decoder =====
uint8_t base64DecodeChar(char c) {
  if (c >= 'A' && c <= 'Z') return c - 'A';
  if (c >= 'a' && c <= 'z') return c - 'a' + 26;
  if (c >= '0' && c <= '9') return c - '0' + 52;
  if (c == '+') return 62;
  if (c == '/') return 63;
  return 0;
}

int base64Decode(const String& input, uint8_t* output, int maxLen) {
  int outLen = 0;
  int val = 0;
  int valb = -8;
  
  for (int i = 0; i < input.length() && outLen < maxLen; i++) {
    char c = input[i];
    if (c == '=') break;
    if (c == ' ' || c == '\n' || c == '\r') continue;
    
    val = (val << 6) | base64DecodeChar(c);
    valb += 6;
    
    if (valb >= 0) {
      output[outLen++] = (val >> valb) & 0xFF;
      valb -= 8;
    }
  }
  return outLen;
}

// ===== Helper function to decode and display a JPEG frame =====
bool decodeJPEGFrame(uint8_t* buffer, int size, int offsetX = 0, int offsetY = 0) {
  int result = jpeg.openRAM(buffer, size, JPEGDraw);
  
  if (result != 1) {
    return false;
  }
  
  int width = jpeg.getWidth();
  int height = jpeg.getHeight();
  
  // Calculate scale
  int scale = 1;
  if (width > 320 || height > 240) {
    int scaleW = (width + 319) / 320;
    int scaleH = (height + 239) / 240;
    scale = max(scaleW, scaleH);
    if (scale > 8) scale = 8;
  }
  
  // Center on display
  if (scale > 1) {
    width /= scale;
    height /= scale;
  }
  int x = offsetX + (320 - width) / 2;
  int y = offsetY + (240 - height) / 2;
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  
  result = jpeg.decode(x, y, scale > 1 ? JPEG_SCALE_HALF : 0);
  jpeg.close();
  
  return (result == 1);
}

// ===== Web Server Handlers =====
void sendPlain(int code, const String &body) {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(code, "text/plain", body);
}

void handleRoot() {
  sendPlain(200, "ESP32 ready with JPEGDEC + AnimatedGIF");
}

void handleOn() {
  digitalWrite(LED_PIN, HIGH);
  sendPlain(200, "ON");
}

void handleOff() {
  digitalWrite(LED_PIN, LOW);
  sendPlain(200, "OFF");
}

void handleStatus() {
  String s = "mode:";
  s += (WiFi.getMode() == WIFI_AP) ? "AP" : "STA";
  s += "\n";
  if (WiFi.status() == WL_CONNECTED) {
    s += "ip: " + WiFi.localIP().toString();
  } else {
    s += "not connected";
  }
  sendPlain(200, s);
}

void handleDHT() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  
  if (isnan(h) || isnan(t)) {
    sendPlain(500, "Failed to read from DHT sensor");
    return;
  }
  
  String response = "temperature:" + String(t, 1) + "\n";
  response += "humidity:" + String(h, 1);
  sendPlain(200, response);
}

void handleDisplay() {
  String mode = server.arg("mode");
  
  if (mode == "smiley") {
    displaySmiley();
    sendPlain(200, "Displaying smiley");
  } else if (mode == "heart") {
    displayHeart();
    sendPlain(200, "Displaying heart");
  } else if (mode == "alert") {
    displayAlert();
    sendPlain(200, "Displaying alert");
  } else if (mode == "data") {
    updateDisplay();
    sendPlain(200, "Displaying sensor data");
  } else {
    sendPlain(400, "Unknown mode");
  }
}

void displaySmiley() {
  tft.fillScreen(ST77XX_BLACK);
  tft.fillCircle(160, 120, 80, ST77XX_YELLOW);
  tft.fillCircle(130, 100, 10, ST77XX_BLACK);
  tft.fillCircle(190, 100, 10, ST77XX_BLACK);
  for (int i = 0; i < 180; i += 5) {
    float angle1 = (i * 3.14159) / 180.0;
    float angle2 = ((i + 5) * 3.14159) / 180.0;
    int x1 = 160 + 50 * cos(angle1);
    int y1 = 120 + 30 * sin(angle1);
    int x2 = 160 + 50 * cos(angle2);
    int y2 = 120 + 30 * sin(angle2);
    tft.drawLine(x1, y1, x2, y2, ST77XX_BLACK);
  }
}

void displayHeart() {
  tft.fillScreen(ST77XX_BLACK);
  tft.fillCircle(140, 100, 40, ST77XX_RED);
  tft.fillCircle(180, 100, 40, ST77XX_RED);
  tft.fillTriangle(100, 110, 220, 110, 160, 180, ST77XX_RED);
}

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

// ===== Image Upload Handlers =====
void handleImageChunk() {
  if (!server.hasArg("index") || !server.hasArg("total") || !server.hasArg("data")) {
    sendPlain(400, "Missing parameters");
    return;
  }
  
  int index = server.arg("index").toInt();
  int total = server.arg("total").toInt();
  String data = server.arg("data");
  
  // First chunk - allocate buffer
  if (index == 0) {
    if (jpegBuffer != nullptr) {
      free(jpegBuffer);
    }
    jpegBuffer = (uint8_t*)malloc(MAX_JPEG_SIZE);
    if (jpegBuffer == nullptr) {
      sendPlain(500, "Out of memory");
      return;
    }
    jpegBufferSize = 0;
    Serial.println("Starting image reception...");
    Serial.print("Free heap: ");
    Serial.println(ESP.getFreeHeap());
  }
  
  // Decode this chunk from base64 and append to buffer
  int chunkLen = data.length();
  int decodedSize = (chunkLen * 3) / 4 + 10;
  
  if (jpegBufferSize + decodedSize > MAX_JPEG_SIZE) {
    sendPlain(500, "Image too large");
    free(jpegBuffer);
    jpegBuffer = nullptr;
    return;
  }
  
  int decoded = base64Decode(data, jpegBuffer + jpegBufferSize, MAX_JPEG_SIZE - jpegBufferSize);
  jpegBufferSize += decoded;
  
  Serial.print("Chunk ");
  Serial.print(index + 1);
  Serial.print("/");
  Serial.print(total);
  Serial.print(" - Buffer size: ");
  Serial.println(jpegBufferSize);
  
  sendPlain(200, "OK");
}

void handleDisplayImage() {
  if (jpegBuffer == nullptr || jpegBufferSize == 0) {
    sendPlain(400, "No image data");
    return;
  }
  
  Serial.print("Decoding JPEG with JPEGDEC... Size: ");
  Serial.println(jpegBufferSize);
  
  tft.fillScreen(ST77XX_BLACK);
  
  unsigned long startTime = millis();
  
  bool success = decodeJPEGFrame(jpegBuffer, jpegBufferSize);
  
  unsigned long decodeTime = millis() - startTime;
  
  if (success) {
    Serial.print("JPEG decoded successfully in ");
    Serial.print(decodeTime);
    Serial.println(" ms");
    Serial.print("Free heap after: ");
    Serial.println(ESP.getFreeHeap());
    sendPlain(200, "Image displayed in " + String(decodeTime) + "ms");
  } else {
    Serial.println("JPEG decode failed");
    tft.setTextSize(2);
    tft.setTextColor(ST77XX_RED);
    tft.setCursor(10, 100);
    tft.println("Decode Failed!");
    sendPlain(500, "Decode failed");
  }
  
  // Free memory
  free(jpegBuffer);
  jpegBuffer = nullptr;
  jpegBufferSize = 0;
}

// ===== GIF Upload Handlers =====
void handleGifChunk() {
  Serial.println("=== GIF Chunk Handler Called ===");
  Serial.print("Method: ");
  Serial.println(server.method() == HTTP_POST ? "POST" : "GET");
  
  // Support both GET (with query params) and POST (with body)
  String data;
  int index = 0;
  int total = 0;
  
  if (server.method() == HTTP_POST) {
    // POST request - data in body
    if (!server.hasArg("index") || !server.hasArg("total")) {
      Serial.println("ERROR: Missing index/total parameters");
      sendPlain(400, "Missing index/total parameters");
      return;
    }
    index = server.arg("index").toInt();
    total = server.arg("total").toInt();
    
    // Try multiple ways to get POST body
    if (server.hasArg("plain")) {
      data = server.arg("plain");
      Serial.println("Got data from arg('plain')");
    } else {
      // Try getting raw body
      data = server.arg(0); // First argument
      Serial.println("Got data from arg(0)");
    }
    
    Serial.print("POST body length: ");
    Serial.println(data.length());
  } else {
    // GET request - data in query params (legacy)
    if (!server.hasArg("index") || !server.hasArg("total") || !server.hasArg("data")) {
      Serial.println("ERROR: Missing parameters");
      sendPlain(400, "Missing parameters");
      return;
    }
    index = server.arg("index").toInt();
    total = server.arg("total").toInt();
    data = server.arg("data");
    Serial.print("GET data length: ");
    Serial.println(data.length());
  }
  
  if (data.length() == 0) {
    Serial.println("ERROR: No data received!");
    sendPlain(400, "No data received");
    return;
  }
  
  // First chunk - allocate buffer
  if (index == 0) {
    // Free any existing buffers first
    if (gifBuffer != nullptr) {
      free(gifBuffer);
      gifBuffer = nullptr;
    }
    if (jpegBuffer != nullptr) {
      free(jpegBuffer);
      jpegBuffer = nullptr;
    }
    
    Serial.println("Starting GIF reception...");
    Serial.print("Free heap before allocation: ");
    unsigned long freeHeap = ESP.getFreeHeap();
    Serial.println(freeHeap);
    
    // Calculate needed size: total chunks * avg chunk size + buffer
    // For safety, allocate MAX_GIF_SIZE or free heap - 50KB (whichever is smaller)
    int allocSize = MAX_GIF_SIZE;
    if (freeHeap < (MAX_GIF_SIZE + 50000)) {
      allocSize = freeHeap - 50000; // Leave 50KB for other operations
      Serial.print("Adjusting allocation size to: ");
      Serial.println(allocSize);
    }
    
    Serial.print("Trying to allocate: ");
    Serial.println(allocSize);
    
    gifBuffer = (uint8_t*)malloc(allocSize);
    if (gifBuffer == nullptr) {
      Serial.println("ERROR: Failed to allocate GIF buffer!");
      Serial.print("Free heap: ");
      Serial.println(ESP.getFreeHeap());
      
      // Try smaller allocation
      allocSize = 100000; // Try 100KB
      Serial.print("Retrying with smaller size: ");
      Serial.println(allocSize);
      gifBuffer = (uint8_t*)malloc(allocSize);
      
      if (gifBuffer == nullptr) {
        Serial.println("ERROR: Still failed!");
        sendPlain(500, "Out of memory for GIF");
        return;
      }
    }
    
    gifBufferSize = 0;
    Serial.println("GIF buffer allocated successfully!");
    Serial.print("Free heap after allocation: ");
    Serial.println(ESP.getFreeHeap());
  }
  
  // Decode this chunk from base64 and append to buffer
  int chunkLen = data.length();
  int decodedSize = (chunkLen * 3) / 4 + 10;
  
  if (gifBufferSize + decodedSize > MAX_GIF_SIZE) {
    sendPlain(500, "GIF too large");
    free(gifBuffer);
    gifBuffer = nullptr;
    return;
  }
  
  int decoded = base64Decode(data, gifBuffer + gifBufferSize, MAX_GIF_SIZE - gifBufferSize);
  gifBufferSize += decoded;
  
  Serial.print("GIF Chunk ");
  Serial.print(index + 1);
  Serial.print("/");
  Serial.print(total);
  Serial.print(" - Buffer size: ");
  Serial.println(gifBufferSize);
  
  sendPlain(200, "OK");
}

void handlePlayGif() {
  if (gifBuffer == nullptr || gifBufferSize == 0) {
    sendPlain(400, "No GIF data");
    return;
  }
  
  Serial.print("Playing GIF... Size: ");
  Serial.println(gifBufferSize);
  
  tft.fillScreen(ST77XX_BLACK);
  
  if (gif.open(gifBuffer, gifBufferSize, GIFDraw)) {
    Serial.println("GIF opened successfully");
    Serial.print("Canvas size: ");
    Serial.print(gif.getCanvasWidth());
    Serial.print("x");
    Serial.println(gif.getCanvasHeight());
    
    isPlayingGif = true;
    sendPlain(200, "GIF playing");
    
    // Play GIF in loop (will be stopped by handleStopGif)
    int frameCount = 0;
    unsigned long startTime = millis();
    
    while (isPlayingGif) {
      int result = gif.playFrame(true, NULL);
      if (result == 0) { // End of animation
        gif.reset(); // Loop the animation
        
        // Calculate and print FPS
        unsigned long elapsed = millis() - startTime;
        if (elapsed > 0) {
          float fps = (frameCount * 1000.0) / elapsed;
          Serial.print("FPS: ");
          Serial.println(fps);
        }
        frameCount = 0;
        startTime = millis();
      }
      frameCount++;
      
      // Minimal delay for smoother playback
      delay(10); // ~100 FPS max, actual speed depends on GIF
      
      // Periodically check for stop command (every 10 frames)
      if (frameCount % 10 == 0) {
        server.handleClient();
      }
    }
    
    gif.close();
    Serial.println("GIF playback finished");
    
  } else {
    Serial.println("Failed to open GIF");
    tft.setTextSize(2);
    tft.setTextColor(ST77XX_RED);
    tft.setCursor(10, 100);
    tft.println("GIF Failed!");
    sendPlain(500, "Failed to open GIF");
  }
  
  // Free memory
  free(gifBuffer);
  gifBuffer = nullptr;
  gifBufferSize = 0;
}

void handleStopGif() {
  isPlayingGif = false;
  sendPlain(200, "GIF stopped");
}

void handleDisplayText() {
  String text = server.arg("text");
  if (text.length() == 0) {
    sendPlain(400, "Missing text parameter");
    return;
  }
  
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextSize(3);
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(10, 100);
  tft.println(text);
  
  sendPlain(200, "Text displayed");
}

void startWebServer() {
  server.on("/", handleRoot);
  server.on("/on", handleOn);
  server.on("/off", handleOff);
  server.on("/status", handleStatus);
  server.on("/dht", handleDHT);
  server.on("/display", handleDisplay);
  server.on("/imageChunk", handleImageChunk);
  server.on("/displayImage", handleDisplayImage);
  server.on("/displayText", handleDisplayText);
  
  // GIF endpoints - support both GET and POST
  server.on("/gifChunk", HTTP_GET, handleGifChunk);
  server.on("/gifChunk", HTTP_POST, handleGifChunk);
  server.on("/playGif", handlePlayGif);
  server.on("/stopGif", handleStopGif);
  
  server.on("/reset", [](){
    prefs.begin("wifi", false);
    prefs.clear();
    prefs.end();
    sendPlain(200, "Resetting...");
    delay(500);
    ESP.restart();
  });
  
  server.begin();
  Serial.println("Webserver started with JPEGDEC + AnimatedGIF");
}

void handleRootAP() {
  String html = "<html><body><h2>Device WiFi Setup</h2>";
  html += "<form method='POST' action='/save'>";
  html += "SSID: <input name='ssid' /><br/>";
  html += "Password: <input name='pass' type='password' /><br/>";
  html += "<button type='submit'>Save & Connect</button>";
  html += "</form></body></html>";
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "text/html", html);
}

void handleSave() {
  String ssid = server.arg("ssid");
  String pass = server.arg("pass");
  if (ssid.length() == 0) {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(400, "text/plain", "Missing ssid");
    return;
  }
  prefs.begin("wifi", false);
  prefs.putString("ssid", ssid);
  prefs.putString("pass", pass);
  prefs.end();
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "text/html", "Saved. Rebooting...");
  delay(500);
  ESP.restart();
}

void startAP() {
  WiFi.mode(WIFI_AP);
  IPAddress apIP(192,168,4,1);
  IPAddress gateway = apIP;
  IPAddress subnet(255,255,255,0);
  WiFi.softAPConfig(apIP, gateway, subnet);
  WiFi.softAP(apSSID);
  dnsServer.start(53, "*", apIP);
  Serial.print("AP '"); Serial.print(apSSID); Serial.print("' IP: "); Serial.println(WiFi.softAPIP());
  server.on("/", handleRootAP);
  server.on("/save", HTTP_POST, handleSave);
  server.begin();
}

void tryConnectFromPreferences() {
  prefs.begin("wifi", true);
  storedSSID = prefs.getString("ssid", "");
  storedPass = prefs.getString("pass", "");
  prefs.end();

  if (storedSSID.length() > 0) {
    Serial.print("Found stored SSID: "); Serial.println(storedSSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(storedSSID.c_str(), storedPass.c_str());
    unsigned long start = millis();
    const unsigned long timeout = 20000;
    while (WiFi.status() != WL_CONNECTED && (millis() - start) < timeout) {
      digitalWrite(LED_PIN, HIGH);
      delay(200);
      digitalWrite(LED_PIN, LOW);
      delay(300);
      Serial.print('.');
    }
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println();
      Serial.print("Connected, IP: "); Serial.println(WiFi.localIP());
      startWebServer();
    } else {
      Serial.println();
      Serial.println("Failed to connect, starting AP");
      startAP();
    }
  } else {
    startAP();
  }
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  Serial.begin(115200);
  delay(1000);
  Serial.println("--- ESP32 with JPEGDEC Image Display ---");
  
  initDisplay();
  dht.begin();
  
  Serial.println("DHT22 initialized");
  Serial.print("Total heap: ");
  Serial.println(ESP.getHeapSize());
  Serial.print("Free heap: ");
  Serial.println(ESP.getFreeHeap());
  
  tryConnectFromPreferences();
}

void loop() {
  server.handleClient();
  if (WiFi.getMode() == WIFI_AP) {
    dnsServer.processNextRequest();
  }
}