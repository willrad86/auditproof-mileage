import { Vehicle } from '../types';
import { getDatabase, generateId, isAddressOffline } from './localDbService';

export async function getAllVehiclesLocal(): Promise<Vehicle[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync('SELECT * FROM vehicles ORDER BY created_at DESC');

  return rows.map(row => ({
    id: (row as any).id,
    make: (row as any).make,
    model: (row as any).model,
    year: (row as any).year,
    license_plate: (row as any).license_plate,
    photo_odometer_start: (row as any).photo_odometer_start,
    photo_odometer_start_hash: (row as any).photo_odometer_start_hash,
    photo_odometer_end: (row as any).photo_odometer_end,
    photo_odometer_end_hash: (row as any).photo_odometer_end_hash,
    month_year: (row as any).month_year,
    verified: (row as any).verified === 1,
    created_at: (row as any).created_at,
    updated_at: (row as any).updated_at,
  }));
}

export async function getVehicleByIdLocal(id: string): Promise<Vehicle | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync('SELECT * FROM vehicles WHERE id = ?', [id]);

  if (!row) return null;

  return {
    id: (row as any).id,
    make: (row as any).make,
    model: (row as any).model,
    year: (row as any).year,
    license_plate: (row as any).license_plate,
    photo_odometer_start: (row as any).photo_odometer_start,
    photo_odometer_start_hash: (row as any).photo_odometer_start_hash,
    photo_odometer_end: (row as any).photo_odometer_end,
    photo_odometer_end_hash: (row as any).photo_odometer_end_hash,
    month_year: (row as any).month_year,
    verified: (row as any).verified === 1,
    created_at: (row as any).created_at,
    updated_at: (row as any).updated_at,
  };
}

export async function createVehicleLocal(vehicle: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>): Promise<Vehicle> {
  const db = await getDatabase();
  const id = generateId();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO vehicles (
      id, make, model, year, license_plate, photo_odometer_start,
      photo_odometer_start_hash, photo_odometer_end, photo_odometer_end_hash,
      month_year, verified, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      vehicle.make,
      vehicle.model,
      vehicle.year,
      vehicle.license_plate,
      vehicle.photo_odometer_start || null,
      vehicle.photo_odometer_start_hash || null,
      vehicle.photo_odometer_end || null,
      vehicle.photo_odometer_end_hash || null,
      vehicle.month_year,
      vehicle.verified ? 1 : 0,
      now,
      now,
    ]
  );

  return {
    ...vehicle,
    id,
    created_at: now,
    updated_at: now,
  };
}

export async function updateVehicleLocal(id: string, updates: Partial<Vehicle>): Promise<Vehicle> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.make !== undefined) {
    fields.push('make = ?');
    values.push(updates.make);
  }
  if (updates.model !== undefined) {
    fields.push('model = ?');
    values.push(updates.model);
  }
  if (updates.year !== undefined) {
    fields.push('year = ?');
    values.push(updates.year);
  }
  if (updates.license_plate !== undefined) {
    fields.push('license_plate = ?');
    values.push(updates.license_plate);
  }
  if (updates.photo_odometer_start !== undefined) {
    fields.push('photo_odometer_start = ?');
    values.push(updates.photo_odometer_start);
  }
  if (updates.photo_odometer_start_hash !== undefined) {
    fields.push('photo_odometer_start_hash = ?');
    values.push(updates.photo_odometer_start_hash);
  }
  if (updates.photo_odometer_end !== undefined) {
    fields.push('photo_odometer_end = ?');
    values.push(updates.photo_odometer_end);
  }
  if (updates.photo_odometer_end_hash !== undefined) {
    fields.push('photo_odometer_end_hash = ?');
    values.push(updates.photo_odometer_end_hash);
  }
  if (updates.month_year !== undefined) {
    fields.push('month_year = ?');
    values.push(updates.month_year);
  }
  if (updates.verified !== undefined) {
    fields.push('verified = ?');
    values.push(updates.verified ? 1 : 0);
  }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.runAsync(
    `UPDATE vehicles SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  const updated = await getVehicleByIdLocal(id);
  if (!updated) throw new Error('Vehicle not found after update');

  return updated;
}

export async function deleteVehicleLocal(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM vehicles WHERE id = ?', [id]);
}
