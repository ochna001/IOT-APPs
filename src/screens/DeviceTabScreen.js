import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Button, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { getDeviceById } from '../storage/devices';
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
  const deviceId = route?.params?.deviceId;
  const [device, setDevice] = useState(null);
  const [lastResponse, setLastResponse] = useState('');
  const [history, setHistory] = useState([]);
  useEffect(() => {
    if (!deviceId) return;
    (async () => {
      const d = await getDeviceById(deviceId);
      setDevice(d);
    })();
    const unsub = on('devices:changed', async () => {
      const d = await getDeviceById(deviceId);
      setDevice(d);
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [deviceId]);

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

  if (!deviceId) return <View style={styles.center}><Text>Missing device id. Open Device from the list.</Text></View>;
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
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <Text style={styles.cardTitle}>Sensor / Status</Text>
          <Button title="Refresh" onPress={() => callPath('sensor/temperature')} />
        </View>

        { /* If JSON contains temperature/humidity show cards */ }
        {history.length > 0 ? (
          <View style={{flexDirection:'row',marginTop:12}}>
            <View style={styles.sensorCard}>
              <Text style={{fontWeight:'600',fontSize:14}}>Temperature</Text>
              <Text style={{fontSize:20,fontWeight:'700',marginTop:4}}>{history[0].temperature} °C</Text>
              <Text style={{color:'#666',fontSize:12,marginTop:4}}>{new Date(history[0].ts).toLocaleTimeString()}</Text>
            </View>
            {history[0].humidity !== undefined && (
              <View style={[styles.sensorCard,{marginLeft:12}]}> 
                <Text style={{fontWeight:'600',fontSize:14}}>Humidity</Text>
                <Text style={{fontSize:20,fontWeight:'700',marginTop:4}}>{history[0].humidity} %</Text>
                <Text style={{color:'#666',fontSize:12,marginTop:4}}>{new Date(history[0].ts).toLocaleTimeString()}</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={{color:'#333',marginTop:8,fontSize:14}}>{lastResponse || 'No recent reading'}</Text>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  center: { flex:1, justifyContent:'center', alignItems:'center' },
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#666', fontSize: 13, marginTop: 4 },
  card: { backgroundColor:'#fff', padding:16, borderRadius:10, marginBottom:12, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:8 },
  cardTitle: { fontWeight:'600', marginBottom:10, fontSize: 15 },
  actionButton: { backgroundColor:'#0a84ff', paddingVertical:12, paddingHorizontal:16, borderRadius:10, marginRight:8, flexDirection:'row', alignItems:'center' },
  actionText: { color:'#fff', fontWeight:'600', marginLeft:8, fontSize: 14 },
  actionEmoji: { fontSize:20 },
  actionImage: { width:28, height:28, borderRadius:6 },
  sensorCard: { flex:1, backgroundColor:'#f5f5f5', padding:12, borderRadius:8 }
});