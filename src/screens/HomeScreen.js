import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, Alert, Modal, Linking } from 'react-native';
import { on } from '../utils/emitter';
import { v4 as uuidv4 } from 'uuid';
import { getDevices, removeDevice as rmDevice, upsertDevice } from '../storage/devices';

export default function HomeScreen({ navigation }) {
  const [devices, setDevices] = useState([]);
  const [ip, setIp] = useState('');
  const [name, setName] = useState('');
  const [showProvModal, setShowProvModal] = useState(false);
  const [provIp, setProvIp] = useState('');
  const [provName, setProvName] = useState('');

  useEffect(() => {
    load();
    const unsub = on('devices:changed', () => load());
    return unsub;
  }, []);

  async function load() {
    const list = await getDevices();
    setDevices(list);
  }

  async function addDevice() {
    const trimmed = ip.trim();
    if (!trimmed) return Alert.alert('Enter device IP or host');
    const devName = name.trim() || trimmed;
    const dev = { id: uuidv4(), name: devName, host: trimmed, actions: [] };
    await upsertDevice(dev);
    await load();
    setIp('');
    setName('');
  }

  async function removeDevice(id) {
    const newList = await rmDevice(id);
    setDevices(newList);
  }

  const renderHeader = () => (
    <View>
      <Text style={styles.title}>IoT Devices</Text>
      <View style={styles.row}>
        <TextInput
          placeholder="friendly name (optional)"
          value={name}
          onChangeText={setName}
          style={[styles.input,{marginRight:8}]}
        />
        <TextInput
          placeholder="device IP or host (e.g. 192.168.4.1)"
          value={ip}
          onChangeText={setIp}
          style={[styles.input,{flex:1,marginRight:8}]}
        />
        <Button title="Add" onPress={addDevice} />
        <View style={{width:8}} />
        <Button title="Provision" onPress={() => { setProvIp(''); setProvName(''); setShowProvModal(true); }} />
      </View>
    </View>
  );

  const renderItem = ({ item }) => (
    <View style={styles.deviceCard}>
      <View style={{flex:1}}>
        <Text style={styles.deviceText}>{item.name}</Text>
        <Text style={styles.deviceHost}>{item.host}</Text>
      </View>
      <View style={styles.deviceButtons}>
        <Button title="Setup" onPress={() => navigation.navigate('Setup', { deviceId: item.id })} />
        <View style={{width:8}} />
        <Button title="Open" onPress={() => navigation.navigate('DeviceTab', { deviceId: item.id })} />
        <View style={{width:8}} />
        <Button title="Del" color="#cc0000" onPress={() => removeDevice(item.id)} />
      </View>
    </View>
  );

  return (
    <>
      <FlatList
        data={devices}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={<Text style={{marginTop:20, paddingHorizontal:16}}>No devices added yet.</Text>}
        contentContainerStyle={devices.length === 0 ? styles.container : [styles.container, {paddingBottom:40}]}
      />

      <Modal visible={showProvModal} animationType="slide" onRequestClose={() => setShowProvModal(false)}>
        <View style={{flex:1,padding:16}}>
          <Text style={{fontSize:18,fontWeight:'700',marginBottom:12}}>Provision new device</Text>
          <Text style={{color:'#666',marginBottom:8}}>Power the device with the provisioning firmware. Connect your phone to the device AP (SSID like "ESP8266-Setup"), then open the provision page to submit Wi‑Fi credentials.</Text>
          <View style={{flexDirection:'row',marginBottom:12}}>
            <Button title="Open provision page" onPress={async ()=>{ try { await Linking.openURL('http://192.168.4.1'); } catch(e){ Alert.alert('Could not open browser', String(e)); } }} />
          </View>
          <Text style={{fontWeight:'600'}}>After provisioning, enter device details</Text>
          <TextInput placeholder="Device name" value={provName} onChangeText={setProvName} style={[styles.input,{marginTop:8}]} />
          <TextInput placeholder="Device IP" value={provIp} onChangeText={setProvIp} style={[styles.input,{marginTop:8}]} />
          <View style={{flexDirection:'row',marginTop:12}}>
            <Button title="Save" onPress={async ()=>{
              const trimmed = provIp.trim();
              if (!trimmed) return Alert.alert('Enter device IP');
              const dev = { id: uuidv4(), name: provName.trim() || trimmed, host: trimmed, actions: [] };
              await upsertDevice(dev);
              setShowProvModal(false);
            }} />
            <View style={{width:12}} />
            <Button title="Cancel" onPress={() => setShowProvModal(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 8, marginRight: 8, borderRadius: 4 },
  deviceCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 10, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 },
  deviceText: { fontSize: 18, fontWeight: '700' },
  deviceHost: { color: '#666', marginTop: 4 },
  deviceButtons: { flexDirection: 'row', alignItems: 'center' },
});
