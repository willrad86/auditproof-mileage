import { supabase } from '../utils/supabaseClient';
import { Vehicle } from '../types';
import * as FileSystem from 'expo-file-system';
import { Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import { hashFile } from '../utils/cryptoUtils';

const PHOTOS_DIR = `${Paths.document.uri}photos/`;

async function ensurePhotosDirectory() {
  const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }
}

export async function getAllVehicles(): Promise<Vehicle[]> {
  try {
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected || !networkState.isInternetReachable) {
      return [];
    }

    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.log('Offline: returning empty vehicles array');
    return [];
  }
}

export async function getVehicleById(id: string): Promise<Vehicle | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createVehicle(vehicle: {
  make: string;
  model: string;
  year: number;
  license_plate: string;
}): Promise<Vehicle> {
  const monthYear = new Date().toISOString().slice(0, 7);

  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      ...vehicle,
      month_year: monthYear,
      verified: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateVehicle(
  id: string,
  updates: Partial<Vehicle>
): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteVehicle(id: string): Promise<void> {
  const { error } = await supabase.from('vehicles').delete().eq('id', id);

  if (error) throw error;
}

export async function saveOdometerPhoto(
  vehicleId: string,
  photoUri: string,
  type: 'start' | 'end'
): Promise<{ uri: string; hash: string }> {
  await ensurePhotosDirectory();

  const timestamp = Date.now();
  const fileName = `${vehicleId}_${type}_${timestamp}.jpg`;
  const destinationUri = `${PHOTOS_DIR}${fileName}`;

  await FileSystem.copyAsync({
    from: photoUri,
    to: destinationUri,
  });

  const base64 = await FileSystem.readAsStringAsync(destinationUri, {
    encoding: 'base64' as any,
  });

  const hash = await hashFile(base64);

  const monthYear = new Date().toISOString().slice(0, 7);

  const updateData: any = {
    month_year: monthYear,
    updated_at: new Date().toISOString(),
  };

  if (type === 'start') {
    updateData.photo_odometer_start = destinationUri;
    updateData.photo_odometer_start_hash = hash;
  } else {
    updateData.photo_odometer_end = destinationUri;
    updateData.photo_odometer_end_hash = hash;
  }

  try {
    const networkState = await Network.getNetworkStateAsync();
    if (networkState.isConnected && networkState.isInternetReachable) {
      await supabase.from('vehicles').update(updateData).eq('id', vehicleId);
    } else {
      console.log('Offline: Photo saved locally, will sync when online');
    }
  } catch (error) {
    console.log('Could not sync to database, photo saved locally:', error);
  }

  return { uri: destinationUri, hash };
}

export async function verifyVehicleForMonth(vehicleId: string): Promise<boolean> {
  const vehicle = await getVehicleById(vehicleId);
  if (!vehicle) return false;

  const currentMonthYear = new Date().toISOString().slice(0, 7);

  return (
    vehicle.month_year === currentMonthYear &&
    !!vehicle.photo_odometer_start &&
    !!vehicle.photo_odometer_start_hash
  );
}

export async function canStartTrip(vehicleId: string): Promise<{
  canStart: boolean;
  reason?: string;
}> {
  const vehicle = await getVehicleById(vehicleId);
  if (!vehicle) {
    return { canStart: false, reason: 'Vehicle not found' };
  }

  const isVerified = await verifyVehicleForMonth(vehicleId);
  if (!isVerified) {
    return {
      canStart: false,
      reason: 'Start odometer photo required for current month',
    };
  }

  return { canStart: true };
}

export async function getVehicleOdometerPhotos(vehicleId: string): Promise<{
  start?: string;
  end?: string;
  startHash?: string;
  endHash?: string;
}> {
  const vehicle = await getVehicleById(vehicleId);
  if (!vehicle) return {};

  return {
    start: vehicle.photo_odometer_start,
    end: vehicle.photo_odometer_end,
    startHash: vehicle.photo_odometer_start_hash,
    endHash: vehicle.photo_odometer_end_hash,
  };
}
