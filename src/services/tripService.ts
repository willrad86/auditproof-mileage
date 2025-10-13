export {
  getAllTripsLocal as getAllTrips,
  getTripByIdLocal as getTripById,
  createTripLocal as createTrip,
  updateTripLocal as updateTrip,
  addPointToTripLocal as addPointToTrip,
  getActiveTripLocal as getActiveTrip,
  stopTripLocal as stopTrip,
  getAllTripsForVehicleLocal as getAllTripsForVehicle,
  getAllTripsForMonthLocal as getAllTripsForMonth,
  getAllTripsForMonthLocal as getTripsByMonthYear,
  getTripsNeedingLookupLocal as getTripsNeedingLookup,
  markTripLookedUpLocal as markTripLookedUp,
  getUnclassifiedTripsCountLocal as getUnclassifiedTripsCount,
  getBusinessTripsForMonthLocal as getBusinessTripsForMonth,
  getAllBusinessTripsLocal as getAllBusinessTrips,
} from './localTripDb';

import { Trip, Coordinates } from '../types';
import { createTripLocal, addPointToTripLocal } from './localTripDb';
import { getCurrentMonthYear } from './odometerPhotoService';

export async function startTrip(
  vehicleId: string,
  startCoords: Coordinates,
  purpose: string,
  notes: string
): Promise<Trip> {
  const startAddress = '';
  return await createTripLocal(vehicleId, startCoords, startAddress, purpose, notes, false);
}

export async function updateTripDetails(tripId: string, purpose: string, notes: string): Promise<void> {
  const { updateTripLocal } = await import('./localTripDb');
  await updateTripLocal(tripId, { purpose, notes });
}

export async function updateTripClassification(
  tripId: string,
  classification: 'business' | 'personal' | 'commute' | 'other'
): Promise<void> {
  const { updateTripLocal } = await import('./localTripDb');
  await updateTripLocal(tripId, { classification });
}

export function calculateReimbursement(distanceMiles: number, ratePerMile: number): number {
  return distanceMiles * ratePerMile;
}
