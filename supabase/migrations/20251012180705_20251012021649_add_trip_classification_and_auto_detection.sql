/*
  # Add Trip Classification and Auto-Detection Support

  1. Schema Changes
    - Add `classification` column to trips table
      - Values: 'unclassified', 'business', 'personal', 'commute', 'other'
      - Default: 'unclassified'
    
    - Add `auto_detected` column to trips table
      - Boolean flag indicating if trip was automatically detected
      - Default: true for new auto-detected trips
    
    - Add `map_image_uri` column (if not exists)
      - Stores path to static map image
    
  2. Notes
    - Existing trips will default to 'unclassified' classification
    - Auto-detection flag helps distinguish manual vs automatic trips
    - Map image URI enables offline map generation queuing
*/

-- Add classification column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trips' AND column_name = 'classification'
  ) THEN
    ALTER TABLE trips ADD COLUMN classification text DEFAULT 'unclassified';
  END IF;
END $$;

-- Add auto_detected column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trips' AND column_name = 'auto_detected'
  ) THEN
    ALTER TABLE trips ADD COLUMN auto_detected boolean DEFAULT true;
  END IF;
END $$;

-- Ensure map_image_uri exists (should already be there)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trips' AND column_name = 'map_image_uri'
  ) THEN
    ALTER TABLE trips ADD COLUMN map_image_uri text;
  END IF;
END $$;

-- Create index for classification queries
CREATE INDEX IF NOT EXISTS idx_trips_classification ON trips(classification);

-- Create index for auto_detected flag
CREATE INDEX IF NOT EXISTS idx_trips_auto_detected ON trips(auto_detected);