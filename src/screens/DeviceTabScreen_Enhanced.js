import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ImageBackground,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
// Import manipulator only if available, with fallback
let manipulateAsync, SaveFormat;
try {
  const ImageManipulator = require('expo-image-manipulator');
  manipulateAsync = ImageManipulator.manipulateAsync;
  SaveFormat = ImageManipulator.SaveFormat;
} catch (e) {
  console.log('Image manipulator not available:', e);
}
import { getDeviceById } from '../storage/devices';
import { on } from '../utils/emitter';
import { initMQTT, subscribeToTopic, unsubscribeFromTopic } from '../api/mqtt';

const bgImage = require('../../imagee/SOLbg.jpg');
const logoImage = require('../../imagee/SOLlogo.png');

function ActionButton({ action, onPress }) {
  const isUri = typeof action.icon === 'string' && (action.icon.startsWith('http') || action.icon.startsWith('file') || action.icon.startsWith('data'));
  return (
    <TouchableOpacity style={[styles.actionButton, { backgroundColor: action.color || 'rgba(0, 122, 255, 0.8)' }]} onPress={() => onPress(action.path)}>
      {isUri ? (
        <Image source={{ uri: action.icon }} style={styles.actionIcon} />
      ) : (
        <Text style={styles.actionIconText}>{action.icon || '🔘'}</Text>
      )}
      <Text style={styles.actionButtonText}>{action.name}</Text>
    </TouchableOpacity>
  );
}

