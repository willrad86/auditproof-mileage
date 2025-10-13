import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<void> | null = null;

export async function initDatabase(): Promise<void> {
  if (db) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      db = await SQLite.openDatabaseAsync('auditproof.db');

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY NOT NULL,
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

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY NOT NULL,
      vehicle_id TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      start_lat REAL NOT NULL,
      start_lng REAL NOT NULL,
      start_timestamp INTEGER,
      end_lat REAL,
      end_lng REAL,
      end_timestamp INTEGER,
      distance_miles REAL DEFAULT 0,
      distance_km REAL DEFAULT 0,
      points TEXT NOT NULL,
      purpose TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      start_address TEXT,
      end_address TEXT,
      map_image_uri TEXT,
      hash TEXT,
      status TEXT DEFAULT 'active',
      classification TEXT DEFAULT 'unclassified',
      auto_detected INTEGER DEFAULT 0,
      needs_lookup INTEGER DEFAULT 0,
      synced_to_cloud INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY NOT NULL,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY NOT NULL,
      vehicle_id TEXT NOT NULL,
      month_year TEXT NOT NULL,
      total_miles REAL DEFAULT 0,
      total_km REAL DEFAULT 0,
      total_value REAL DEFAULT 0,
      trip_count INTEGER DEFAULT 0,
      report_hash TEXT NOT NULL,
      signature TEXT NOT NULL,
      signed_at TEXT NOT NULL,
      export_uri TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vehicle_photos (
      id TEXT PRIMARY KEY NOT NULL,
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

    CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON trips(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
    CREATE INDEX IF NOT EXISTS idx_trips_needs_lookup ON trips(needs_lookup);
    CREATE INDEX IF NOT EXISTS idx_trips_synced ON trips(synced_to_cloud);
    CREATE INDEX IF NOT EXISTS idx_vehicles_month_year ON vehicles(month_year);
    CREATE INDEX IF NOT EXISTS idx_reports_month_year ON reports(month_year);
    CREATE INDEX IF NOT EXISTS idx_reports_vehicle_id ON reports(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_vehicle_photos_vehicle_id ON vehicle_photos(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_vehicle_photos_month_year ON vehicle_photos(month_year);
  `);

      const existingSettings = await db.getAllAsync('SELECT * FROM settings WHERE key = ?', ['irs_rate_per_mile']);
      if (existingSettings.length === 0) {
        await db.runAsync(
          'INSERT INTO settings (id, key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [generateId(), 'irs_rate_per_mile', '0.67', new Date().toISOString(), new Date().toISOString()]
        );
      }

      initPromise = null;
    } catch (error) {
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    await initDatabase();
  }
  if (!db) {
    throw new Error('Database initialization failed');
  }
  return db;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function isAddressOffline(address: string | undefined): boolean {
  if (!address) return false;
  return address.includes('(offline)');
}
