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
} from 'react-native';
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

export default function DeviceTabScreen({ route }) {
  const deviceId = route?.params?.deviceId;
  const [device, setDevice] = useState(null);
  const [lastResponse, setLastResponse] = useState('');
  const [history, setHistory] = useState([]);
  const [ledStatus, setLedStatus] = useState('Unknown');

    useEffect(() => {
    if (!deviceId) return;

    // Listener for local device data changes (e.g., from SetupScreen)
    const unsub = on('devices:changed', async () => {
      const d = await getDeviceById(deviceId);
      setDevice(d);
    });

    // MQTT setup for real-time status updates
    const topic = `iot-app/${deviceId}/status`;
    const handleMessage = (msgTopic, payload) => {
      if (msgTopic === topic && (payload === 'ON' || payload === 'OFF')) {
        setLedStatus(payload);
      }
    };

    initMQTT(handleMessage);
    subscribeToTopic(topic);

    // Cleanup function
    return () => {
      if (typeof unsub === 'function') unsub();
      unsubscribeFromTopic(topic);
    };
  }, [deviceId]);

  // Effect to load initial device data
  useEffect(() => {
    if (deviceId) {
      getDeviceById(deviceId).then(setDevice);
    }
  }, [deviceId]);

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
      // Handle plain text ON/OFF for LED status
      if (text.trim() === 'ON' || text.trim() === 'OFF') {
        setLedStatus(text.trim());
        setLastResponse('LED status updated.');
        return;
      }
      // Try to parse JSON for sensor readings
      try {
        const j = JSON.parse(text);
        if (j.temperature !== undefined) {
          const entry = { ts: Date.now(), temperature: j.temperature, humidity: j.humidity };
          setHistory(h => [entry, ...h].slice(0, 60));
        }
        setLastResponse(JSON.stringify(j, null, 2));
      } catch (e) {
        setLastResponse(text || 'Received empty response.');
      }
    } catch (e) {
      setLastResponse('Error: ' + (e.message || e.toString()));
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

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Sensor / Status</Text>
              <TouchableOpacity onPress={() => callPath('status')} style={styles.refreshButton}>
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>

                        <View style={styles.statusContainer}>
              {history.length > 0 && (
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Temperature</Text>
                  <View style={styles.statusValueWrapper}>
                    <Text style={styles.statusValue}>{history[0].temperature}°C</Text>
                    <Text style={styles.statusTime}>{new Date(history[0].ts).toLocaleTimeString()}</Text>
                  </View>
                </View>
              )}
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>LED Status</Text>
                <View style={styles.statusValueWrapper}>
                  <Text style={[styles.statusValue, {color: ledStatus === 'ON' ? '#28a745' : '#dc3545'}]}>{ledStatus}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.responseText}>{lastResponse}</Text>
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
  emptyText: { color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, marginTop: 10 },
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
  statusValue: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  statusTime: { fontSize: 12, color: 'rgba(255, 255, 255, 0.5)', marginTop: 2 },
  responseText: { color: '#aaa', fontSize: 12, marginTop: 15, textAlign: 'center' },
});