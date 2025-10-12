export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  license_plate: string;
  photo_odometer_start?: string;
  photo_odometer_start_hash?: string;
  photo_odometer_end?: string;
  photo_odometer_end_hash?: string;
  month_year: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
  timestamp?: number;
}

export interface Trip {
  id: string;
  vehicle_id: string;
  start_time: string;
  end_time?: string;
  start_coords: Coordinates;
  end_coords?: Coordinates;
  distance_miles: number;
  distance_km: number;
  points: Coordinates[];
  purpose: string;
  notes: string;
  start_address?: string;
  end_address?: string;
  map_image_uri?: string;
  hash?: string;
  status: 'active' | 'completed' | 'exported';
  classification: 'unclassified' | 'business' | 'personal' | 'commute' | 'other';
  auto_detected: boolean;
  needs_lookup: boolean;
  synced_to_cloud: boolean;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  vehicle_id: string;
  month_year: string;
  total_miles: number;
  total_km: number;
  total_value: number;
  trip_count: number;
  report_hash: string;
  signature: string;
  signed_at: string;
  export_uri?: string;
  created_at: string;
}

export interface ReportMetadata {
  vehicle: string;
  month: string;
  totalMiles: number;
  totalValue: number;
  hash: string;
  signatureCreatedAt: string;
  mapImages: number;
  photos: {
    start: string;
    end: string;
  };
}
