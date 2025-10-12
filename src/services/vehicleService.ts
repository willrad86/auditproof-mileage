import { Vehicle } from '../types';
import * as FileSystem from 'expo-file-system';
import { Paths } from 'expo-file-system';
import { hashFile } from '../utils/cryptoUtils';
import {
  getAllVehiclesLocal,
  getVehicleByIdLocal,
  createVehicleLocal,
  updateVehicleLocal,
  deleteVehicleLocal,
} from './localVehicleDb';

const PHOTOS_DIR = `${Paths.document.uri}photos/`;

async function ensurePhotosDirectory() {
  const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }
}

export async function getAllVehicles(): Promise<Vehicle[]> {
  return getAllVehiclesLocal();
}

export async function getVehicleById(id: string): Promise<Vehicle | null> {
  return getVehicleByIdLocal(id);
}

export async function createVehicle(vehicle: {
  make: string;
  model: string;
  year: number;
  license_plate: string;
}): Promise<Vehicle> {
  const monthYear = new Date().toISOString().slice(0, 7);

  return createVehicleLocal({
    ...vehicle,
    month_year: monthYear,
    verified: false,
  });
}

export async function updateVehicle(
  id: string,
  updates: Partial<Vehicle>
): Promise<Vehicle> {
  return updateVehicleLocal(id, updates);
}

export async function deleteVehicle(id: string): Promise<void> {
  await deleteVehicleLocal(id);
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

  const updateData: Partial<Vehicle> = {
    month_year: monthYear,
  };

  if (type === 'start') {
    updateData.photo_odometer_start = destinationUri;
    updateData.photo_odometer_start_hash = hash;
  } else {
    updateData.photo_odometer_end = destinationUri;
    updateData.photo_odometer_end_hash = hash;
  }

  await updateVehicleLocal(vehicleId, updateData);

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
