import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, Button, StyleSheet, Alert, TouchableOpacity, Image, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getDeviceById, upsertDevice } from '../storage/devices';
import { on } from '../utils/emitter';

const COLORS = ['#0a84ff','#ff9500','#34c759','#ff3b30','#5856d6'];
const ICONS = [
  { id: 'light', emoji: '💡', label: 'Light' },
  { id: 'plug', emoji: '🔌', label: 'Plug' },
  { id: 'fire', emoji: '🔥', label: 'Heat' },
  { id: 'temp', emoji: '🌡️', label: 'Temperature' },
  { id: 'water', emoji: '💧', label: 'Water' },
  { id: 'fan', emoji: '🌀', label: 'Fan' },
  { id: 'sensor', emoji: '📟', label: 'Sensor' },
];

export default function SetupScreen({ route, navigation }) {
  const deviceId = route?.params?.deviceId;
  const [device, setDevice] = useState(null);
  const [actionName, setActionName] = useState('');
  const [actionPath, setActionPath] = useState('');
  const [actionColor, setActionColor] = useState(COLORS[0]);
  // actionIcon is always a string: either an emoji or a URI
  const [actionIcon, setActionIcon] = useState(ICONS[0].emoji);
  const [editingId, setEditingId] = useState(null);
  const [showProvModal, setShowProvModal] = useState(false);
  const [provIp, setProvIp] = useState('');

  useEffect(() => {
    if (!deviceId) return;
    loadDevice();
    // Listen for device changes from storage
    const unsub = on('devices:changed', () => {
      loadDevice();
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [deviceId]);

  async function loadDevice() {
    const d = await getDeviceById(deviceId);
    setDevice(d || { actions: [] });
  }

  function normalizePath(p) {
    if (!p) return '';
    // remove leading slashes and whitespace
    let s = p.trim().replace(/^\/+/, '');
    return s;
  }

  function validatePath(p) {
    const s = normalizePath(p);
    // allow letters, numbers, -._/ and query chars ?=&%
    const ok = /^[A-Za-z0-9._\-\/\?=&%]+$/.test(s);
    return { ok, normalized: s };
  }

  async function saveAction() {
    if (!actionName.trim() || !actionPath.trim()) return Alert.alert('Enter both name and path');
    const { ok, normalized } = validatePath(actionPath);
    if (!ok) return Alert.alert('Invalid path', 'Path contains invalid characters');
    const a = { id: editingId || Date.now().toString(), name: actionName.trim(), path: normalized, color: actionColor, icon: actionIcon };
    const actions = device.actions ? [...device.actions] : [];
    const idx = actions.findIndex(x=>x.id === a.id);
    if (idx >= 0) actions[idx] = a; else actions.push(a);
    const newDevice = { ...device, actions };
    await upsertDevice(newDevice);
    setDevice(newDevice);
    setActionName(''); setActionPath(''); setActionColor(COLORS[0]); setActionIcon(ICONS[0].emoji); setEditingId(null);
  }

  async function editAction(a) {
    setActionName(a.name);
    setActionPath(a.path);
    setActionColor(a.color || COLORS[0]);
    setActionIcon(a.icon || (ICONS[0] && ICONS[0].emoji));
    setEditingId(a.id);
  }

  async function deleteAction(id) {
    const actions = (device.actions||[]).filter(a=>a.id!==id);
    const newDevice = { ...device, actions };
    await upsertDevice(newDevice);
    setDevice(newDevice);
  }

  if (!deviceId) return (
    <View style={styles.center}><Text>Missing device id. Open Setup from a device entry.</Text></View>
  );
  if (!device) return <View style={styles.center}><Text>Loading...</Text></View>;

  return (
    <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Setup: {device.name}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Device</Text>
  <TextInput placeholder="Device name" value={device.name} onChangeText={v => setDevice({...device,name:v})} style={styles.input} />
  <TextInput placeholder="Host/IP" value={device.host} onChangeText={v => setDevice({...device,host:v})} style={styles.input} />
        <Button title="Save device" onPress={async ()=> { 
          await upsertDevice(device); 
          Alert.alert('Success', 'Device settings saved'); 
        }} />
      </View>

        

      <View style={styles.card}>
        <Text style={styles.label}>Add / Edit Action</Text>
  <TextInput placeholder="Action name (e.g. Light On)" value={actionName} onChangeText={v => setActionName(v)} style={styles.input} />
  <TextInput placeholder="Path (e.g. on or gpio/2/1). Example: 'on'" value={actionPath} onChangeText={v => setActionPath(v)} style={styles.input} />
        <Text style={{color:'#666',marginBottom:6}}>Path explanation: this is appended to the device host to form http://&lt;host&gt;/&lt;path&gt;. Examples below will prefill the field.</Text>
        <View style={{flexDirection:'row',marginBottom:8}}>
          <Button title="/on" onPress={()=> setActionPath('on')} />
          <View style={{width:8}} />
          <Button title="/off" onPress={()=> setActionPath('off')} />
          <View style={{width:8}} />
          <Button title="/sensor/temperature" onPress={()=> setActionPath('sensor/temperature')} />
        </View>

        <View style={{height:8}} />
        <Button title="Upload icon (PNG)" onPress={async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return Alert.alert('Permission required');
          const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
          if (!res.cancelled) {
            setActionIcon(res.uri);
          }
        }} />
        {typeof actionIcon === 'string' && (actionIcon.startsWith('http') || actionIcon.startsWith('file') || actionIcon.startsWith('data')) ? (
          <Image source={{ uri: actionIcon }} style={{ width: 48, height: 48, marginTop: 8, borderRadius: 6 }} />
        ) : null}

        <Text style={{fontWeight:'600',marginTop:6}}>Icon</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',marginTop:6,marginBottom:8}}>
          {ICONS.map(ic => (
            <TouchableOpacity key={ic.id} onPress={() => setActionIcon(ic.emoji)} style={[styles.iconPicker, actionIcon===ic.emoji && {borderWidth:2,borderColor:'#222'}]}>
              <Text style={{fontSize:20}}>{ic.emoji}</Text>
              <Text style={{fontSize:11,color:'#666'}}>{ic.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{fontWeight:'600'}}>Color</Text>
        <View style={{flexDirection:'row',marginTop:6}}>
          {COLORS.map(c => (
            <TouchableOpacity key={c} onPress={() => setActionColor(c)} style={[styles.colorSwatch, {backgroundColor:c}, actionColor===c && {borderWidth:2,borderColor:'#000'}]} />
          ))}
        </View>

        <View style={{height:12}} />
        <View style={{flexDirection:'row'}}>
          <Button title={editingId ? 'Save action' : 'Add action'} onPress={saveAction} />
          <View style={{width:12}} />
          <Button title="Test path" onPress={async ()=>{
            const v = validatePath(actionPath);
            if (!v.ok) return Alert.alert('Invalid path');
            if (!device || !device.host) return Alert.alert('Device host not set');
            try {
              let host = device.host.trim().replace(/^https?:\/\//i, '').replace(/\/+$/,'');
              const url = `http://${host}/${encodeURI(v.normalized)}`;
              const resp = await fetch(url);
              const text = await resp.text();
              Alert.alert('Test result', `URL: ${url}\nStatus: ${resp.status} ${resp.statusText || ''}\n\n${text.slice(0,1000)}`);
            } catch (e) {
              Alert.alert('Error', (e && e.message) || String(e));
            }
          }} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Actions</Text>
        {(device.actions || []).length === 0 ? (
          <Text style={{color:'#666'}}>No actions defined yet.</Text>
        ) : (
          (device.actions || []).map(item => (
            <View key={item.id} style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:8}}>
              <View style={{flexDirection:'row',alignItems:'center'}}>
                <Text style={{fontSize:22,marginRight:8}}>{typeof item.icon === 'string' && (item.icon.startsWith('http') || item.icon.startsWith('file') || item.icon.startsWith('data')) ? '🖼️' : (item.icon||'🔘')}</Text>
                <View>
                  <Text style={{fontWeight:'600'}}>{item.name}</Text>
                  <Text style={{color:'#666'}}>{item.path}</Text>
                </View>
              </View>
              <View style={{flexDirection:'row'}}>
                <Button title="Edit" onPress={() => editAction(item)} />
                <View style={{width:8}} />
                <Button title="Del" color="#cc0000" onPress={() => deleteAction(item.id)} />
              </View>
            </View>
          ))
        )}
      </View>

      <View style={{height:12}} />
      <Button title="Open Device Tab" onPress={() => navigation.navigate('DeviceTab', { deviceId })} />
      </ScrollView>
      <Modal visible={showProvModal} animationType="slide" onRequestClose={() => setShowProvModal(false)}>
        <KeyboardAvoidingView style={{flex:1,padding:16}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Text style={{fontSize:18,fontWeight:'700',marginBottom:12}}>Enter device IP</Text>
          <Text style={{color:'#666',marginBottom:8}}>Enter the IP address shown by the device after provisioning (for example 192.168.1.45). This will be saved as the device host.</Text>
          <TextInput placeholder="Device IP (e.g. 192.168.1.45)" value={provIp} onChangeText={setProvIp} style={{borderWidth:1,borderColor:'#ddd',padding:8,borderRadius:6,marginBottom:12}} />
          <View style={{flexDirection:'row'}}>
            <Button title="Save" onPress={async ()=>{
              const trimmed = provIp.trim();
              if (!trimmed) return Alert.alert('Enter IP');
              const newDevice = { ...device, host: trimmed };
              await upsertDevice(newDevice);
              setDevice(newDevice);
              setShowProvModal(false);
              Alert.alert('Saved');
            }} />
            <View style={{width:12}} />
            <Button title="Cancel" onPress={() => setShowProvModal(false)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  scroll: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 80, flexGrow: 1 },
  center: { flex:1, justifyContent:'center', alignItems:'center' },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 },
  label: { fontWeight: '600', marginBottom: 10, fontSize: 15 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 6, marginBottom: 10, fontSize: 14 },
  small: { color: '#666', fontSize: 13, marginBottom: 6 },
  iconPicker: { padding: 8, marginRight: 8, borderRadius: 6, borderWidth: 1, borderColor: '#ddd' },
  colorSwatch: { width: 32, height: 32, borderRadius: 6, marginRight: 8 }
});