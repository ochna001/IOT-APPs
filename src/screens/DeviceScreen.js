import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { getDeviceById, upsertDevice } from '../storage/devices';

export default function DeviceScreen({ route }) {
  const { deviceId } = route.params;
  const [device, setDevice] = useState(null);
  const [localName, setLocalName] = useState('');

  useEffect(() => {
    (async () => {
      const d = await getDeviceById(deviceId);
      setDevice(d || { actions: [] });
      setLocalName(d?.name || '');
    })();
  }, [deviceId]);

  if (!device) return <View style={styles.center}><Text>Loading...</Text></View>;

  return (
    <View style={{padding:16}}>
      <Text style={{fontWeight:'600'}}>Device: {device.name}</Text>
      <Text style={{color:'#666',marginBottom:8}}>{device.host}</Text>
  <TextInput placeholder="Friendly name" value={localName} onChangeText={v => setLocalName(v)} style={styles.input} />
      <Button title="Save" onPress={async ()=>{ const nd = {...device, name: localName.trim()}; await upsertDevice(nd); Alert.alert('Saved'); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex:1, justifyContent:'center', alignItems:'center' },
  input: { borderWidth:1, borderColor:'#ddd', padding:8, borderRadius:6, marginBottom:8 }
});
