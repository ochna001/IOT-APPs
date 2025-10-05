/*
  BH1750 Light Sensor for ESP32
  
  Connection:
    VCC -> 3V3
    GND -> GND
    SCL -> GPIO26
    SDA -> GPIO25
    ADD -> GND (for address 0x23) or VCC (for address 0x5C)
*/

#include <Wire.h>
#include <BH1750.h>

// Custom I2C pins for ESP32
#define I2C_SDA 25
#define I2C_SCL 26

// BH1750 I2C address (0x23 if ADD is GND, 0x5C if ADD is VCC)
BH1750 lightMeter(0x23);

void setup(){

  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n=== BH1750 Light Sensor Test ===");
  Serial.println("Initializing I2C...");

  // Initialize I2C with custom pins for ESP32
  Wire.begin(I2C_SDA, I2C_SCL);
  Serial.print("I2C initialized: SDA=GPIO");
  Serial.print(I2C_SDA);
  Serial.print(", SCL=GPIO");
  Serial.println(I2C_SCL);

  /*

    BH1750 has six different measurement modes. They are divided in two groups;
    continuous and one-time measurements. In continuous mode, sensor continuously
    measures lightness value. In one-time mode the sensor makes only one
    measurement and then goes into Power Down mode.

    Each mode, has three different precisions:

      - Low Resolution Mode - (4 lx precision, 16ms measurement time)
      - High Resolution Mode - (1 lx precision, 120ms measurement time)
      - High Resolution Mode 2 - (0.5 lx precision, 120ms measurement time)

    By default, the library uses Continuous High Resolution Mode, but you can
    set any other mode, by passing it to BH1750.begin() or BH1750.configure()
    functions.

    [!] Remember, if you use One-Time mode, your sensor will go to Power Down
    mode each time, when it completes a measurement and you've read it.

    Full mode list:

      BH1750_CONTINUOUS_LOW_RES_MODE
      BH1750_CONTINUOUS_HIGH_RES_MODE (default)
      BH1750_CONTINUOUS_HIGH_RES_MODE_2

      BH1750_ONE_TIME_LOW_RES_MODE
      BH1750_ONE_TIME_HIGH_RES_MODE
      BH1750_ONE_TIME_HIGH_RES_MODE_2

  */

  // Initialize BH1750 sensor
  Serial.println("Initializing BH1750 sensor...");
  
  if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    Serial.println("✓ BH1750 initialized successfully!");
    Serial.println("Reading light levels every second...\n");
  }
  else {
    Serial.println("✗ ERROR: BH1750 initialization failed!");
    Serial.println("Check:");
    Serial.println("  - Wiring (SDA=GPIO25, SCL=GPIO26)");
    Serial.println("  - Power (VCC to 3.3V, GND to GND)");
    Serial.println("  - I2C address (try 0x5C if 0x23 fails)");
  }

}


void loop() {

  float lux = lightMeter.readLightLevel();
  Serial.print("Light: ");
  Serial.print(lux);
  Serial.println(" lx");
  delay(1000);

}
