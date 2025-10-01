import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Button, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { getDeviceById } from '../storage/devices';
import { Image } from 'react-native';
import { on } from '../utils/emitter';

function ActionButton({ action, onPress }) {
  const isUri = typeof action.icon === 'string' && (action.icon.startsWith('http') || action.icon.startsWith('file') || action.icon.startsWith('data'));
  return (
    <TouchableOpacity style={[styles.actionButton, { backgroundColor: action.color || '#0a84ff' }]} onPress={() => onPress(action.path)}>
      {isUri ? (
        <Image source={{ uri: action.icon }} style={styles.actionImage} />
      ) : (
        <Text style={styles.actionEmoji}>{action.icon || '🔘'}</Text>
      )}
      <Text style={styles.actionText}>{action.name}</Text>
    </TouchableOpacity>
  );
}

export default function DeviceTabScreen({ route }) {
  const { deviceId } = route.params;
  const [device, setDevice] = useState(null);
  const [lastResponse, setLastResponse] = useState('');
  const [history, setHistory] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(5000);

  useEffect(() => {
    (async () => {
      const d = await getDeviceById(deviceId);
      setDevice(d);
    })();
    const unsub = on('devices:changed', async () => {
      const d = await getDeviceById(deviceId);
      setDevice(d);
    });
    return unsub;
  }, [deviceId]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => {
      // try to refresh sensible path
      callPath('sensor/temperature');
    }, refreshIntervalMs);
    return () => clearInterval(t);
  }, [autoRefresh, refreshIntervalMs, device]);

  async function callPath(path) {
    setLastResponse('calling ' + path + '...');
    if (!device || !device.host) return setLastResponse('error: device host not set');
    try {
      // normalize host (remove trailing slashes, strip protocol if provided)
      let host = device.host.trim();
      // if user saved host including http(s)://, remove it for safe prefixing
      host = host.replace(/^https?:\/\//i, '').replace(/\/+$/,'');
      const p = String(path || '').trim().replace(/^\/+/, '');
      const encodedPath = encodeURI(p);
      const url = `http://${host}/${encodedPath}`;
      setLastResponse('calling url: ' + url);
      const r = await fetch(url);
      const text = await r.text();
      // try to parse JSON
      try {
        const j = JSON.parse(text);
        // if single reading
        if (j.temperature !== undefined) {
          const entry = { ts: Date.now(), temperature: j.temperature };
          setHistory(h => [entry, ...h].slice(0, 60));
        }
        setLastResponse(JSON.stringify(j, null, 2));
      } catch (e) {
        // handle simple ON/OFF text responses from simple firmware
        const t = text && text.toString();
        if (t === 'ON' || t === 'OFF') {
          setLastResponse('device: ' + t + ' (url: ' + url + ')');
        } else {
          setLastResponse(t || '');
        }
      }
    } catch (e) {
      setLastResponse('error: ' + (e.message || e.toString()));
    }
  }

  if (!device) return <View style={styles.center}><Text>Loading...</Text></View>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{device.name}</Text>
        <Text style={styles.subtitle}>{device.host}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Actions</Text>
        <FlatList data={device.actions||[]} keyExtractor={i=>i.id} horizontal renderItem={({item}) => (
          <ActionButton action={item} onPress={callPath} />
        )} ListEmptyComponent={<Text style={{color:'#666'}}>No actions yet</Text>} />
      </View>

      <View style={styles.card}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
          <Text style={styles.cardTitle}>Sensor / Status</Text>
          <View style={{flexDirection:'row',alignItems:'center'}}>
            <Button title={autoRefresh ? 'Auto ON' : 'Auto OFF'} onPress={() => setAutoRefresh(v => !v)} />
            <View style={{width:8}} />
            <Button title="Refresh" onPress={() => callPath('sensor/temperature')} />
          </View>
        </View>

        { /* If JSON contains temperature/humidity show cards */ }
        {history.length > 0 ? (
          <View style={{flexDirection:'row',marginTop:12}}>
            <View style={styles.sensorCard}>
              <Text style={{fontWeight:'600'}}>Temperature</Text>
              <Text style={{fontSize:18}}>{history[0].temperature} °C</Text>
              <Text style={{color:'#666',fontSize:12}}>{new Date(history[0].ts).toLocaleTimeString()}</Text>
            </View>
            {history[0].humidity !== undefined && (
              <View style={[styles.sensorCard,{marginLeft:12}]}> 
                <Text style={{fontWeight:'600'}}>Humidity</Text>
                <Text style={{fontSize:18}}>{history[0].humidity} %</Text>
                <Text style={{color:'#666',fontSize:12}}>{new Date(history[0].ts).toLocaleTimeString()}</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={{color:'#333',marginTop:8}}>{lastResponse || 'No recent reading'}</Text>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  center: { flex:1, justifyContent:'center', alignItems:'center' },
  header: { marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#666' },
  card: { backgroundColor:'#fff', padding:14, borderRadius:10, marginBottom:12, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:8 },
  cardTitle: { fontWeight:'600', marginBottom:8 },
  actionButton: { backgroundColor:'#0a84ff', paddingVertical:10, paddingHorizontal:16, borderRadius:10, marginRight:8, flexDirection:'row', alignItems:'center' },
  actionText: { color:'#fff', fontWeight:'600', marginLeft:8 },
  actionEmoji: { fontSize:18 },
  actionImage: { width:26, height:26, borderRadius:6 }
});
