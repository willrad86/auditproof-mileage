import { Trip, Coordinates } from '../types';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { calculateDistance, calculateTotalDistance } from '../utils/haversine';
import { generateTripHash } from '../utils/cryptoUtils';
import { geocodeWithFallback } from './geoService';
import {
  getAllTripsLocal,
  getTripByIdLocal,
  getActiveTripLocal,
  createTripLocal,
  updateTripLocal,
  addPointToTripLocal,
  deleteTripLocal,
  getTripsByMonthYearLocal,
} from './localTripDb';
import { getDatabase } from './localDbService';

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
  return getAllTripsLocal(vehicleId);
}

export async function getTripById(id: string): Promise<Trip | null> {
  return getTripByIdLocal(id);
}

export async function getActiveTrip(): Promise<Trip | null> {
  return getActiveTripLocal();
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

  const startAddress = await geocodeWithFallback(startCoords);

  const trip = await createTripLocal(vehicleId, startCoords, startAddress, purpose, notes, false);

  activeTrip = {
    id: trip.id,
    points: [startCoords],
    lastUpdate: Date.now(),
  };

  await startBackgroundLocationTracking();

  return trip;
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

  const endAddress = await geocodeWithFallback(endCoords);

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

  const updatedTrip = await updateTripLocal(tripId, {
    end_time: new Date().toISOString(),
    end_coords: endCoords,
    points: allPoints,
    distance_miles: distanceMiles,
    distance_km: distanceKm,
    end_address: endAddress,
    hash,
    status: 'completed',
  });

  activeTrip = null;

  return updatedTrip;
}

export async function addPointToTrip(tripId: string, coords: Coordinates): Promise<void> {
  const trip = await getTripById(tripId);
  if (!trip) return;

  const updatedPoints = [...trip.points, coords];

  const distanceMiles = calculateTotalDistance(updatedPoints, 'miles');
  const distanceKm = calculateTotalDistance(updatedPoints, 'km');

  await updateTripLocal(tripId, {
    points: updatedPoints,
    distance_miles: distanceMiles,
    distance_km: distanceKm,
  });
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
  return updateTripLocal(tripId, updates);
}

export async function updateTripClassification(
  tripId: string,
  classification: 'unclassified' | 'business' | 'personal' | 'commute' | 'other'
): Promise<Trip> {
  return updateTripDetails(tripId, { classification });
}

export async function deleteTrip(tripId: string): Promise<void> {
  await deleteTripLocal(tripId);
}

export async function getTripsByMonthYear(
  vehicleId: string,
  monthYear: string
): Promise<Trip[]> {
  return getTripsByMonthYearLocal(vehicleId, monthYear);
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
  const db = getDatabase();
  const row = await db.getFirstAsync(
    'SELECT value FROM settings WHERE key = ?',
    ['irs_rate_per_mile']
  );

  const rate = row ? parseFloat((row as any).value) : 0.67;
  return distanceMiles * rate;
}
