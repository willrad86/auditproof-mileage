import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Coordinates } from '../types';
import { calculateDistance } from '../utils/haversine';
import { generateTripHash } from '../utils/cryptoUtils';
import { getAllVehiclesLocal } from './localVehicleDb';
import { geocodeWithFallback } from './geoService';
import { generateStaticMapImage } from './mapService';
import {
  getTripByIdLocal,
  createTripLocal,
  updateTripLocal,
  addPointToTripLocal,
} from './localTripDb';

const AUTO_TRIP_TRACKING_TASK = 'AUTO_TRIP_TRACKING_TASK';

const START_SPEED_MPH = 10;
const STOP_SPEED_MPH = 3;
const STOP_IDLE_MINUTES = 3;
const LOCATION_INTERVAL = 15000;
const START_DURATION_SECONDS = 10;

const MPH_TO_MPS = 0.44704;

interface TripState {
  tripId: string | null;
  points: Coordinates[];
  speedAboveThreshold: boolean;
  speedAboveStartTime: number | null;
  lastSpeedBelowTime: number | null;
  vehicleId: string | null;
}

let tripState: TripState = {
  tripId: null,
  points: [],
  speedAboveThreshold: false,
  speedAboveStartTime: null,
  lastSpeedBelowTime: null,
  vehicleId: null,
};

function mpsToMph(mps: number): number {
  return mps / MPH_TO_MPS;
}

export async function startAutoTripDetection(): Promise<boolean> {
  try {
    const { status: foregroundStatus } =
      await Location.requestForegroundPermissionsAsync();

    if (foregroundStatus !== 'granted') {
      return false;
    }

    const { status: backgroundStatus } =
      await Location.requestBackgroundPermissionsAsync();

    if (backgroundStatus !== 'granted') {
      return false;
    }

    const vehicles = await getAllVehiclesLocal();
    if (vehicles.length === 0) {
      console.log('No vehicles configured for auto-detection');
      return false;
    }

    tripState.vehicleId = vehicles[0].id;

    await Location.startLocationUpdatesAsync(AUTO_TRIP_TRACKING_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: LOCATION_INTERVAL,
      distanceInterval: 0,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Auditproof Mileage',
        notificationBody: 'Auto-detecting trips in background',
      },
    });

    return true;
  } catch (error) {
    console.error('Failed to start auto trip detection:', error);
    return false;
  }
}

export async function stopAutoTripDetection(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(AUTO_TRIP_TRACKING_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(AUTO_TRIP_TRACKING_TASK);
  }

  if (tripState.tripId) {
    await finalizeTrip();
  }

  tripState = {
    tripId: null,
    points: [],
    speedAboveThreshold: false,
    speedAboveStartTime: null,
    lastSpeedBelowTime: null,
    vehicleId: null,
  };
}

export async function isAutoDetectionRunning(): Promise<boolean> {
  return await TaskManager.isTaskRegisteredAsync(AUTO_TRIP_TRACKING_TASK);
}

async function createAutoTrip(startCoords: Coordinates, vehicleId: string): Promise<string> {
  const startAddress = await geocodeWithFallback(startCoords);

  const trip = await createTripLocal(vehicleId, startCoords, startAddress, '', '', true);
  return trip.id;
}

async function addPointToAutoTrip(tripId: string, coords: Coordinates): Promise<void> {
  await addPointToTripLocal(tripId, coords);

  const trip = await getTripByIdLocal(tripId);
  if (!trip) return;

  const updatedPoints = trip.points;

  let distanceMiles = trip.distance_miles;
  let distanceKm = trip.distance_km;

  if (updatedPoints.length > 1) {
    const lastPoint = updatedPoints[updatedPoints.length - 2];
    const segmentMiles = calculateDistance(lastPoint, coords, 'miles');
    const segmentKm = calculateDistance(lastPoint, coords, 'km');
    distanceMiles += segmentMiles;
    distanceKm += segmentKm;

    await updateTripLocal(tripId, {
      distance_miles: distanceMiles,
      distance_km: distanceKm,
    });
  }
}

async function finalizeTrip(): Promise<void> {
  if (!tripState.tripId) return;

  try {
    const trip = await getTripByIdLocal(tripState.tripId);
    if (!trip) return;

    const endCoords = tripState.points[tripState.points.length - 1];

    const hash = await generateTripHash({
      start_time: trip.start_time,
      end_time: new Date().toISOString(),
      start_coords: trip.start_coords,
      end_coords: endCoords,
      distance_miles: trip.distance_miles,
      points: trip.points,
      purpose: trip.purpose,
      notes: trip.notes,
    });

    const startAddress = await geocodeWithFallback(trip.start_coords);
    const endAddress = await geocodeWithFallback(endCoords);

    await updateTripLocal(tripState.tripId, {
      end_time: new Date().toISOString(),
      end_coords: endCoords,
      hash,
      status: 'completed',
      start_address: startAddress,
      end_address: endAddress,
    });

    if (trip.vehicle_id) {
      const mapData = await generateStaticMapImage(
        tripState.tripId,
        trip.vehicle_id,
        trip.start_coords,
        endCoords,
        trip.points
      );

      if (mapData) {
        await updateTripLocal(tripState.tripId, {
          map_image_uri: mapData.uri,
        });
      }
    }
  } catch (error) {
    console.error('Error finalizing trip:', error);
  }

  tripState.tripId = null;
  tripState.points = [];
}

TaskManager.defineTask(AUTO_TRIP_TRACKING_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error('Auto trip tracking error:', error);
    return;
  }

  if (!data || !tripState.vehicleId) return;

  const { locations } = data;
  const location = locations[0];

  if (!location) return;

  const speedMph = location.coords.speed ? mpsToMph(location.coords.speed) : 0;
  const coords: Coordinates = {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    timestamp: Date.now(),
  };

  const now = Date.now();

  if (speedMph >= START_SPEED_MPH) {
    if (!tripState.speedAboveThreshold) {
      tripState.speedAboveThreshold = true;
      tripState.speedAboveStartTime = now;
    }

    if (
      !tripState.tripId &&
      tripState.speedAboveStartTime &&
      now - tripState.speedAboveStartTime >= START_DURATION_SECONDS * 1000
    ) {
      try {
        tripState.tripId = await createAutoTrip(coords, tripState.vehicleId);
        tripState.points = [coords];
        tripState.lastSpeedBelowTime = null;
      } catch (error) {
        console.error('Failed to create auto trip:', error);
      }
    }

    tripState.lastSpeedBelowTime = null;
  } else if (speedMph < STOP_SPEED_MPH) {
    tripState.speedAboveThreshold = false;
    tripState.speedAboveStartTime = null;

    if (tripState.tripId) {
      if (!tripState.lastSpeedBelowTime) {
        tripState.lastSpeedBelowTime = now;
      }

      const idleMinutes = (now - tripState.lastSpeedBelowTime) / (1000 * 60);

      if (idleMinutes >= STOP_IDLE_MINUTES) {
        await finalizeTrip();
      }
    }
  }

  if (tripState.tripId) {
    tripState.points.push(coords);
    await addPointToAutoTrip(tripState.tripId, coords);
  }
});

export async function getAutoDetectionStatus(): Promise<{
  running: boolean;
  activeTrip: string | null;
}> {
  const running = await isAutoDetectionRunning();
  return {
    running,
    activeTrip: tripState.tripId,
  };
}
