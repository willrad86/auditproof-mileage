import * as FileSystem from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { sha256 } from 'js-sha256';
import { VehiclePhoto, MonthlyPhotoRecord } from '../types';

const db = SQLite.openDatabaseSync('auditproof.db');
const PHOTO_DIR = `${FileSystem.documentDirectory || ''}vehicle_photos/`;

export async function ensurePhotoDirectory(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  }
}

export function getCurrentMonthYear(): string {
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'long' });
  const year = now.getFullYear();
  return `${month} ${year}`;
}

export async function saveOdometerPhoto(
  vehicleId: string,
  photoType: 'start' | 'end',
  photoUri: string,
  monthYear?: string
): Promise<VehiclePhoto> {
  await ensurePhotoDirectory();

  const targetMonthYear = monthYear || getCurrentMonthYear();
  const timestamp = new Date().toISOString();
  const photoId = `photo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const extension = photoUri.split('.').pop() || 'jpg';
  const filename = `${vehicleId}_${photoType}_${targetMonthYear.replace(/\s/g, '_')}.${extension}`;
  const newUri = `${PHOTO_DIR}${filename}`;

  await FileSystem.copyAsync({
    from: photoUri,
    to: newUri,
  });

  const hash = sha256(newUri + timestamp);

  const existingRows = db.getAllSync(
    'SELECT id FROM vehicle_photos WHERE vehicle_id = ? AND month_year = ? AND photo_type = ?',
    [vehicleId, targetMonthYear, photoType]
  );

  if (existingRows.length > 0) {
    const existingId = (existingRows[0] as any).id;
    db.runSync(
      `UPDATE vehicle_photos SET photo_uri = ?, photo_hash = ?, timestamp = ? WHERE id = ?`,
      [newUri, hash, timestamp, existingId]
    );

    const updated = db.getAllSync('SELECT * FROM vehicle_photos WHERE id = ?', [existingId]);
    return mapRowToVehiclePhoto(updated[0]);
  }

  db.runSync(
    `INSERT INTO vehicle_photos (id, vehicle_id, month_year, photo_type, photo_uri, photo_hash, timestamp, synced_to_cloud, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [photoId, vehicleId, targetMonthYear, photoType, newUri, hash, timestamp, 0, timestamp]
  );

  return {
    id: photoId,
    vehicle_id: vehicleId,
    month_year: targetMonthYear,
    photo_type: photoType,
    photo_uri: newUri,
    photo_hash: hash,
    timestamp,
    synced_to_cloud: false,
    created_at: timestamp,
  };
}

export async function getMonthlyRecordsByVehicle(vehicleId: string): Promise<MonthlyPhotoRecord[]> {
  const rows = db.getAllSync(
    'SELECT DISTINCT month_year FROM vehicle_photos WHERE vehicle_id = ? ORDER BY month_year DESC',
    [vehicleId]
  );

  const records: MonthlyPhotoRecord[] = [];

  for (const row of rows) {
    const monthYear = (row as any).month_year;
    const photos = await getPhotosByVehicleAndMonth(vehicleId, monthYear);
    records.push({
      month_year: monthYear,
      start_photo: photos.start,
      end_photo: photos.end,
    });
  }

  return records;
}

export async function getPhotosByVehicleAndMonth(
  vehicleId: string,
  monthYear: string
): Promise<{ start?: VehiclePhoto; end?: VehiclePhoto }> {
  const rows = db.getAllSync(
    'SELECT * FROM vehicle_photos WHERE vehicle_id = ? AND month_year = ?',
    [vehicleId, monthYear]
  );

  const photos = rows.map(mapRowToVehiclePhoto);
  return {
    start: photos.find(p => p.photo_type === 'start'),
    end: photos.find(p => p.photo_type === 'end'),
  };
}

export async function checkMissingPhotos(vehicleId: string, monthYear: string): Promise<{
  needsStart: boolean;
  needsEnd: boolean;
}> {
  const photos = await getPhotosByVehicleAndMonth(vehicleId, monthYear);
  return {
    needsStart: !photos.start,
    needsEnd: !photos.end,
  };
}

function mapRowToVehiclePhoto(row: any): VehiclePhoto {
  return {
    id: row.id,
    vehicle_id: row.vehicle_id,
    month_year: row.month_year,
    photo_type: row.photo_type,
    photo_uri: row.photo_uri,
    photo_hash: row.photo_hash,
    timestamp: row.timestamp,
    synced_to_cloud: row.synced_to_cloud === 1,
    created_at: row.created_at,
  };
}
