import { reverseGeocode } from './geoService';
import { getTripsNeedingLookupLocal, updateTripLocal } from './localTripDb';
import { isAddressOffline } from './localDbService';

export async function resolvePendingAddresses(): Promise<{
  total: number;
  resolved: number;
  failed: number;
}> {
  const trips = await getTripsNeedingLookupLocal();

  let resolved = 0;
  let failed = 0;

  for (const trip of trips) {
    let startAddressResolved = false;
    let endAddressResolved = false;

    if (trip.start_address && isAddressOffline(trip.start_address)) {
      const resolvedStart = await reverseGeocode(trip.start_coords);
      if (resolvedStart) {
        await updateTripLocal(trip.id, {
          start_address: resolvedStart,
        });
        startAddressResolved = true;
      }
    } else {
      startAddressResolved = true;
    }

    if (trip.end_address && isAddressOffline(trip.end_address)) {
      if (trip.end_coords) {
        const resolvedEnd = await reverseGeocode(trip.end_coords);
        if (resolvedEnd) {
          await updateTripLocal(trip.id, {
            end_address: resolvedEnd,
          });
          endAddressResolved = true;
        }
      }
    } else {
      endAddressResolved = true;
    }

    if (startAddressResolved && endAddressResolved) {
      await updateTripLocal(trip.id, {
        needs_lookup: false,
      });
      resolved++;
    } else {
      failed++;
    }
  }

  return {
    total: trips.length,
    resolved,
    failed,
  };
}

export async function getPendingAddressCount(): Promise<number> {
  const trips = await getTripsNeedingLookupLocal();
  return trips.length;
}

export async function resolveAddressForTrip(tripId: string): Promise<boolean> {
  const { getTripByIdLocal } = await import('./localTripDb');
  const trip = await getTripByIdLocal(tripId);

  if (!trip) return false;

  let startResolved = true;
  let endResolved = true;

  if (trip.start_address && isAddressOffline(trip.start_address)) {
    const resolvedStart = await reverseGeocode(trip.start_coords);
    if (resolvedStart) {
      await updateTripLocal(tripId, {
        start_address: resolvedStart,
      });
    } else {
      startResolved = false;
    }
  }

  if (trip.end_address && isAddressOffline(trip.end_address) && trip.end_coords) {
    const resolvedEnd = await reverseGeocode(trip.end_coords);
    if (resolvedEnd) {
      await updateTripLocal(tripId, {
        end_address: resolvedEnd,
      });
    } else {
      endResolved = false;
    }
  }

  if (startResolved && endResolved) {
    await updateTripLocal(tripId, {
      needs_lookup: false,
    });
    return true;
  }

  return false;
}
