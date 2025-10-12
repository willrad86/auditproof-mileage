/*
  # Auditproof Mileage - Database Schema

  1. New Tables
    - `vehicles`
      - `id` (uuid, primary key)
      - `make` (text)
      - `model` (text)
      - `year` (integer)
      - `license_plate` (text)
      - `photo_odometer_start` (text, URI to photo)
      - `photo_odometer_start_hash` (text, SHA-256)
      - `photo_odometer_end` (text, URI to photo)
      - `photo_odometer_end_hash` (text, SHA-256)
      - `month_year` (text, format: YYYY-MM)
      - `verified` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `trips`
      - `id` (uuid, primary key)
      - `vehicle_id` (uuid, foreign key)
      - `start_time` (timestamptz)
      - `end_time` (timestamptz)
      - `start_coords` (jsonb, {lat, lng})
      - `end_coords` (jsonb, {lat, lng})
      - `distance_miles` (numeric)
      - `distance_km` (numeric)
      - `points` (jsonb array of {lat, lng, timestamp})
      - `purpose` (text)
      - `notes` (text)
      - `start_address` (text, optional)
      - `end_address` (text, optional)
      - `map_image_uri` (text)
      - `hash` (text, SHA-256 of trip data)
      - `status` (text: active, completed, exported)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `settings`
      - `id` (uuid, primary key)
      - `key` (text, unique)
      - `value` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `reports`
      - `id` (uuid, primary key)
      - `vehicle_id` (uuid, foreign key)
      - `month_year` (text, format: YYYY-MM)
      - `total_miles` (numeric)
      - `total_km` (numeric)
      - `total_value` (numeric)
      - `trip_count` (integer)
      - `report_hash` (text, SHA-256)
      - `signature` (text)
      - `signed_at` (timestamptz)
      - `export_uri` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for public access (no auth required for this app)
    
  3. Indexes
    - Index on vehicle_id for trips
    - Index on month_year for vehicles and reports
    - Index on status for trips
*/

-- Create vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make text NOT NULL,
  model text NOT NULL,
  year integer NOT NULL,
  license_plate text NOT NULL,
  photo_odometer_start text,
  photo_odometer_start_hash text,
  photo_odometer_end text,
  photo_odometer_end_hash text,
  month_year text NOT NULL,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create trips table
CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  start_coords jsonb NOT NULL,
  end_coords jsonb,
  distance_miles numeric DEFAULT 0,
  distance_km numeric DEFAULT 0,
  points jsonb DEFAULT '[]'::jsonb,
  purpose text DEFAULT '',
  notes text DEFAULT '',
  start_address text,
  end_address text,
  map_image_uri text,
  hash text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  month_year text NOT NULL,
  total_miles numeric DEFAULT 0,
  total_km numeric DEFAULT 0,
  total_value numeric DEFAULT 0,
  trip_count integer DEFAULT 0,
  report_hash text NOT NULL,
  signature text NOT NULL,
  signed_at timestamptz NOT NULL,
  export_uri text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_month_year ON vehicles(month_year);
CREATE INDEX IF NOT EXISTS idx_reports_month_year ON reports(month_year);
CREATE INDEX IF NOT EXISTS idx_reports_vehicle_id ON reports(vehicle_id);

-- Enable RLS
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no auth required)
CREATE POLICY "Allow public read access to vehicles"
  ON vehicles FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to vehicles"
  ON vehicles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to vehicles"
  ON vehicles FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from vehicles"
  ON vehicles FOR DELETE
  USING (true);

CREATE POLICY "Allow public read access to trips"
  ON trips FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to trips"
  ON trips FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to trips"
  ON trips FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from trips"
  ON trips FOR DELETE
  USING (true);

CREATE POLICY "Allow public read access to settings"
  ON settings FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to settings"
  ON settings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to settings"
  ON settings FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from settings"
  ON settings FOR DELETE
  USING (true);

CREATE POLICY "Allow public read access to reports"
  ON reports FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to reports"
  ON reports FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to reports"
  ON reports FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from reports"
  ON reports FOR DELETE
  USING (true);

-- Insert default IRS rate setting
INSERT INTO settings (key, value) VALUES ('irs_rate_per_mile', '0.67')
ON CONFLICT (key) DO NOTHING;