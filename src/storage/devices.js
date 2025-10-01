import AsyncStorage from '@react-native-async-storage/async-storage';
import { emit } from '../utils/emitter';

const STORAGE_KEY = 'iot_devices_v1';

export async function getDevices() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('getDevices', e);
    return [];
  }
}

export async function saveDevices(devices) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
    emit('devices:changed', devices);
  } catch (e) {
    console.warn('saveDevices', e);
  }
}

export async function getDeviceById(id) {
  const devices = await getDevices();
  return devices.find(d => d.id === id);
}

export async function upsertDevice(device) {
  const devices = await getDevices();
  const idx = devices.findIndex(d => d.id === device.id);
  if (idx >= 0) devices[idx] = device;
  else devices.unshift(device);
  await saveDevices(devices);
  emit('devices:changed', devices);
  return devices;
}

export async function removeDevice(id) {
  const devices = await getDevices();
  const filtered = devices.filter(d => d.id !== id);
  await saveDevices(filtered);
  emit('devices:changed', filtered);
  return filtered;
}
