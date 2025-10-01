import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
  Linking,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { on } from '../utils/emitter';
import { v4 as uuidv4 } from 'uuid';
import { getDevices, removeDevice as rmDevice, upsertDevice } from '../storage/devices';

const AppButton = ({ onPress, title, style, textStyle }) => (
  <TouchableOpacity onPress={onPress} style={[styles.appButtonContainer, style]}>
    <Text style={[styles.appButtonText, textStyle]}>{title}</Text>
  </TouchableOpacity>
);

export default function HomeScreen({ navigation }) {
  const [devices, setDevices] = useState([]);
  const [ip, setIp] = useState('');
  const [name, setName] = useState('');
  const [showProvModal, setShowProvModal] = useState(false);
  const [provIp, setProvIp] = useState('');
  const [provName, setProvName] = useState('');

  useEffect(() => {
    load();
    const unsub = on('devices:changed', load);
    return () => unsub();
  }, []);

  async function load() {
    const list = await getDevices();
    setDevices(list);
  }

  async function addDevice() {
    const trimmedIp = ip.trim();
    if (!trimmedIp) return Alert.alert('IP address is required');
    const devName = name.trim() || trimmedIp;
    const newDevice = { id: uuidv4(), name: devName, host: trimmedIp, actions: [] };
    await upsertDevice(newDevice);
    setDevices(prev => [newDevice, ...prev]);
    setIp('');
    setName('');
  }

  async function removeDevice(id) {
    await rmDevice(id);
    setDevices(prev => prev.filter(d => d.id !== id));
  }

  const renderItem = ({ item }) => (
    <View style={styles.deviceCard}>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceText}>{item.name}</Text>
        <Text style={styles.deviceHost}>{item.host}</Text>
      </View>
      <View style={styles.deviceButtons}>
        <AppButton title="Setup" onPress={() => navigation.navigate('Setup', { deviceId: item.id })} style={styles.setupButton} textStyle={styles.setupButtonText} />
        <AppButton title="Open" onPress={() => navigation.navigate('DeviceTab', { deviceId: item.id })} style={styles.openButton} />
        <AppButton title="Del" onPress={() => removeDevice(item.id)} style={styles.deleteButton} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>IoT Dashboard</Text>

        <View style={styles.addDeviceCard}>
          <Text style={styles.cardTitle}>Add a New Device</Text>
          <TextInput
            placeholder="Device Name (optional)"
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholderTextColor="#999"
          />
          <TextInput
            placeholder="Device IP or Host"
            value={ip}
            onChangeText={setIp}
            style={styles.input}
            placeholderTextColor="#999"
          />
          <View style={styles.addButtonsContainer}>
            <AppButton title="Add Manually" onPress={addDevice} style={styles.addButton} />
            <AppButton title="Provision" onPress={() => setShowProvModal(true)} style={styles.provisionButton} />
          </View>
        </View>

        <FlatList
          data={devices}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ListHeaderComponent={<Text style={styles.listHeader}>My Devices</Text>}
          ListEmptyComponent={<Text style={styles.emptyText}>No devices yet. Add one above!</Text>}
          contentContainerStyle={{ paddingBottom: 40 }}
        />

        <Modal visible={showProvModal} animationType="slide" onRequestClose={() => setShowProvModal(false)}>
          {/* Provisioning Modal UI can also be improved later */}
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1a1a2e' },
  container: { flex: 1, padding: 20 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 20, textAlign: 'center' },
  addDeviceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 30,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 15 },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
  },
  addButtonsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  listHeader: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 15 },
  deviceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceInfo: { flex: 1 },
  deviceText: { fontSize: 18, fontWeight: '600', color: '#fff' },
  deviceHost: { color: 'rgba(255, 255, 255, 0.7)', marginTop: 5 },
  deviceButtons: { flexDirection: 'row' },
  emptyText: { color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center', marginTop: 20 },
  appButtonContainer: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginLeft: 8,
  },
  appButtonText: { fontSize: 14, color: "#fff", fontWeight: "bold", alignSelf: "center" },
  addButton: { backgroundColor: '#007bff', flex: 1, marginRight: 5 },
  provisionButton: { backgroundColor: '#28a745', flex: 1, marginLeft: 5 },
  setupButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#007bff' },
  setupButtonText: { color: '#007bff' },
  openButton: { backgroundColor: '#007bff' },
  deleteButton: { backgroundColor: '#dc3545' },
});