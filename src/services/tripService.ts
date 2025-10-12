import { supabase } from '../utils/supabaseClient';
import { Trip, Coordinates } from '../types';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Network from 'expo-network';
import { calculateDistance, calculateTotalDistance } from '../utils/haversine';
import { generateTripHash } from '../utils/cryptoUtils';

const LOCATION_TASK_NAME = 'background-location-task';
const TRIP_UPDATE_INTERVAL = 10000;

let activeTrip: {
  id: string;
  points: Coordinates[];
  lastUpdate: number;
} | null = null;

export async function requestLocationPermissions(): Promise<boolean> {
  const { status: foregroundStatus } =
    await Location.requestForegroundPermissionsAsync();

  if (foregroundStatus !== 'granted') {
    return false;
  }

  const { status: backgroundStatus } =
    await Location.requestBackgroundPermissionsAsync();

  return backgroundStatus === 'granted';
}

export async function getAllTrips(vehicleId?: string): Promise<Trip[]> {
  try {
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected || !networkState.isInternetReachable) {
      return [];
    }

    let query = supabase.from('trips').select('*').order('start_time', { ascending: false });

    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.log('Offline: returning empty trips array');
    return [];
  }
}

export async function getTripById(id: string): Promise<Trip | null> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getActiveTrip(): Promise<Trip | null> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function startTrip(
  vehicleId: string,
  purpose: string = '',
  notes: string = ''
): Promise<Trip> {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) {
    throw new Error('Location permissions not granted');
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  const startCoords: Coordinates = {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    timestamp: Date.now(),
  };

  const { data, error } = await supabase
    .from('trips')
    .insert({
      vehicle_id: vehicleId,
      start_time: new Date().toISOString(),
      start_coords: startCoords,
      points: [startCoords],
      purpose,
      notes,
      status: 'active',
      distance_miles: 0,
      distance_km: 0,
      classification: 'business',
      auto_detected: false,
    })
    .select()
    .single();

  if (error) throw error;

  activeTrip = {
    id: data.id,
    points: [startCoords],
    lastUpdate: Date.now(),
  };

  await startBackgroundLocationTracking();

  return data;
}

export async function stopTrip(tripId: string): Promise<Trip> {
  await stopBackgroundLocationTracking();

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  const endCoords: Coordinates = {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    timestamp: Date.now(),
  };

  const trip = await getTripById(tripId);
  if (!trip) throw new Error('Trip not found');

  const allPoints = [...trip.points, endCoords];

  const distanceMiles = calculateTotalDistance(allPoints, 'miles');
  const distanceKm = calculateTotalDistance(allPoints, 'km');

  const hash = await generateTripHash({
    start_time: trip.start_time,
    end_time: new Date().toISOString(),
    start_coords: trip.start_coords,
    end_coords: endCoords,
    distance_miles: distanceMiles,
    points: allPoints,
    purpose: trip.purpose,
    notes: trip.notes,
  });

  const { data, error } = await supabase
    .from('trips')
    .update({
      end_time: new Date().toISOString(),
      end_coords: endCoords,
      points: allPoints,
      distance_miles: distanceMiles,
      distance_km: distanceKm,
      hash,
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', tripId)
    .select()
    .single();

  if (error) throw error;

  activeTrip = null;

  return data;
}

export async function addPointToTrip(tripId: string, coords: Coordinates): Promise<void> {
  const trip = await getTripById(tripId);
  if (!trip) return;

  const updatedPoints = [...trip.points, coords];

  const distanceMiles = calculateTotalDistance(updatedPoints, 'miles');
  const distanceKm = calculateTotalDistance(updatedPoints, 'km');

  await supabase
    .from('trips')
    .update({
      points: updatedPoints,
      distance_miles: distanceMiles,
      distance_km: distanceKm,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tripId);
}

export async function updateTripDetails(
  tripId: string,
  updates: {
    purpose?: string;
    notes?: string;
    start_address?: string;
    end_address?: string;
    map_image_uri?: string;
    classification?: 'unclassified' | 'business' | 'personal' | 'commute' | 'other';
  }
): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tripId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTripClassification(
  tripId: string,
  classification: 'unclassified' | 'business' | 'personal' | 'commute' | 'other'
): Promise<Trip> {
  return updateTripDetails(tripId, { classification });
}

export async function deleteTrip(tripId: string): Promise<void> {
  const { error } = await supabase.from('trips').delete().eq('id', tripId);

  if (error) throw error;
}

export async function getTripsByMonthYear(
  vehicleId: string,
  monthYear: string
): Promise<Trip[]> {
  const startDate = `${monthYear}-01T00:00:00Z`;
  const endDate = new Date(monthYear + '-01');
  endDate.setMonth(endDate.getMonth() + 1);
  const endDateString = endDate.toISOString();

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .gte('start_time', startDate)
    .lt('start_time', endDateString)
    .eq('status', 'completed')
    .order('start_time', { ascending: false });

  if (error) throw error;
  return data || [];
}

async function startBackgroundLocationTracking() {
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: TRIP_UPDATE_INTERVAL,
    distanceInterval: 50,
    foregroundService: {
      notificationTitle: 'Auditproof Mileage',
      notificationBody: 'Trip in progress',
    },
  });
}

async function stopBackgroundLocationTracking() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error('Location task error:', error);
    return;
  }

  if (data && activeTrip) {
    const { locations } = data;
    const location = locations[0];

    if (location) {
      const coords: Coordinates = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        timestamp: Date.now(),
      };

      if (Date.now() - activeTrip.lastUpdate >= TRIP_UPDATE_INTERVAL) {
        activeTrip.points.push(coords);
        activeTrip.lastUpdate = Date.now();

        await addPointToTrip(activeTrip.id, coords);
      }
    }
  }
});

export async function calculateReimbursement(
  distanceMiles: number
): Promise<number> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'irs_rate_per_mile')
    .maybeSingle();

  const rate = data?.value ? parseFloat(data.value) : 0.67;
  return distanceMiles * rate;
}
