import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, TextInput, Alert, FlatList, ActivityIndicator } from 'react-native';
import { getDeviceById, upsertDevice } from '../storage/devices';

function sanitizeHost(host) {
  if (!host) return '';
  // remove scheme and trailing slashes
  return host.replace(/^https?:\/\//i, '').replace(/\/+$/g, '');
}

function buildUrl(host, path) {
  const h = sanitizeHost(host);
  if (!h) return null;
  const p = (path || '').replace(/^\/+/, '');
  return p ? `http://${h}/${p}` : `http://${h}`;
}

async function sendCommand(host, path, timeout = 7000) {
  try {
    const url = buildUrl(host, path);
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const resp = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(id);
    const text = await resp.text();
    return { ok: resp.ok, status: resp.status, body: text };
  } catch (e) {
    const err = e.name === 'AbortError' ? 'timeout' : e.message;
    return { ok: false, error: err };
  }
}

export default function DeviceScreen({ route }) {
  const { deviceId } = route.params;
  const [device, setDevice] = useState(null);
  const [path, setPath] = useState('');
  const [log, setLog] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionName, setActionName] = useState('');
  const [actionPath, setActionPath] = useState('');

  useEffect(() => {
    (async () => {
      const d = await getDeviceById(deviceId);
      setDevice(d || null);
    })();
  }, [deviceId]);

  if (!device) return <View style={{flex:1,justifyContent:'center',alignItems:'center'}}><Text>Device not found</Text></View>;

  async function test() {
    setLog('Testing...');
    setLoading(true);
    const r = await sendCommand(device.host, '');
    setLoading(false);
    setLog(JSON.stringify(r, null, 2));
  }

  async function runEndpoint(endpoint) {
    setLog(`calling ${endpoint}...`);
    setLoading(true);
    const r = await sendCommand(device.host, endpoint);
    setLoading(false);
    setLog(JSON.stringify(r, null, 2));
    if (!r.ok) Alert.alert('Request failed', r.error || `status ${r.status}`);
  }

  async function addAction() {
    const name = actionName.trim();
    const p = actionPath.trim();
    if (!name || !p) return Alert.alert('Enter both name and path');
    const actions = device.actions ? [...device.actions, { id: Date.now().toString(), name, path: p }] : [{ id: Date.now().toString(), name, path: p }];
    const newDevice = { ...device, actions };
    await upsertDevice(newDevice);
    setDevice(newDevice);
    setActionName('');
    setActionPath('');
  }

  async function removeAction(id) {
    const actions = (device.actions || []).filter(a => a.id !== id);
    const newDevice = { ...device, actions };
    await upsertDevice(newDevice);
    setDevice(newDevice);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{device.name}</Text>
      <Text style={styles.subtitle}>{device.host}</Text>

      <TextInput placeholder="custom path (optional) e.g. gpio/2/1" value={path} onChangeText={setPath} style={styles.input} />

      <View style={styles.row}>
        <Button title="Test" onPress={test} disabled={loading} />
        <View style={{width:12}} />
        <Button title="On" onPress={() => runEndpoint(path.trim() || 'on')} disabled={loading} />
        <View style={{width:12}} />
        <Button title="Off" onPress={() => runEndpoint(path.trim() || 'off')} disabled={loading} />
      </View>

      {loading && (
        <View style={{marginTop:12}}>
          <ActivityIndicator size="small" />
        </View>
      )}

      <Text style={{marginTop:16,fontWeight:'600'}}>Friendly actions</Text>
      <FlatList data={device.actions || []} keyExtractor={i=>i.id} renderItem={({item})=> (
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:8}}>
          <Button title={item.name} onPress={()=> runEndpoint(item.path)} />
          <Button title="Del" color="#cc0000" onPress={()=> removeAction(item.id)} />
        </View>
      )} ListEmptyComponent={<Text style={{color:'#666',marginTop:8}}>No actions defined yet.</Text>} />

      <Text style={{marginTop:12,fontWeight:'600'}}>Add action</Text>
      <TextInput placeholder="Action name (e.g. Light On)" value={actionName} onChangeText={setActionName} style={styles.input} />
      <TextInput placeholder="Path (e.g. gpio/2/1 or on)" value={actionPath} onChangeText={setActionPath} style={styles.input} />
  <Button title="Add action" onPress={addAction} disabled={loading} />

      <Text style={styles.logTitle}>Last response</Text>
      <Text style={styles.log}>{log}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold' },
  subtitle: { color: '#555', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 8, marginVertical: 8, borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  logTitle: { marginTop: 16, fontWeight: '600' },
  log: { marginTop: 8, fontFamily: 'monospace' }
});
