import React, { useEffect, useState, useRef } from 'react';
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
  RefreshControl,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

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
import { 
  checkIfGifNeedsResize, 
  getOptimizationSuggestions,
  formatOptimizationInstructions 
} from '../utils/gifResizer';

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
  const [isPlayingGif, setIsPlayingGif] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  async function resizeImageMobile(uri, maxWidth, maxHeight) {
    if (!manipulateAsync) {
      throw new Error('Image manipulator is not available');
    }
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: maxWidth, height: maxHeight } }],
      { compress: 0.7, format: SaveFormat.JPEG, base64: true }
    );
    return result.base64;
  }

  async function sendSimpleImage() {
    try {
      setUploading(true);
      setLastResponse('Sending image data...');

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
      
      let base64;
      try {
        base64 = await resizeImageMobile(result.assets[0].uri, 320, 240);
      } catch (e) {
        console.log('Resize failed, falling back to original:', e);
        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();
        base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      let host = device.host.trim().replace(/^https?:\/\//i, '').replace(/\/+$/,'');
      
      // Optimal chunk size for ESP32 WebServer URL limit
      const chunkSize = 1500;
      const totalChunks = Math.ceil(base64.length / chunkSize);

      setLastResponse(`Sending ${totalChunks} chunks...`);

      for (let i = 0; i < totalChunks; i++) {
        const chunk = base64.substring(i * chunkSize, (i + 1) * chunkSize);
        const url = `http://${host}/imageChunk?index=${i}&total=${totalChunks}&data=${encodeURIComponent(chunk)}`;
        
        await fetch(url);
        setLastResponse(`Sent chunk ${i + 1}/${totalChunks}`);
      }

      await fetch(`http://${host}/displayImage`);
      setLastResponse('Image displayed!');
      setUploading(false);

    } catch (error) {
      console.error('Send error:', error);
      setLastResponse('Error: ' + error.message);
      setUploading(false);
    }
  }

  async function resizeGif(uri, targetSizeKB = 200) {
    // For GIFs, we can't directly resize them like images
    // But we can convert to lower quality or suggest optimization
    // This is a placeholder - actual GIF resizing requires server-side processing
    // For now, we'll just return the original URI and let the user know
    return uri;
  }

  async function sendGif() {
    try {
      setUploading(true);
      setLastResponse('Selecting GIF...');

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1.0,
      });

      if (result.canceled) {
        setUploading(false);
        return;
      }

      const uri = result.assets[0].uri;
      
      // Check if it's a GIF
      if (!uri.toLowerCase().endsWith('.gif')) {
        Alert.alert('Invalid File', 'Please select a GIF file');
        setUploading(false);
        return;
      }

      setLastResponse('Loading GIF file...');
      
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Check file size
      const fileSizeKB = Math.round(blob.size / 1024);
      
      // Check if GIF needs resizing
      const resizeCheck = await checkIfGifNeedsResize(uri, 320, 240);
      
      if (resizeCheck.needsResize) {
        const { currentSize, targetSize } = resizeCheck;
        const message = `GIF is ${currentSize.width}x${currentSize.height}\n` +
                       `Recommended: ${targetSize.width}x${targetSize.height}\n\n` +
                       `Large GIFs may play slowly. Optimize at ezgif.com for best results.`;
        
        Alert.alert('GIF Size Notice', message, [
          { text: 'OK, Continue', style: 'default' }
        ]);
      }
      
      let finalBlob = blob;
      let wasCompressed = false;
      
      // If file is too large, give user options
      if (blob.size > 150000) {
        // Show alert and wait for user decision
        const shouldContinue = await new Promise((resolve) => {
          Alert.alert(
            'GIF Too Large', 
            `This GIF is ${fileSizeKB}KB (limit: 150KB due to ESP32 memory).\n\nOptions:\n• Cancel and optimize at ezgif.com\n• Send anyway (may fail)`,
            [
              { 
                text: 'Cancel', 
                style: 'cancel', 
                onPress: () => resolve(false)
              },
              { 
                text: 'Send Anyway', 
                onPress: () => resolve(true)
              }
            ]
          );
        });
        
        if (!shouldContinue) {
          setUploading(false);
          setLastResponse('Upload cancelled');
          return;
        }
        
        setLastResponse(`Uploading large GIF (${fileSizeKB}KB)...`);
      } else {
        setLastResponse(`Loading GIF (${fileSizeKB}KB)...`);
      }
      
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(finalBlob);
      });

      let host = device.host.trim().replace(/^https?:\/\//i, '').replace(/\/+$/,'');
      
      // Send file size first so ESP32 can allocate the right amount
      const actualSize = blob.size;
      
      // With POST body, we can use much larger chunks (no URL limit)
      // 180KB GIF (240KB base64) with 8000 byte chunks = ~30 chunks
      // This is much faster than GET with URL params
      const chunkSize = 8000;
      const totalChunks = Math.ceil(base64.length / chunkSize);

      setLastResponse(`Uploading GIF (${fileSizeKB}KB): 0/${totalChunks} chunks...`);

      for (let i = 0; i < totalChunks; i++) {
        const chunk = base64.substring(i * chunkSize, (i + 1) * chunkSize);
        
        // Use POST with body instead of GET with URL params to avoid URL length limits
        const url = `http://${host}/gifChunk?index=${i}&total=${totalChunks}`;
        
        const chunkResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: chunk, // Send base64 data in body, not URL
        });
        
        if (!chunkResponse.ok) {
          const errorText = await chunkResponse.text();
          throw new Error(`Upload failed at chunk ${i + 1}: ${errorText}`);
        }
        
        // Update progress every 10 chunks or on last chunk
        if (i % 10 === 0 || i === totalChunks - 1) {
          setLastResponse(`Uploading: ${i + 1}/${totalChunks} chunks (${Math.round((i + 1) / totalChunks * 100)}%)`);
        }
      }

      setLastResponse('Starting GIF playback...');
      setIsPlayingGif(true);
      
      // Start GIF playback (non-blocking on ESP32)
      const playResponse = await fetch(`http://${host}/playGif`);
      const playText = await playResponse.text();
      
      setLastResponse(wasCompressed ? 'Compressed GIF playing!' : 'GIF is playing on device!');
      setUploading(false);

    } catch (error) {
      console.error('GIF send error:', error);
      setLastResponse('Error: ' + error.message);
      setUploading(false);
      setIsPlayingGif(false);
    }
  }

  async function stopGif() {
    try {
      let host = device.host.trim().replace(/^https?:\/\//i, '').replace(/\/+$/,'');
      await fetch(`http://${host}/stopGif`);
      setIsPlayingGif(false);
      setLastResponse('GIF stopped');
    } catch (error) {
      console.error('Stop GIF error:', error);
      setLastResponse('Error stopping GIF: ' + error.message);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      // Refresh all sensor data
      await Promise.all([
        fetchDHTData(),
        fetchPIRData()
      ]);
      setLastResponse('Data refreshed');
    } catch (error) {
      console.error('Refresh error:', error);
      setLastResponse('Refresh failed');
    } finally {
      setRefreshing(false);
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
        <ScrollView 
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#fff"
              colors={['#fff']}
              progressBackgroundColor="rgba(0, 0, 0, 0.5)"
            />
          }
        >
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
            <Text style={styles.cardTitle}>📸 Display Image</Text>
            <View style={styles.imageButtonContainer}>
              <TouchableOpacity 
                style={[styles.imageButton, uploading && styles.imageButtonDisabled]} 
                onPress={sendSimpleImage}
                disabled={uploading || isPlayingGif}
              >
                <Text style={styles.imageButtonIcon}>🖼️</Text>
                <Text style={styles.imageButtonText}>
                  {uploading ? 'Uploading...' : 'Pick & Send Image'}
                </Text>
              </TouchableOpacity>
            </View>
            {uploading && !isPlayingGif && (
              <ActivityIndicator size="small" color="#fff" style={{ marginTop: 10 }} />
            )}
          </View>

          {/* GIF Playback Section */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🎬 Play Animated GIF</Text>
            <Text style={styles.gifDescription}>
              Select a GIF file to play on the ESP32 display with smooth animation (10+ FPS)
            </Text>
            
            <View style={styles.gifButtonContainer}>
              <TouchableOpacity 
                style={[styles.gifButton, (uploading || isPlayingGif) && styles.imageButtonDisabled]}
                onPress={sendGif}
                disabled={uploading || isPlayingGif}
              >
                <Text style={styles.gifButtonIcon}>🎞️</Text>
                <Text style={styles.gifButtonText}>
                  {uploading ? 'Uploading GIF...' : 'Select GIF File'}
                </Text>
              </TouchableOpacity>
              
              {isPlayingGif && (
                <TouchableOpacity 
                  style={[styles.gifButton, styles.stopGifButton]}
                  onPress={stopGif}
                >
                  <Text style={styles.gifButtonIcon}>⏹</Text>
                  <Text style={styles.gifButtonText}>Stop GIF</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {isPlayingGif && (
              <View style={styles.gifStatusContainer}>
                <Text style={styles.gifStatusText}>▶️ GIF is playing on device...</Text>
              </View>
            )}
            
            <View style={styles.gifInfo}>
              <Text style={styles.gifInfoText}>• Optimized for 320x240 display</Text>
              <Text style={styles.gifInfoText}>• Smooth playback at 10+ FPS</Text>
              <Text style={styles.gifInfoText}>• Keep GIF files under 150KB (ESP32 memory limit)</Text>
            </View>
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
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 15 },
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
  gifDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginBottom: 15,
    lineHeight: 20,
  },
  gifButtonContainer: {
    marginTop: 10,
  },
  gifButton: {
    backgroundColor: 'rgba(255, 149, 0, 0.8)',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  stopGifButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
  },
  gifButtonIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  gifButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  gifStatusContainer: {
    backgroundColor: 'rgba(76, 217, 100, 0.2)',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  gifStatusText: {
    color: '#4CD964',
    fontSize: 14,
    fontWeight: '600',
  },
  gifInfo: {
    marginTop: 15,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
  },
  gifInfoText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginVertical: 2,
  },
});