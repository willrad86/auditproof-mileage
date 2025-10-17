import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { VehiclePhoto, MonthlyPhotoRecord } from '../types';
import { initDatabase } from './simpleVehicleService';

/**
 * Saves an odometer photo (start or end) for a given vehicle and month.
 * Creates or replaces the record if it already exists.
 */
export async function saveOdometerPhoto(
  vehicle_id: string,
  photo_type: 'start' | 'end',
  photo_uri: string,
  month_year?: string
): Promise<VehiclePhoto> {
  try {
    const db = await initDatabase();
    const id = Crypto.randomUUID();
    const now = new Date().toISOString();
    const month = month_year || getCurrentMonthYear();

    db.runSync(
      `
      INSERT OR REPLACE INTO vehicle_photos (
        id, vehicle_id, month_year, photo_type,
        photo_uri, photo_hash, timestamp, synced_to_cloud, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        vehicle_id,
        month,
        photo_type,
        photo_uri,
        null, // hash not computed yet
        now,
        0, // synced_to_cloud = false
        now,
      ]
    );

    console.log(`✅ Saved ${photo_type} photo for vehicle ${vehicle_id} (${month})`);

    const newPhoto: VehiclePhoto = {
      id,
      vehicle_id,
      month_year: month,
      photo_type,
      photo_uri,
      photo_hash: null,
      timestamp: now,
      synced_to_cloud: false,
      created_at: now,
    };

    return newPhoto;
  } catch (error) {
    console.error('❌ Error saving odometer photo:', error);
    throw error;
  }
}

/**
 * Retrieves all photo records for a given vehicle, grouped by month.
 */
export async function getMonthlyRecordsByVehicle(
  vehicle_id: string
): Promise<MonthlyPhotoRecord[]> {
  try {
    const db = await initDatabase();
    const rows = db.getAllSync(
      'SELECT * FROM vehicle_photos WHERE vehicle_id = ? ORDER BY month_year DESC',
      [vehicle_id]
    );

    const grouped: Record<string, MonthlyPhotoRecord> = {};

    for (const row of rows) {
      const month = row.month_year || 'Unknown';
      if (!grouped[month]) {
        grouped[month] = { month_year: month, start_photo: null, end_photo: null };
      }

      const photo: VehiclePhoto = {
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

      if (row.photo_type === 'start') grouped[month].start_photo = photo;
      else if (row.photo_type === 'end') grouped[month].end_photo = photo;
    }

    const result = Object.values(grouped);
    return result;
  } catch (error) {
    console.error('❌ Error fetching monthly photo records:', error);
    return [];
  }
}

/**
 * Fetches all photos for a specific month and vehicle.
 */
export async function getPhotosForMonth(
  vehicle_id: string,
  month_year: string
): Promise<VehiclePhoto[]> {
  try {
    const db = await initDatabase();
    const rows = db.getAllSync(
      'SELECT * FROM vehicle_photos WHERE vehicle_id = ? AND month_year = ? ORDER BY timestamp DESC',
      [vehicle_id, month_year]
    );

    return rows.map((r: any) => ({
      id: r.id,
      vehicle_id: r.vehicle_id,
      month_year: r.month_year,
      photo_type: r.photo_type,
      photo_uri: r.photo_uri,
      photo_hash: r.photo_hash,
      timestamp: r.timestamp,
      synced_to_cloud: r.synced_to_cloud === 1,
      created_at: r.created_at,
    }));
  } catch (error) {
    console.error('❌ Error fetching photos for month:', error);
    return [];
  }
}

/**
 * Deletes a photo record by ID.
 */
export async function deleteOdometerPhoto(photo_id: string): Promise<void> {
  try {
    const db = await initDatabase();
    db.runSync('DELETE FROM vehicle_photos WHERE id = ?', [photo_id]);
    console.log('🗑️  Deleted photo', photo_id);
  } catch (error) {
    console.error('❌ Error deleting photo:', error);
  }
}

/**
 * Returns current month-year string like "2025-10"
 * (fallback if dateUtils is missing).
 */
export function getCurrentMonthYear(): string {
  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}
