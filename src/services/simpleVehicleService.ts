import * as SQLite from 'expo-sqlite';
import { Vehicle } from '../types';

const db = SQLite.openDatabaseSync('auditproof.db');

// Initialize database
db.execSync(`
  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    license_plate TEXT NOT NULL,
    photo_odometer_start TEXT,
    photo_odometer_start_hash TEXT,
    photo_odometer_end TEXT,
    photo_odometer_end_hash TEXT,
    month_year TEXT NOT NULL,
    verified INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

db.execSync(`
  CREATE TABLE IF NOT EXISTS vehicle_photos (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    month_year TEXT NOT NULL,
    photo_type TEXT NOT NULL,
    photo_uri TEXT NOT NULL,
    photo_hash TEXT,
    timestamp TEXT NOT NULL,
    synced_to_cloud INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
  );
`);

export async function getVehicles(): Promise<Vehicle[]> {
  const rows = db.getAllSync('SELECT * FROM vehicles ORDER BY created_at DESC');
  return rows.map((row: any) => ({
    id: row.id,
    make: row.make,
    model: row.model,
    year: row.year,
    license_plate: row.license_plate,
    photo_odometer_start: row.photo_odometer_start,
    photo_odometer_start_hash: row.photo_odometer_start_hash,
    photo_odometer_end: row.photo_odometer_end,
    photo_odometer_end_hash: row.photo_odometer_end_hash,
    month_year: row.month_year,
    verified: row.verified === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function addVehicle(
  make: string,
  model?: string,
  year?: number,
  license_plate?: string
): Promise<Vehicle> {
  const id = `vehicle_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const now = new Date().toISOString();
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

  try {
    db.runSync(
      `INSERT INTO vehicles (id, make, model, year, license_plate, month_year, verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        make,
        model || '',
        year || new Date().getFullYear(),
        license_plate || '',
        currentMonth,
        0,
        now,
        now,
      ]
    );

    const vehicle = await getVehicleById(id);
    if (!vehicle) {
      throw new Error('Failed to create vehicle - could not retrieve after insert');
    }
    return vehicle;
  } catch (error) {
    console.error('Error in addVehicle:', error);
    throw error;
  }
}

export async function getVehicleById(vehicleId: string): Promise<Vehicle | null> {
  const rows = db.getAllSync('SELECT * FROM vehicles WHERE id = ? LIMIT 1', [vehicleId]);
  if (rows.length === 0) return null;

  const row: any = rows[0];
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    year: row.year,
    license_plate: row.license_plate,
    photo_odometer_start: row.photo_odometer_start,
    photo_odometer_start_hash: row.photo_odometer_start_hash,
    photo_odometer_end: row.photo_odometer_end,
    photo_odometer_end_hash: row.photo_odometer_end_hash,
    month_year: row.month_year,
    verified: row.verified === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
