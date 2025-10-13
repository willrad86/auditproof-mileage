import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as SQLite from "expo-sqlite";
import { Vehicle } from "../types";

/* -------------------------------------------------------------------------- */
/*                              TYPE DEFINITIONS                              */
/* -------------------------------------------------------------------------- */
type VehicleRow = {
  id: number;
  make: string;
  model?: string | null;
  year?: number | null;
  license_plate?: string | null;
  month_year?: string | null;
  photo_odometer_start?: string | null;
  photo_odometer_end?: string | null;
  photo_odometer_start_hash?: string | null;
  photo_odometer_end_hash?: string | null;
  verified?: number;
  created_at?: string;
  updated_at?: string;
};

/* -------------------------------------------------------------------------- */
/*                           DATABASE INITIALIZATION                          */
/* -------------------------------------------------------------------------- */
const db = SQLite.openDatabaseSync("auditproof.db");

function initTables() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      make TEXT NOT NULL,
      model TEXT,
      year INTEGER,
      license_plate TEXT,
      month_year TEXT,
      photo_odometer_start TEXT,
      photo_odometer_end TEXT,
      photo_odometer_start_hash TEXT,
      photo_odometer_end_hash TEXT,
      verified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS vehicle_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      photo_path TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

initTables();

/* -------------------------------------------------------------------------- */
/*                                 VEHICLES                                   */
/* -------------------------------------------------------------------------- */
export async function getVehicles(): Promise<Vehicle[]> {
  const { getAllVehiclesLocal } = await import('./localVehicleDb');
  return await getAllVehiclesLocal();
}

export async function addVehicle(
  make: string,
  model?: string,
  year?: number,
  license_plate?: string
): Promise<Vehicle> {
  const { createVehicleLocal } = await import('./localVehicleDb');
  const { getCurrentMonthYear } = await import('./odometerPhotoService');

  const vehicle = await createVehicleLocal({
    make,
    model: model || '',
    year: year || new Date().getFullYear(),
    license_plate: license_plate || '',
    month_year: getCurrentMonthYear(),
    verified: false,
  });

  return vehicle;
}

/* -------------------------------------------------------------------------- */
/*                              PHOTO UTILITIES                               */
/* -------------------------------------------------------------------------- */
async function ensurePhotosDirectory(): Promise<string> {
  const dir = `${FileSystem.documentDirectory}vehicle_photos`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

/* -------------------------------------------------------------------------- */
/*                           SAVE ODOMETER PHOTO                              */
/* -------------------------------------------------------------------------- */
export async function saveOdometerPhoto(
  vehicleId: string | number,
  uri: string
): Promise<string> {
  try {
    const photosDir = await ensurePhotosDirectory();
    const filename = `odometer_${vehicleId}_${Date.now()}.jpg`;
    const dest = `${photosDir}/${filename}`;
    await FileSystem.copyAsync({ from: uri, to: dest });

    const currentMonth = new Date().toISOString().slice(0, 7);
    db.runSync(
      "INSERT INTO vehicle_photos (vehicle_id, month, photo_path) VALUES (?, ?, ?);",
      [vehicleId, currentMonth, dest]
    );

    const existing = db.getAllSync<{
      photo_odometer_start?: string | null;
      photo_odometer_end?: string | null;
      month_year?: string | null;
    }>(
      "SELECT photo_odometer_start, photo_odometer_end, month_year FROM vehicles WHERE id = ?;",
      [vehicleId]
    )[0];

    if (!existing) return dest;

    if (!existing.photo_odometer_start || existing.month_year !== currentMonth) {
      db.runSync(
        "UPDATE vehicles SET photo_odometer_start = ?, month_year = ? WHERE id = ?;",
        [dest, currentMonth, vehicleId]
      );
    } else {
      db.runSync(
        "UPDATE vehicles SET photo_odometer_end = ?, month_year = ? WHERE id = ?;",
        [dest, currentMonth, vehicleId]
      );
    }

    console.log("✅ Photo saved for vehicle:", vehicleId);
    return dest;
  } catch (error) {
    console.error("Error saving odometer photo:", error);
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/*                           TAKE ODOMETER PHOTO                              */
/* -------------------------------------------------------------------------- */
export async function takeOdometerPhoto(
  vehicleId: string | number
): Promise<string | null> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      alert("Camera access is required to take photos.");
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled) return null;

    const photoUri = result.assets[0].uri;
    const savedUri = await saveOdometerPhoto(vehicleId, photoUri);
    return savedUri ?? null;
  } catch (error) {
    console.error("Error taking odometer photo:", error);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                          GET VEHICLE BY ID                                 */
/* -------------------------------------------------------------------------- */
export async function getVehicleById(vehicleId: string | number): Promise<Vehicle | null> {
  try {
    const rows = db.getAllSync<VehicleRow>(
      "SELECT * FROM vehicles WHERE id = ? LIMIT 1;",
      [vehicleId]
    );
    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: String(row.id),
      make: row.make,
      model: row.model || '',
      year: row.year || new Date().getFullYear(),
      license_plate: row.license_plate || '',
      month_year: row.month_year || '',
      photo_odometer_start: row.photo_odometer_start || undefined,
      photo_odometer_end: row.photo_odometer_end || undefined,
      photo_odometer_start_hash: row.photo_odometer_start_hash || undefined,
      photo_odometer_end_hash: row.photo_odometer_end_hash || undefined,
      verified: Boolean(row.verified),
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error getting vehicle by ID:", error);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                      GET VEHICLE ODOMETER PHOTOS                           */
/* -------------------------------------------------------------------------- */
export async function getVehicleOdometerPhotos(vehicleId: string | number): Promise<{
  start?: string;
  end?: string;
  startHash?: string;
  endHash?: string;
}> {
  try {
    const vehicle = await getVehicleById(vehicleId);
    if (!vehicle) return {};

    return {
      start: vehicle.photo_odometer_start,
      end: vehicle.photo_odometer_end,
      startHash: vehicle.photo_odometer_start_hash,
      endHash: vehicle.photo_odometer_end_hash,
    };
  } catch (error) {
    console.error("Error getting vehicle odometer photos:", error);
    return {};
  }
}

/* -------------------------------------------------------------------------- */
/*                          CLEAN OLD PHOTOS (OPTIONAL)                       */
/* -------------------------------------------------------------------------- */
export async function clearOldPhotos() {
  try {
    const dir = `${FileSystem.documentDirectory}vehicle_photos`;
    const files = await FileSystem.readDirectoryAsync(dir);
    const now = Date.now();

    for (const file of files) {
      const info = await FileSystem.getInfoAsync(`${dir}/${file}`);
      if (info.exists && info.modificationTime) {
        const age = now - info.modificationTime * 1000;
        if (age > 1000 * 60 * 60 * 24 * 365) {
          await FileSystem.deleteAsync(`${dir}/${file}`);
        }
      }
    }
    console.log("🧹 Old photos cleaned up");
  } catch (error) {
    console.error("Error cleaning up photos:", error);
  }
}
