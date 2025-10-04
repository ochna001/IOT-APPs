/*
  ESP32 provision + webserver + DHT22 + TFT Display
  - On boot, attempts to read WiFi creds from Preferences and connect
  - If connection succeeds, starts web server exposing: / , /on , /off , /status , /reset , /dht
  - If connection fails or no creds, starts AP + captive portal to accept SSID/password
  - Stores credentials in Preferences (NVS)
  - /reset clears stored credentials and reboots into provisioning AP
  - DHT22 sensor on GPIO 14 provides temperature and humidity via /dht endpoint
  - ST7789 TFT Display shows WiFi status, sensor readings, and system info

  Notes:
  - LED_BUILTIN varies by board; some ESP32 use GPIO 2, others may differ
  - Using Preferences library for persistent storage (cleaner than EEPROM on ESP32)
  - Requires DHT sensor library: Install "DHT sensor library" by Adafruit via Library Manager
  - Also install "Adafruit Unified Sensor" dependency
  - Requires Adafruit ST7789 and Adafruit GFX libraries for TFT display
  - Requires TJpg_Decoder library for JPEG image display
*/

#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <DNSServer.h>
#include <DHT.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <SPI.h>
#include <TJpg_Decoder.h>

const char* apSSID = "ESP32-Setup";
const int LED_PIN = 2; // Adjust if your board uses a different pin
const int DHT_PIN = 14; // GPIO 14 for DHT22 data
#define DHT_TYPE DHT22

// TFT Display pins (ST7789 - 240x320) - Hardware SPI
// Wiring: CS→5, DC→16, RST→17, SDA→23, SCL→18, VCC→3.3V, GND→GND
#define TFT_CS    5   // Chip select
#define TFT_DC    16  // Data/Command
#define TFT_RST   17  // Reset
// Hardware SPI uses GPIO 23 (MOSI) and GPIO 18 (SCLK) automatically

WebServer server(80);
DNSServer dnsServer;
Preferences prefs;
DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_ST7789 tft = Adafruit_ST7789(TFT_CS, TFT_DC, TFT_RST); // Hardware SPI

String storedSSID = "";
String storedPass = "";

// Image buffer for receiving images from app
String imageBuffer = "";
int totalImageChunks = 0;
int receivedChunks = 0;

// JPEG decoder callback function
bool tft_output(int16_t x, int16_t y, uint16_t w, uint16_t h, uint16_t* bitmap) {
  if (y >= tft.height()) return 0;
  // Draw the bitmap pixel by pixel
  tft.startWrite();
  tft.setAddrWindow(x, y, w, h);
  tft.writePixels(bitmap, w * h);
  tft.endWrite();
  return 1;
}

// TFT Display Functions
void initDisplay() {
  Serial.println("Initializing TFT display...");
  
  // Initialize the display
  tft.init(240, 320);
  Serial.println("TFT init done");
  
  tft.setRotation(1); // Landscape mode (320x240)
  Serial.println("Rotation set");
  
  // Simple color test - you should see these colors flash
  Serial.println("Testing colors...");
  tft.fillScreen(ST77XX_RED);
  Serial.println("RED");
  delay(1000);
  
  tft.fillScreen(ST77XX_GREEN);
  Serial.println("GREEN");
  delay(1000);
  
  tft.fillScreen(ST77XX_BLUE);
  Serial.println("BLUE");
  delay(1000);
  
  tft.fillScreen(ST77XX_WHITE);
  Serial.println("WHITE");
  delay(1000);
  
  tft.fillScreen(ST77XX_BLACK);
  Serial.println("BLACK");
  
  // Draw large white text
  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(4);
  tft.setCursor(30, 80);
  tft.println("HELLO!");
  
  Serial.println("TFT Display initialized - you should see HELLO!");
  delay(3000); // Show for 3 seconds
}

