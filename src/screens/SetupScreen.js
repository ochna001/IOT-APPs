import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getDeviceById, upsertDevice } from '../storage/devices';
import { on } from '../utils/emitter';

const ICONS = ['💡', '🔌', '🔥', '🌡️', '💧', '🌀', '📟'];

const AppButton = ({ onPress, title, style, textStyle }) => (
  <TouchableOpacity onPress={onPress} style={[styles.appButtonContainer, style]}>
    <Text style={[styles.appButtonText, textStyle]}>{title}</Text>
  </TouchableOpacity>
);

export default function SetupScreen({ route }) {
  const deviceId = route?.params?.deviceId;

  const [device, setDevice] = useState(null);
  const [actionName, setActionName] = useState('');
  const [actionPath, setActionPath] = useState('');
  const [actionIcon, setActionIcon] = useState(ICONS[0]);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    if (deviceId) {
      loadDevice();
      const unsub = on('devices:changed', loadDevice);
      return () => unsub();
    }
  }, [deviceId]);

  const loadDevice = async () => {
    const d = await getDeviceById(deviceId);
    setDevice(d || { actions: [] });
  };

  const handleSaveDevice = async () => {
    if (device) {
      await upsertDevice(device);
      Alert.alert('Success', 'Device settings saved.');
    }
  };

  const handleSaveAction = async () => {
    if (!actionName.trim() || !actionPath.trim()) return Alert.alert('Action name and path are required.');
    const newAction = { id: editingId || Date.now().toString(), name: actionName.trim(), path: actionPath.trim(), icon: actionIcon };
    const updatedActions = [...(device.actions || [])];
    const index = updatedActions.findIndex(a => a.id === newAction.id);
    if (index >= 0) updatedActions[index] = newAction; else updatedActions.push(newAction);
    await upsertDevice({ ...device, actions: updatedActions });
    resetActionForm();
  };

  const editAction = (action) => {
    setEditingId(action.id);
    setActionName(action.name);
    setActionPath(action.path);
    setActionIcon(action.icon || ICONS[0]);
  };

  const deleteAction = async (id) => {
    const updatedActions = (device.actions || []).filter(a => a.id !== id);
    await upsertDevice({ ...device, actions: updatedActions });
  };

  const resetActionForm = () => {
    setEditingId(null);
    setActionName('');
    setActionPath('');
    setActionIcon(ICONS[0]);
  };

  if (!deviceId) {
    return <View style={styles.center}><Text style={styles.errorText}>No device ID provided.</Text></View>;
  }

  if (!device) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#fff" /></View>;
  }

  return (
    <ImageBackground 
      source={device.bgImage ? { uri: device.bgImage } : null} 
      style={{ flex: 1, backgroundColor: '#334' }}
      imageStyle={{ opacity: 0.4 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              {device.logo ? <Image source={{uri: device.logo}} style={styles.logo} /> : <View style={[styles.logo, {backgroundColor: '#556'}]} />}
              <Text style={styles.title}>Setup: {device.name}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Device Customization</Text>
              <AppButton title="Change Background" onPress={() => Alert.alert("Placeholder", "This will open an image picker.")} style={styles.placeholderButton} />
              <AppButton title="Change Logo" onPress={() => Alert.alert("Placeholder", "This will open an image picker.")} style={styles.placeholderButton} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Device Details</Text>
              <TextInput placeholder="Device Name" value={device.name} onChangeText={name => setDevice({ ...device, name })} style={styles.input} placeholderTextColor="#999" />
              <TextInput placeholder="Host/IP" value={device.host} onChangeText={host => setDevice({ ...device, host })} style={styles.input} placeholderTextColor="#999" />
              <AppButton title="Save Device" onPress={handleSaveDevice} style={styles.saveButton} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{editingId ? 'Edit Action' : 'Add New Action'}</Text>
              <TextInput placeholder="Action Name" value={actionName} onChangeText={setActionName} style={styles.input} placeholderTextColor="#999" />
              <TextInput placeholder="Action Path" value={actionPath} onChangeText={setActionPath} style={styles.input} placeholderTextColor="#999" />
              <Text style={styles.smallText}>Path is appended to host. e.g., /on, /off</Text>
              <View style={styles.pathButtonsContainer}>
                <AppButton title="/on" onPress={() => setActionPath('on')} style={styles.pathButton} textStyle={styles.pathButtonText} />
                <AppButton title="/off" onPress={() => setActionPath('off')} style={styles.pathButton} textStyle={styles.pathButtonText} />
              </View>
              <Text style={styles.cardTitle}>Icon</Text>
              <View style={styles.iconContainer}>
                {ICONS.map(icon => (
                  <TouchableOpacity key={icon} onPress={() => setActionIcon(icon)} style={[styles.iconWrapper, actionIcon === icon && styles.iconSelected]}>
                    <Text style={styles.icon}>{icon}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <AppButton title="Upload Icon (PNG)" onPress={() => {}} style={styles.placeholderButton} />
              <AppButton title={editingId ? 'Save Action' : 'Add Action'} onPress={handleSaveAction} style={styles.saveButton} />
              {editingId && <AppButton title="Cancel Edit" onPress={resetActionForm} style={styles.cancelButton} />}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Actions</Text>
              {device.actions?.length > 0 ? (
                device.actions.map(item => (
                  <View key={item.id} style={styles.actionItem}>
                    <Text style={styles.actionIcon}>{item.icon || '🔘'}</Text>
                    <Text style={styles.actionText}>{item.name} ({item.path})</Text>
                    <View style={{flexDirection: 'row'}}>
                      <AppButton title="Edit" onPress={() => editAction(item)} style={styles.editButton} />
                      <AppButton title="Del" onPress={() => deleteAction(item.id)} style={styles.deleteButton} />
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.errorText}>No actions configured.</Text>
              )}
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 20, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#334' },
  errorText: { color: '#aaa', fontStyle: 'italic' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  logo: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  card: { backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: 20, padding: 20, marginBottom: 20, borderColor: 'rgba(255, 255, 255, 0.2)', borderWidth: 1 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 15 },
  input: { backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: 10, padding: 15, color: '#fff', fontSize: 16, marginBottom: 15 },
  appButtonContainer: { borderRadius: 10, paddingVertical: 15, paddingHorizontal: 12 },
  appButtonText: { fontSize: 16, color: "#fff", fontWeight: "bold", alignSelf: "center" },
  placeholderButton: { backgroundColor: 'rgba(255, 255, 255, 0.2)', marginBottom: 10 },
  saveButton: { backgroundColor: '#007bff', marginTop: 10 },
  cancelButton: { backgroundColor: 'rgba(255, 255, 255, 0.2)', marginTop: 10 },
  actionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' },
  actionText: { color: '#fff', fontSize: 16, flex: 1, marginLeft: 10 },
  actionIcon: { fontSize: 20 },
  editButton: { backgroundColor: '#ffc107', paddingVertical: 8, paddingHorizontal: 10, marginRight: 5 },
  deleteButton: { backgroundColor: '#dc3545', paddingVertical: 8, paddingHorizontal: 10, marginLeft: 5 },
  smallText: { color: '#aaa', fontSize: 12, marginBottom: 10 },
  pathButtonsContainer: { flexDirection: 'row', marginBottom: 15 },
  pathButton: { backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingVertical: 8, paddingHorizontal: 12, marginRight: 10 },
  pathButtonText: { fontSize: 14, fontWeight: 'normal' },
  iconContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 },
  iconWrapper: { padding: 10, borderRadius: 10, margin: 5, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  iconSelected: { backgroundColor: '#007bff' },
  icon: { fontSize: 24 },
});