export default function DeviceTabScreen_Enhanced({ route }) {
  const deviceId = route?.params?.deviceId;
  const [device, setDevice] = useState(null);
  const [lastResponse, setLastResponse] = useState('');
  const [history, setHistory] = useState([]);
  const [ledStatus, setLedStatus] = useState('Unknown');
  const [temperature, setTemperature] = useState(null);
  const [humidity, setHumidity] = useState(null);
  const [motionStatus, setMotionStatus] = useState('unknown');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [lastMotionUpdate, setLastMotionUpdate] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!deviceId) return;

    const unsub = on('devices:changed', async () => {
      const d = await getDeviceById(deviceId);
      setDevice(d);
    });

    const topic = `iot-app/${deviceId}/status`;
    const handleMessage = (msgTopic, payload) => {
      if (msgTopic === topic && (payload === 'ON' || payload === 'OFF')) {
        setLedStatus(payload);
      }
    };

    initMQTT(handleMessage);
    subscribeToTopic(topic);

    return () => {
      if (typeof unsub === 'function') unsub();
      unsubscribeFromTopic(topic);
    };
  }, [deviceId]);

  useEffect(() => {
    if (deviceId) {
      getDeviceById(deviceId).then(setDevice);
    }
  }, [deviceId]);

  useEffect(() => {
    if (!device || !device.host) return;
    fetchDHTData();
    const interval = setInterval(() => {
      fetchDHTData();
    }, 5000);
    return () => clearInterval(interval);
  }, [device]);

  useEffect(() => {
    if (!device || !device.host) return;
    fetchPIRData();
    const interval = setInterval(() => {
      fetchPIRData();
    }, 2000);
    return () => clearInterval(interval);
  }, [device]);

  async function fetchDHTData() {
    if (!device || !device.host) return;
    try {
      let host = device.host.trim().replace(/^https?:\/\//i, '').replace(/\/+$/,'');
      const url = `http://${host}/dht`;
      const r = await fetch(url);
      const text = await r.text();
      
      const lines = text.split('\n');
      let temp = null;
      let hum = null;
      
      lines.forEach(line => {
        const parts = line.split(':');
        if (parts.length === 2) {
          const key = parts[0].trim().toLowerCase();
          const value = parseFloat(parts[1].trim());
          if (key === 'temperature') temp = value;
          if (key === 'humidity') hum = value;
        }
      });
      
      if (temp !== null && hum !== null) {
        setTemperature(temp);
        setHumidity(hum);
        setLastUpdate(Date.now());
        const entry = { ts: Date.now(), temperature: temp, humidity: hum };
        setHistory(h => [entry, ...h].slice(0, 60));
      }
    } catch (e) {
      console.log('DHT fetch error:', e.message);
    }
  }

  async function fetchPIRData() {
    if (!device || !device.host) return;
    try {
      let host = device.host.trim().replace(/^https?:\/\//i, '').replace(/\/+$/,'');
      const url = `http://${host}/pir`;
      const r = await fetch(url);
      const text = await r.text();
      
      const parts = text.trim().split(':');
      if (parts.length === 2 && parts[0].toLowerCase() === 'motion') {
        const status = parts[1].trim().toLowerCase();
        setMotionStatus(status);
        setLastMotionUpdate(Date.now());
      }
    } catch (e) {
      console.log('PIR fetch error:', e.message);
    }
  }

  async function callPath(path) {
    setLastResponse('Calling ' + path + '...');
    if (!device || !device.host) return setLastResponse('Error: device host not set');
    try {
      let host = device.host.trim().replace(/^https?:\/\//i, '').replace(/\/+$/,'');
      const p = String(path || '').trim().replace(/^\/+/,'');
      const url = `http://${host}/${encodeURI(p)}`;
      setLastResponse(`Calling: ${url}`);
      const r = await fetch(url);
      const text = await r.text();
      
      if (text.trim() === 'ON' || text.trim() === 'OFF') {
        setLedStatus(text.trim());
        setLastResponse('LED status updated.');
        return;
      }
      
      if (path === 'dht') {
        await fetchDHTData();
        setLastResponse('DHT data refreshed.');
        return;
      }
      
      if (path === 'pir') {
        await fetchPIRData();
        setLastResponse('PIR data refreshed.');
        return;
      }
      
      try {
        const j = JSON.parse(text);
        setLastResponse(JSON.stringify(j, null, 2));
      } catch (e) {
        setLastResponse(text || 'Received empty response.');
      }
    } catch (e) {
      setLastResponse('Error: ' + (e.message || e.toString()));
    }
  }

  // Convert image to RGB565 format for TFT display
  async function imageToRGB565(imageUri, width, height) {
    try {
      // Resize image to fit TFT screen (320x240 in landscape)
      const manipResult = await manipulateAsync(
        imageUri,
        [{ resize: { width, height } }],
        { compress: 1, format: SaveFormat.PNG, base64: true }
      );

      // Convert base64 to RGB565 array
      const base64Data = manipResult.base64;
      const response = await fetch(`data:image/png;base64,${base64Data}`);
      const blob = await response.blob();
      
      return manipResult.base64;
    } catch (error) {
      console.error('Image conversion error:', error);
      throw error;
    }
  }

  async function pickAndUploadImage() {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant photo library access');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled) return;

      setUploading(true);
      setLastResponse('Processing image...');

      // Resize to TFT dimensions (320x240)
      const resized = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 320, height: 240 } }],
        { compress: 0.8, format: SaveFormat.JPEG, base64: true }
      );

      setLastResponse('Uploading to ESP32...');

      // Send to ESP32
      let host = device.host.trim().replace(/^https?:\/\//i, '').replace(/\/+$/,'');
      const url = `http://${host}/uploadImage`;
      
      const formData = new FormData();
      formData.append('image', {
        uri: resized.uri,
        type: 'image/jpeg',
        name: 'display.jpg',
      });

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const text = await response.text();
      setLastResponse(text || 'Image uploaded successfully!');
      setUploading(false);

    } catch (error) {
      console.error('Upload error:', error);
      setLastResponse('Error: ' + error.message);
      setUploading(false);
    }
  }

  // Web-compatible image resizing using Canvas
  async function resizeImageWeb(uri, maxWidth, maxHeight) {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Calculate new dimensions maintaining aspect ratio
        const aspectRatio = width / height;
        const targetAspect = maxWidth / maxHeight;
        
        if (aspectRatio > targetAspect) {
          // Image is wider than target
          width = maxWidth;
          height = maxWidth / aspectRatio;
        } else {
          // Image is taller than target
          height = maxHeight;
          width = maxHeight * aspectRatio;
        }
        
        // Round to integers
        width = Math.round(width);
        height = Math.round(height);
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        // Use better image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 with good quality
        const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        resolve(base64);
      };
      
      img.onerror = reject;
      img.src = uri;
    });
  }

  async function sendSimpleImage() {
    try {
      setUploading(true);
      setLastResponse('Sending image data...');

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
      });

      if (result.canceled) {
        setUploading(false);
        return;
      }

      setLastResponse('Resizing image to fit display...');
      
      // Use web-compatible resizing - resize to TFT screen size (320x240)
      let base64;
      try {
        // Try web canvas method - fit to screen dimensions
        base64 = await resizeImageWeb(result.assets[0].uri, 320, 240);
      } catch (e) {
        // Fallback: try smaller size
        console.log('Resize failed, trying smaller:', e);
        try {
          base64 = await resizeImageWeb(result.assets[0].uri, 160, 120);
        } catch (e2) {
          console.log('Resize failed again, using original:', e2);
          const response = await fetch(result.assets[0].uri);
          const blob = await response.blob();
          base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(blob);
          });
        }
      }

      // Send base64 data to ESP32
      let host = device.host.trim().replace(/^https?:\/\//i, '').replace(/\/+$/,'');
      
      // Split base64 into chunks (ESP32 has limited memory)
      const chunkSize = 1000;
      const totalChunks = Math.ceil(base64.length / chunkSize);

      setLastResponse(`Sending ${totalChunks} chunks...`);

      for (let i = 0; i < totalChunks; i++) {
        const chunk = base64.substring(i * chunkSize, (i + 1) * chunkSize);
        const url = `http://${host}/imageChunk?index=${i}&total=${totalChunks}&data=${encodeURIComponent(chunk)}`;
        
        await fetch(url);
        setLastResponse(`Sent chunk ${i + 1}/${totalChunks}`);
      }

      // Tell ESP32 to display the image
      await fetch(`http://${host}/displayImage`);
      setLastResponse('Image displayed!');
      setUploading(false);

    } catch (error) {
      console.error('Send error:', error);
      setLastResponse('Error: ' + error.message);
      setUploading(false);
    }
  }

  if (!deviceId) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Missing device ID.</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <ImageBackground source={bgImage} style={styles.bgImage} blurRadius={5}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={bgImage} style={styles.bgImage} blurRadius={10}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <Image source={logoImage} style={styles.logo} />
            <View>
              <Text style={styles.title}>{device.name}</Text>
              <Text style={styles.subtitle}>{device.host}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Actions</Text>
            <FlatList
              data={device.actions || []}
              keyExtractor={i => i.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => <ActionButton action={item} onPress={callPath} />}
              ListEmptyComponent={<Text style={styles.emptyText}>No actions configured.</Text>}
            />
          </View>

          {/* Image Upload Section */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🖼️ Display Image</Text>
            <View style={styles.imageButtonContainer}>
              <TouchableOpacity 
                style={[styles.imageButton, uploading && styles.imageButtonDisabled]} 
                onPress={sendSimpleImage}
                disabled={uploading}
              >
                <Text style={styles.imageButtonIcon}>📸</Text>
                <Text style={styles.imageButtonText}>
                  {uploading ? 'Uploading...' : 'Pick & Send Image'}
                </Text>
              </TouchableOpacity>
            </View>
            {uploading && (
              <ActivityIndicator size="small" color="#fff" style={{ marginTop: 10 }} />
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Sensor Readings</Text>
              <TouchableOpacity onPress={() => { fetchDHTData(); fetchPIRData(); }} style={styles.refreshButton}>
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statusContainer}>
              {temperature !== null && (
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>🌡️ Temperature</Text>
                  <View style={styles.statusValueWrapper}>
                    <Text style={styles.statusValue}>{temperature.toFixed(1)}°C</Text>
                    {lastUpdate && (
                      <Text style={styles.statusTime}>{new Date(lastUpdate).toLocaleTimeString()}</Text>
                    )}
                  </View>
                </View>
              )}
              
              {humidity !== null && (
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>💧 Humidity</Text>
                  <View style={styles.statusValueWrapper}>
                    <Text style={styles.statusValue}>{humidity.toFixed(1)}%</Text>
                    {lastUpdate && (
                      <Text style={styles.statusTime}>{new Date(lastUpdate).toLocaleTimeString()}</Text>
                    )}
                  </View>
                </View>
              )}
              
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>🚶 Motion</Text>
                <View style={styles.statusValueWrapper}>
                  <View style={styles.motionIndicator}>
                    <View style={[
                      styles.motionDot, 
                      { backgroundColor: motionStatus === 'detected' ? '#ff4444' : '#28a745' }
                    ]} />
                    <Text style={[
                      styles.statusValue, 
                      { color: motionStatus === 'detected' ? '#ff4444' : '#28a745' }
                    ]}>
                      {motionStatus === 'detected' ? 'DETECTED' : motionStatus === 'none' ? 'Clear' : 'Unknown'}
                    </Text>
                  </View>
                  {lastMotionUpdate && (
                    <Text style={styles.statusTime}>{new Date(lastMotionUpdate).toLocaleTimeString()}</Text>
                  )}
                </View>
              </View>
              
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>💡 LED Status</Text>
                <View style={styles.statusValueWrapper}>
                  <Text style={[styles.statusValue, {color: ledStatus === 'ON' ? '#28a745' : '#dc3545'}]}>{ledStatus}</Text>
                </View>
              </View>
              
              {temperature === null && humidity === null && motionStatus === 'unknown' && (
                <Text style={styles.emptyText}>Waiting for sensor data...</Text>
              )}
            </View>
            
            {lastResponse && (
              <Text style={styles.responseText}>{lastResponse}</Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1 },
  safeArea: { flex: 1 },
  container: { padding: 20, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#ff4444', fontSize: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  logo: { width: 50, height: 50, marginRight: 15, borderRadius: 25 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  subtitle: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 14, marginTop: 2 },
  card: { backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: 20, padding: 20, marginBottom: 20, borderColor: 'rgba(255, 255, 255, 0.2)', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  emptyText: { color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, marginTop: 10, textAlign: 'center' },
  actionButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 15, marginRight: 10, alignItems: 'center', justifyContent: 'center', minWidth: 100 },
  actionIcon: { width: 24, height: 24, marginBottom: 5 },
  actionIconText: { fontSize: 24, marginBottom: 5, color: '#fff' },
  actionButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  refreshButton: { backgroundColor: 'rgba(0, 122, 255, 0.7)', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 10 },
  refreshButtonText: { color: '#fff', fontWeight: '600' },
  statusContainer: { backgroundColor: 'rgba(0, 0, 0, 0.2)', padding: 15, borderRadius: 15 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' },
  statusLabel: { fontSize: 18, fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)' },
  statusValueWrapper: { alignItems: 'flex-end' },
  statusValue: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  statusTime: { fontSize: 12, color: 'rgba(255, 255, 255, 0.5)', marginTop: 2 },
  motionIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  motionDot: { width: 12, height: 12, borderRadius: 6 },
  responseText: { color: '#aaa', fontSize: 12, marginTop: 15, textAlign: 'center' },
  imageButtonContainer: { marginTop: 10 },
  imageButton: {
    backgroundColor: 'rgba(138, 43, 226, 0.8)',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageButtonDisabled: {
    opacity: 0.5,
  },
  imageButtonIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  imageButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