void updateDisplay() {
  Serial.println("Updating display...");
  
  // Clear screen
  tft.fillScreen(ST77XX_BLACK);
  
  // Read DHT22 sensor
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  
  // Title
  tft.setTextSize(3);
  tft.setTextColor(ST77XX_CYAN);
  tft.setCursor(10, 10);
  tft.println("DHT22");
  
  // Temperature
  tft.setTextSize(2);
  tft.setCursor(10, 60);
  if (!isnan(t)) {
    tft.setTextColor(ST77XX_GREEN);
    tft.print("Temp: ");
    tft.print(t, 1);
    tft.println(" C");
    Serial.print("Display Temp: ");
    Serial.println(t);
  } else {
    tft.setTextColor(ST77XX_RED);
    tft.println("Temp: ERROR");
    Serial.println("Display Temp: ERROR");
  }
  
  // Humidity
  tft.setCursor(10, 100);
  if (!isnan(h)) {
    tft.setTextColor(ST77XX_GREEN);
    tft.print("Humid: ");
    tft.print(h, 1);
    tft.println(" %");
    Serial.print("Display Humidity: ");
    Serial.println(h);
  } else {
    tft.setTextColor(ST77XX_RED);
    tft.println("Humid: ERROR");
    Serial.println("Display Humidity: ERROR");
  }
  
  // WiFi Status
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
  
  // LED Status
  tft.setCursor(10, 170);
  tft.setTextColor(ST77XX_WHITE);
  tft.print("LED: ");
  tft.println(digitalRead(LED_PIN) ? "ON" : "OFF");
  
  Serial.println("Display update complete");
}

void sendPlain(int code, const String &body) {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(code, "text/plain", body);
}

void handleRoot() {
  sendPlain(200, "ESP32 ready");
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
    s += "ip:" + WiFi.localIP().toString();
  } else {
    s += "not connected";
  }
  sendPlain(200, s);
}

void handleDHT() {
  float h = dht.readHumidity();
  float t = dht.readTemperature(); // Celsius
  
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
    sendPlain(400, "Unknown mode. Use: smiley, heart, alert, or data");
  }
}

