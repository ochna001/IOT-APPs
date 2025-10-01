/*
  ESP8266 provision + webserver
  - On boot, attempts to read WiFi creds from EEPROM and connect
  - If connection succeeds, starts web server exposing: / , /on , /off , /status , /reset
  - If connection fails or no creds, starts AP + captive portal to accept SSID/password
  - Stores credentials in EEPROM
  - /reset clears stored credentials and reboots into provisioning AP

  Notes:
  - LED_BUILTIN is usually inverted on many ESP8266 boards (LOW = ON)
  - EEPROM used for simple storage; adjust size if needed
*/

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <EEPROM.h>
#include <DNSServer.h>

const char* apSSID = "ESP8266-Setup";
const int EEPROM_SIZE = 512;

ESP8266WebServer server(80);
DNSServer dnsServer;

String storedSSID = "";
String storedPass = "";

void sendPlain(int code, const String &body) {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(code, "text/plain", body);
}

void handleRoot() {
  sendPlain(200, "ESP8266 ready");
}

void handleOn() {
  digitalWrite(LED_BUILTIN, LOW); // many ESP8266 boards use inverted LED
  sendPlain(200, "ON");
}

void handleOff() {
  digitalWrite(LED_BUILTIN, HIGH);
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
    EEPROM.begin(EEPROM_SIZE);
    int addr = 0;
    EEPROM.write(addr++, 0); // ssid len 0
    EEPROM.write(addr++, 0); // pass len 0
    EEPROM.commit();
    EEPROM.end();
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
  Serial.println("Saving credentials to EEPROM...");
  EEPROM.begin(EEPROM_SIZE);
  int addr = 0;
  EEPROM.write(addr++, ssid.length());
  for (int i = 0; i < ssid.length(); ++i) EEPROM.write(addr++, ssid[i]);
  EEPROM.write(addr++, pass.length());
  for (int i = 0; i < pass.length(); ++i) EEPROM.write(addr++, pass[i]);
  EEPROM.commit();
  EEPROM.end();
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
  Serial.print("AP '" ); Serial.print(apSSID); Serial.print("' IP: "); Serial.println(WiFi.softAPIP());
  server.on("/", handleRootAP);
  server.on("/save", HTTP_POST, handleSave);
  server.begin();
}

void tryConnectFromEEPROM() {
  EEPROM.begin(EEPROM_SIZE);
  int addr = 0;
  int slen = EEPROM.read(addr++);
  if (slen > 0 && slen < 100) {
    char buf[101];
    for (int i = 0; i < slen; ++i) buf[i] = EEPROM.read(addr++);
    buf[slen] = 0;
    storedSSID = String(buf);
  }
  int plen = EEPROM.read(addr++);
  if (plen > 0 && plen < 100) {
    char buf[101];
    for (int i = 0; i < plen; ++i) buf[i] = EEPROM.read(addr++);
    buf[plen] = 0;
    storedPass = String(buf);
  }
  EEPROM.end();

  if (storedSSID.length() > 0) {
    Serial.print("Found stored SSID: "); Serial.println(storedSSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(storedSSID.c_str(), storedPass.c_str());
    unsigned long start = millis();
    const unsigned long timeout = 20000;
    while (WiFi.status() != WL_CONNECTED && (millis() - start) < timeout) {
      // blink LED while attempting to connect
      digitalWrite(LED_BUILTIN, LOW);
      delay(200);
      digitalWrite(LED_BUILTIN, HIGH);
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
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH);
  Serial.begin(115200);
  delay(1000);
  Serial.println("--- ESP8266 provision + webserver boot ---");
  tryConnectFromEEPROM();
}

void loop() {
  // handle web server clients
  server.handleClient();
  // when in AP/captive mode we need the DNS server to process requests
  if (WiFi.getMode() == WIFI_AP) {
    dnsServer.processNextRequest();
  }
}
