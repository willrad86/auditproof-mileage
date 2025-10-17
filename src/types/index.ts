// src/types/index.ts

/**
 * Represents a single vehicle in the Auditproof Mileage database.
 * Matches the schema in simpleVehicleService.ts and localVehicleDb.ts
 */
export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  license_plate: string;

  // Odometer photos (nullable until taken)
  photo_odometer_start: string | null;
  photo_odometer_start_hash: string | null;
  photo_odometer_end: string | null;
  photo_odometer_end_hash: string | null;

  // Month-year label for record grouping (nullable until first trip)
  month_year: string | null;

  // True if user has verified mileage data for this vehicle
  verified: boolean;

  // ISO timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Represents an individual photo record linked to a vehicle.
 * Used for odometer start/end tracking and export.
 */
export interface VehiclePhoto {
  id: string;
  vehicle_id: string;
  month_year: string | null;
  photo_type: 'start' | 'end';
  photo_uri: string;
  photo_hash: string | null;
  timestamp: string;
  synced_to_cloud: boolean;
  created_at: string;
}

/**
 * Represents a combined monthly snapshot (start + end photos).
 * Derived type, not stored directly in DB.
 */
export interface MonthlyPhotoRecord {
  month_year: string;
  start_photo: VehiclePhoto | null;
  end_photo: VehiclePhoto | null;
}

/**
 * Represents a calculated odometer entry (distance covered).
 * Used for export and reporting.
 */
export interface OdometerRecord {
  vehicle_id: string;
  month_year: string;
  start_photo_uri: string | null;
  end_photo_uri: string | null;
  distance_miles: number | null;
  verified: boolean;
  created_at: string;
}

/**
 * Standard shape for all database operation errors.
 * Provides context in console/logs but not surfaced to UI directly.
 */
export interface DatabaseError {
  message: string;
  code?: number;
}

/**
 * Utility type to make any interface nullable.
 * Example: Nullable<Vehicle> = Vehicle with all values possibly null.
 */
export type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};
