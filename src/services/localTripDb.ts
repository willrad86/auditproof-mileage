import { Trip, Coordinates } from '../types';
import { getDatabase, generateId, isAddressOffline } from './localDbService';

function rowToTrip(row: any): Trip {
  const points = JSON.parse(row.points);

  return {
    id: row.id,
    vehicle_id: row.vehicle_id,
    start_time: row.start_time,
    end_time: row.end_time || undefined,
    start_coords: {
      lat: row.start_lat,
      lng: row.start_lng,
      timestamp: row.start_timestamp || undefined,
    },
    end_coords: row.end_lat && row.end_lng ? {
      lat: row.end_lat,
      lng: row.end_lng,
      timestamp: row.end_timestamp || undefined,
    } : undefined,
    distance_miles: row.distance_miles,
    distance_km: row.distance_km,
    points: points,
    purpose: row.purpose,
    notes: row.notes,
    start_address: row.start_address || undefined,
    end_address: row.end_address || undefined,
    map_image_uri: row.map_image_uri || undefined,
    hash: row.hash || undefined,
    status: row.status as 'active' | 'completed' | 'exported',
    classification: row.classification as 'unclassified' | 'business' | 'personal' | 'commute' | 'other',
    auto_detected: row.auto_detected === 1,
    needs_lookup: row.needs_lookup === 1,
    synced_to_cloud: row.synced_to_cloud === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getAllTripsLocal(vehicleId?: string): Promise<Trip[]> {
  const db = await getDatabase();

  let query = 'SELECT * FROM trips';
  const params: any[] = [];

  if (vehicleId) {
    query += ' WHERE vehicle_id = ?';
    params.push(vehicleId);
  }

  query += ' ORDER BY start_time DESC';

  const rows = await db.getAllAsync(query, params);
  return rows.map(rowToTrip);
}

export async function getTripByIdLocal(id: string): Promise<Trip | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync('SELECT * FROM trips WHERE id = ?', [id]);

  if (!row) return null;
  return rowToTrip(row);
}

export async function getActiveTripLocal(): Promise<Trip | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync('SELECT * FROM trips WHERE status = ? LIMIT 1', ['active']);

  if (!row) return null;
  return rowToTrip(row);
}

export async function createTripLocal(
  vehicleId: string,
  startCoords: Coordinates,
  startAddress: string,
  purpose: string = '',
  notes: string = '',
  autoDetected: boolean = false
): Promise<Trip> {
  const db = await getDatabase();
  const id = generateId();
  const now = new Date().toISOString();

  const needsLookup = isAddressOffline(startAddress);

  await db.runAsync(
    `INSERT INTO trips (
      id, vehicle_id, start_time, start_lat, start_lng, start_timestamp,
      distance_miles, distance_km, points, purpose, notes, start_address,
      status, classification, auto_detected, needs_lookup, synced_to_cloud,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      vehicleId,
      now,
      startCoords.lat,
      startCoords.lng,
      startCoords.timestamp || Date.now(),
      0,
      0,
      JSON.stringify([startCoords]),
      purpose,
      notes,
      startAddress,
      'active',
      autoDetected ? 'unclassified' : 'business',
      autoDetected ? 1 : 0,
      needsLookup ? 1 : 0,
      0,
      now,
      now,
    ]
  );

  const trip = await getTripByIdLocal(id);
  if (!trip) throw new Error('Failed to create trip');

  return trip;
}

export async function updateTripLocal(id: string, updates: Partial<Trip>): Promise<Trip> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.end_time !== undefined) {
    fields.push('end_time = ?');
    values.push(updates.end_time);
  }
  if (updates.end_coords !== undefined) {
    fields.push('end_lat = ?', 'end_lng = ?', 'end_timestamp = ?');
    values.push(updates.end_coords.lat, updates.end_coords.lng, updates.end_coords.timestamp || Date.now());
  }
  if (updates.distance_miles !== undefined) {
    fields.push('distance_miles = ?');
    values.push(updates.distance_miles);
  }
  if (updates.distance_km !== undefined) {
    fields.push('distance_km = ?');
    values.push(updates.distance_km);
  }
  if (updates.points !== undefined) {
    fields.push('points = ?');
    values.push(JSON.stringify(updates.points));
  }
  if (updates.purpose !== undefined) {
    fields.push('purpose = ?');
    values.push(updates.purpose);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    values.push(updates.notes);
  }
  if (updates.start_address !== undefined) {
    fields.push('start_address = ?');
    values.push(updates.start_address);

    if (isAddressOffline(updates.start_address)) {
      fields.push('needs_lookup = ?');
      values.push(1);
    }
  }
  if (updates.end_address !== undefined) {
    fields.push('end_address = ?');
    values.push(updates.end_address);

    if (isAddressOffline(updates.end_address)) {
      fields.push('needs_lookup = ?');
      values.push(1);
    }
  }
  if (updates.map_image_uri !== undefined) {
    fields.push('map_image_uri = ?');
    values.push(updates.map_image_uri);
  }
  if (updates.hash !== undefined) {
    fields.push('hash = ?');
    values.push(updates.hash);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.classification !== undefined) {
    fields.push('classification = ?');
    values.push(updates.classification);
  }
  if (updates.needs_lookup !== undefined) {
    fields.push('needs_lookup = ?');
    values.push(updates.needs_lookup ? 1 : 0);
  }
  if (updates.synced_to_cloud !== undefined) {
    fields.push('synced_to_cloud = ?');
    values.push(updates.synced_to_cloud ? 1 : 0);
  }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.runAsync(
    `UPDATE trips SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  const updated = await getTripByIdLocal(id);
  if (!updated) throw new Error('Trip not found after update');

  return updated;
}

export async function addPointToTripLocal(tripId: string, coords: Coordinates): Promise<void> {
  const trip = await getTripByIdLocal(tripId);
  if (!trip) return;

  const updatedPoints = [...trip.points, coords];

  await updateTripLocal(tripId, {
    points: updatedPoints,
  });
}

export async function deleteTripLocal(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM trips WHERE id = ?', [id]);
}

export async function getTripsByMonthYearLocal(vehicleId: string, monthYear: string): Promise<Trip[]> {
  const db = await getDatabase();

  const startDate = `${monthYear}-01T00:00:00`;
  const endDate = new Date(`${monthYear}-01`);
  endDate.setMonth(endDate.getMonth() + 1);
  const endDateString = endDate.toISOString();

  const rows = await db.getAllAsync(
    `SELECT * FROM trips
     WHERE vehicle_id = ?
     AND start_time >= ?
     AND start_time < ?
     AND status = 'completed'
     ORDER BY start_time DESC`,
    [vehicleId, startDate, endDateString]
  );

  return rows.map(rowToTrip);
}

export async function getTripsNeedingLookupLocal(): Promise<Trip[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync('SELECT * FROM trips WHERE needs_lookup = 1 ORDER BY start_time DESC');
  return rows.map(rowToTrip);
}

export async function getUnsyncedTripsLocal(): Promise<Trip[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM trips WHERE synced_to_cloud = 0 AND status = ? ORDER BY start_time DESC',
    ['completed']
  );
  return rows.map(rowToTrip);
}
