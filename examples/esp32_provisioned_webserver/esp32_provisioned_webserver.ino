/*
  ESP32 provision + webserver
  - On boot, attempts to read WiFi creds from Preferences and connect
  - If connection succeeds, starts web server exposing: / , /on , /off , /status , /reset
  - If connection fails or no creds, starts AP + captive portal to accept SSID/password
  - Stores credentials in Preferences (NVS)
  - /reset clears stored credentials and reboots into provisioning AP

  Notes:
  - LED_BUILTIN varies by board; some ESP32 use GPIO 2, others may differ
  - Using Preferences library for persistent storage (cleaner than EEPROM on ESP32)
*/

#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <DNSServer.h>

const char* apSSID = "ESP32-Setup";
const int LED_PIN = 2; // Adjust if your board uses a different pin

WebServer server(80);
DNSServer dnsServer;
Preferences prefs;

String storedSSID = "";
String storedPass = "";

void sendPlain(int code, const String &body) {
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

void startWebServer() {
  server.on("/", handleRoot);
  server.on("/on", handleOn);
  server.on("/off", handleOff);
  server.on("/status", handleStatus);
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
  server.send(200, "text/html", html);
}

void handleSave() {
  String ssid = server.arg("ssid");
  String pass = server.arg("pass");
  if (ssid.length() == 0) {
    server.send(400, "text/plain", "Missing ssid");
    return;
  }
  Serial.println("Saving credentials to Preferences...");
  prefs.begin("wifi", false);
  prefs.putString("ssid", ssid);
  prefs.putString("pass", pass);
  prefs.end();
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
  Serial.println("--- ESP32 provision + webserver boot ---");
  tryConnectFromPreferences();
}

void loop() {
  // handle web server clients
  server.handleClient();
  // when in AP/captive mode we need the DNS server to process requests
  if (WiFi.getMode() == WIFI_AP) {
    dnsServer.processNextRequest();
  }
}