void displaySmiley() {
  tft.fillScreen(ST77XX_BLACK);
  // Yellow face
  tft.fillCircle(160, 120, 80, ST77XX_YELLOW);
  // Eyes
  tft.fillCircle(130, 100, 10, ST77XX_BLACK);
  tft.fillCircle(190, 100, 10, ST77XX_BLACK);
  // Smile (draw as arc using line segments)
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

// Handle image chunk upload
void handleImageChunk() {
  if (!server.hasArg("index") || !server.hasArg("total") || !server.hasArg("data")) {
    sendPlain(400, "Missing parameters");
    return;
  }
  
  int index = server.arg("index").toInt();
  int total = server.arg("total").toInt();
  String data = server.arg("data");
  
  // First chunk - initialize
  if (index == 0) {
    imageBuffer = "";
    totalImageChunks = total;
    receivedChunks = 0;
    Serial.println("Starting image reception...");
  }
  
  // Append chunk
  imageBuffer += data;
  receivedChunks++;
  
  Serial.print("Received chunk ");
  Serial.print(receivedChunks);
  Serial.print("/");
  Serial.println(totalImageChunks);
  
  sendPlain(200, "Chunk received");
}

// Base64 decode helper
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

// Display the received image
void handleDisplayImage() {
  if (imageBuffer.length() == 0) {
    sendPlain(400, "No image data");
    return;
  }
  
  Serial.print("Displaying image... Buffer size: ");
  Serial.println(imageBuffer.length());
  
  tft.fillScreen(ST77XX_BLACK);
  
  // Decode base64 to binary JPEG
  int maxSize = imageBuffer.length() * 3 / 4 + 10;
  uint8_t* jpegData = (uint8_t*)malloc(maxSize);
  
  if (jpegData == NULL) {
    Serial.println("Failed to allocate memory for JPEG");
    tft.setTextSize(2);
    tft.setTextColor(ST77XX_RED);
    tft.setCursor(10, 100);
    tft.println("Memory Error!");
    sendPlain(500, "Out of memory");
    return;
  }
  
  int jpegSize = base64Decode(imageBuffer, jpegData, maxSize);
  Serial.print("Decoded JPEG size: ");
  Serial.println(jpegSize);
  
  // Initialize JPEG decoder
  TJpgDec.setSwapBytes(true);
  TJpgDec.setCallback(tft_output);
  
  // Get JPEG dimensions first
  uint16_t w = 0, h = 0;
  TJpgDec.getJpgSize(&w, &h, jpegData, jpegSize);
  Serial.print("JPEG dimensions: ");
  Serial.print(w);
  Serial.print("x");
  Serial.println(h);
  
  // Calculate scaling to fit screen (320x240 in landscape)
  uint8_t scale = 1;
  if (w > 320 || h > 240) {
    // Scale down to fit
    uint8_t scaleW = (w + 319) / 320;
    uint8_t scaleH = (h + 239) / 240;
    scale = max(scaleW, scaleH);
    if (scale > 8) scale = 8; // Max scale is 8
  }
  
  Serial.print("Using scale: 1/");
  Serial.println(scale);
  TJpgDec.setJpgScale(scale);
  
  // Decode and display JPEG centered
  uint32_t t = millis();
  
  // Get scaled dimensions
  TJpgDec.getJpgSize(&w, &h, jpegData, jpegSize);
  
  // Center the image
  int16_t x = (320 - w) / 2;
  int16_t y = (240 - h) / 2;
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  
  int result = TJpgDec.drawJpg(x, y, jpegData, jpegSize);
  t = millis() - t;
  
  free(jpegData);
  
  if (result == 0) {
    Serial.print("JPEG displayed successfully in ");
    Serial.print(t);
    Serial.println(" ms");
    sendPlain(200, "Image displayed");
  } else {
    Serial.print("JPEG decode failed with error: ");
    Serial.println(result);
    tft.setTextSize(2);
    tft.setTextColor(ST77XX_RED);
    tft.setCursor(10, 100);
    tft.println("Decode Error!");
    sendPlain(500, "JPEG decode failed");
  }
  
  // Clear buffer to free memory
  imageBuffer = "";
}

// Simple text display endpoint
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
  server.on("/reset", [](){
    // clear stored credentials and reboot
    prefs.begin("wifi", false);
    prefs.clear();
    prefs.end();
    sendPlain(200, "Resetting to provisioning mode...");
    delay(500);
    ESP.restart();
  });
  server.begin();
  Serial.println("Webserver started");
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
  Serial.println("Saving credentials to Preferences...");
  prefs.begin("wifi", false);
  prefs.putString("ssid", ssid);
  prefs.putString("pass", pass);
  prefs.end();
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "text/html", "Saved. Rebooting and attempting to connect...");
  delay(500);
  ESP.restart();
}

void startAP() {
  WiFi.mode(WIFI_AP);
  // set a known AP IP before starting softAP so captive portal and manual navigation are consistent
  IPAddress apIP(192,168,4,1);
  IPAddress gateway = apIP;
  IPAddress subnet(255,255,255,0);
  WiFi.softAPConfig(apIP, gateway, subnet);
  WiFi.softAP(apSSID);
  // start a DNS server that redirects all domains to the AP IP (captive portal)
  dnsServer.start(53, "*", apIP);
  Serial.print("AP '"); Serial.print(apSSID); Serial.print("' IP: "); Serial.println(WiFi.softAPIP());
  server.on("/", handleRootAP);
  server.on("/save", HTTP_POST, handleSave);
  server.begin();
}

void tryConnectFromPreferences() {
  prefs.begin("wifi", true); // read-only
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
      // blink LED while attempting to connect
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
      Serial.println("Failed to connect, starting AP provisioning");
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
  Serial.println("--- ESP32 provision + webserver + DHT22 + TFT boot ---");
  
  // Initialize TFT Display
  initDisplay();
  
  // Initialize DHT sensor
  dht.begin();
  Serial.println("DHT22 sensor initialized on GPIO 14");
  
  tryConnectFromPreferences();
}

void loop() {
  // handle web server clients
  server.handleClient();
  // when in AP/captive mode we need the DNS server to process requests
  if (WiFi.getMode() == WIFI_AP) {
    dnsServer.processNextRequest();
  }
  // Display updates only on demand via web endpoints
}