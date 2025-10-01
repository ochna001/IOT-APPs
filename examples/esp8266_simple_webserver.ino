/*
  ESP8266 simple web server example
  Compatible with the mobile app in this repo.
  - Responds to /, /on, /off
  - Use the device IP as the "host" in the mobile app

  Notes:
  - Install ESP8266 board support in Arduino IDE (Board Manager)
  - Choose your ESP8266 board (e.g., NodeMCU 1.0)
*/

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>

const char* ssid = "TP-Link_C404";
const char* password = "65907665";

ESP8266WebServer server(80);

void handleRoot() {
  server.send(200, "text/plain", "ESP8266 ready");
}

void handleOn() {
  digitalWrite(LED_BUILTIN, LOW); // built-in LED often inverted on ESP8266
  server.send(200, "text/plain", "ON");
}

void handleOff() {
  digitalWrite(LED_BUILTIN, HIGH);
  server.send(200, "text/plain", "OFF");
}

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH);
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();
  Serial.print("Connected, IP: ");
  Serial.println(WiFi.localIP());

  server.on("/", handleRoot);
  server.on("/on", handleOn);
  server.on("/off", handleOff);
  server.begin();
}

void loop() {
  server.handleClient();
}
