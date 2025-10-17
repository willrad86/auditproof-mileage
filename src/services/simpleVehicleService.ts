import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { Vehicle } from '../types';

let db: SQLite.SQLiteDatabase | null = null;

/** Initialize database and tables if needed. */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = SQLite.openDatabaseSync('auditproof.db');

    // Check if vehicles table exists with wrong schema (INTEGER id instead of TEXT)
    try {
      const tableInfo = db.getAllSync("PRAGMA table_info(vehicles)");
      const idColumn = (tableInfo as any[]).find((col: any) => col.name === 'id');

      if (idColumn && idColumn.type === 'INTEGER') {
        console.log('⚠️  Detected old schema with INTEGER id, migrating...');
        db.execSync('DROP TABLE IF EXISTS vehicle_photos');
        db.execSync('DROP TABLE IF EXISTS vehicles');
        console.log('✅ Old tables dropped');
      }
    } catch (e) {
      // Table doesn't exist yet, continue
    }

    db.execSync(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id TEXT PRIMARY KEY,
        make TEXT NOT NULL,
        model TEXT NOT NULL,
        year INTEGER,
        license_plate TEXT,
        photo_odometer_start TEXT,
        photo_odometer_start_hash TEXT,
        photo_odometer_end TEXT,
        photo_odometer_end_hash TEXT,
        month_year TEXT,
        verified INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    db.execSync(`
      CREATE TABLE IF NOT EXISTS vehicle_photos (
        id TEXT PRIMARY KEY,
        vehicle_id TEXT NOT NULL,
        month_year TEXT,
        photo_type TEXT NOT NULL,
        photo_uri TEXT NOT NULL,
        photo_hash TEXT,
        timestamp TEXT NOT NULL,
        synced_to_cloud INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ Local database initialized with TEXT id schema');
  }
  return db!;
}

/** Add a new vehicle and return the inserted record. */
export async function addVehicle(
  make: string,
  model: string,
  year: number,
  license_plate: string
): Promise<Vehicle> {
  // Validate inputs
  const safeMake = (make || '').trim();
  const safeModel = (model || '').trim();
  const safeLicensePlate = (license_plate || '').trim();

  if (!safeMake) throw new Error('Make is required');
  if (!safeModel) throw new Error('Model is required');
  if (!safeLicensePlate) throw new Error('License plate is required');

  try {
    const database = await initDatabase();
    const id = Crypto.randomUUID();
    const now = new Date().toISOString();
    const safeYear = year && year > 1900 && year <= new Date().getFullYear() + 1
      ? parseInt(String(year), 10)
      : new Date().getFullYear();

    database.runSync(
      `
      INSERT INTO vehicles (
        id, make, model, year, license_plate,
        photo_odometer_start, photo_odometer_start_hash,
        photo_odometer_end, photo_odometer_end_hash,
        month_year, verified, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        safeMake,
        safeModel,
        safeYear,
        safeLicensePlate,
        null,
        null,
        null,
        null,
        null,
        0,
        now,
        now,
      ]
    );

    // Verify the insert succeeded by fetching the record
    const inserted = database.getFirstSync(
      'SELECT * FROM vehicles WHERE id = ?',
      [id]
    );

    if (!inserted) {
      throw new Error('Failed to insert vehicle into database');
    }

    const vehicle: Vehicle = {
      id,
      make: safeMake,
      model: safeModel,
      year: safeYear,
      license_plate: safeLicensePlate,
      photo_odometer_start: null,
      photo_odometer_start_hash: null,
      photo_odometer_end: null,
      photo_odometer_end_hash: null,
      month_year: null,
      verified: false,
      created_at: now,
      updated_at: now,
    };

    console.log('✅ Vehicle saved successfully:', vehicle.year, vehicle.make, vehicle.model);
    return vehicle;
  } catch (err) {
    console.error('❌ Error adding vehicle:', err);
    const errorMsg = err instanceof Error ? err.message : 'Unknown database error';
    throw new Error(`Failed to save vehicle: ${errorMsg}`);
  }
}

/** Get all vehicles from database. */
export async function getVehicles(): Promise<Vehicle[]> {
  try {
    const database = await initDatabase();
    const rows = database.getAllSync('SELECT * FROM vehicles ORDER BY created_at DESC');
    return rows.map((r: any) => ({
      id: r.id,
      make: r.make,
      model: r.model,
      year: r.year,
      license_plate: r.license_plate,
      photo_odometer_start: r.photo_odometer_start,
      photo_odometer_start_hash: r.photo_odometer_start_hash,
      photo_odometer_end: r.photo_odometer_end,
      photo_odometer_end_hash: r.photo_odometer_end_hash,
      month_year: r.month_year,
      verified: r.verified === 1,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  } catch (err) {
    console.error('❌ Error fetching vehicles:', err);
    return [];
  }
}

/** Delete a vehicle and its photos. */
export async function deleteVehicle(id: string): Promise<void> {
  try {
    const database = await initDatabase();
    database.runSync('DELETE FROM vehicle_photos WHERE vehicle_id = ?', [id]);
    database.runSync('DELETE FROM vehicles WHERE id = ?', [id]);
    console.log('🗑️  Deleted vehicle', id);
  } catch (err) {
    console.error('❌ Error deleting vehicle:', err);
  }
}
