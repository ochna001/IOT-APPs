/*
 Simple ESP32 web server example that responds to /on and /off
 Upload to your ESP32 and make sure it's on the same network as your phone.
*/

#include <WiFi.h>
#include <WebServer.h>

const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASS";

WebServer server(80);

void handleRoot() {
  server.send(200, "text/plain", "ESP32 ready");
}

void handleOn() {
  // toggle your gpio here
  digitalWrite(2, HIGH);
  server.send(200, "text/plain", "ON");
}

void handleOff() {
  digitalWrite(2, LOW);
  server.send(200, "text/plain", "OFF");
}

void setup(){
  pinMode(2, OUTPUT);
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(WiFi.localIP());

  server.on("/", handleRoot);
  server.on("/on", handleOn);
  server.on("/off", handleOff);
  server.begin();
}

void loop(){
  server.handleClient();
}
