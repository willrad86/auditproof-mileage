import { supabase } from '../utils/supabaseClient';
import * as Network from 'expo-network';
import { getUnsyncedTripsLocal, updateTripLocal } from './localTripDb';
import { getAllVehiclesLocal } from './localVehicleDb';

export async function syncTripsToCloud(): Promise<{
  success: boolean;
  synced: number;
  failed: number;
  error?: string;
}> {
  try {
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected || !networkState.isInternetReachable) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        error: 'No internet connection',
      };
    }

    const unsyncedTrips = await getUnsyncedTripsLocal();

    let synced = 0;
    let failed = 0;

    for (const trip of unsyncedTrips) {
      try {
        const { error } = await supabase.from('trips').upsert({
          id: trip.id,
          vehicle_id: trip.vehicle_id,
          start_time: trip.start_time,
          end_time: trip.end_time,
          start_coords: trip.start_coords,
          end_coords: trip.end_coords,
          distance_miles: trip.distance_miles,
          distance_km: trip.distance_km,
          points: trip.points,
          purpose: trip.purpose,
          notes: trip.notes,
          start_address: trip.start_address,
          end_address: trip.end_address,
          map_image_uri: trip.map_image_uri,
          hash: trip.hash,
          status: trip.status,
          classification: trip.classification,
          auto_detected: trip.auto_detected,
          created_at: trip.created_at,
          updated_at: trip.updated_at,
        });

        if (error) {
          console.error('Failed to sync trip:', trip.id, error);
          failed++;
        } else {
          await updateTripLocal(trip.id, {
            synced_to_cloud: true,
          });
          synced++;
        }
      } catch (error) {
        console.error('Failed to sync trip:', trip.id, error);
        failed++;
      }
    }

    return {
      success: synced > 0,
      synced,
      failed,
    };
  } catch (error) {
    return {
      success: false,
      synced: 0,
      failed: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function syncVehiclesToCloud(): Promise<{
  success: boolean;
  synced: number;
  failed: number;
  error?: string;
}> {
  try {
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected || !networkState.isInternetReachable) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        error: 'No internet connection',
      };
    }

    const vehicles = await getAllVehiclesLocal();

    let synced = 0;
    let failed = 0;

    for (const vehicle of vehicles) {
      try {
        const { error } = await supabase.from('vehicles').upsert({
          id: vehicle.id,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          license_plate: vehicle.license_plate,
          photo_odometer_start: vehicle.photo_odometer_start,
          photo_odometer_start_hash: vehicle.photo_odometer_start_hash,
          photo_odometer_end: vehicle.photo_odometer_end,
          photo_odometer_end_hash: vehicle.photo_odometer_end_hash,
          month_year: vehicle.month_year,
          verified: vehicle.verified,
          created_at: vehicle.created_at,
          updated_at: vehicle.updated_at,
        });

        if (error) {
          console.error('Failed to sync vehicle:', vehicle.id, error);
          failed++;
        } else {
          synced++;
        }
      } catch (error) {
        console.error('Failed to sync vehicle:', vehicle.id, error);
        failed++;
      }
    }

    return {
      success: synced > 0,
      synced,
      failed,
    };
  } catch (error) {
    return {
      success: false,
      synced: 0,
      failed: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function syncAllToCloud(): Promise<{
  success: boolean;
  trips: { synced: number; failed: number };
  vehicles: { synced: number; failed: number };
  error?: string;
}> {
  const networkState = await Network.getNetworkStateAsync();
  if (!networkState.isConnected || !networkState.isInternetReachable) {
    return {
      success: false,
      trips: { synced: 0, failed: 0 },
      vehicles: { synced: 0, failed: 0 },
      error: 'No internet connection',
    };
  }

  const tripsResult = await syncTripsToCloud();
  const vehiclesResult = await syncVehiclesToCloud();

  return {
    success: tripsResult.success || vehiclesResult.success,
    trips: {
      synced: tripsResult.synced,
      failed: tripsResult.failed,
    },
    vehicles: {
      synced: vehiclesResult.synced,
      failed: vehiclesResult.failed,
    },
  };
}

export async function getUnsyncedCount(): Promise<{
  trips: number;
  vehicles: number;
}> {
  const unsyncedTrips = await getUnsyncedTripsLocal();
  const vehicles = await getAllVehiclesLocal();

  return {
    trips: unsyncedTrips.length,
    vehicles: vehicles.length,
  };
}
