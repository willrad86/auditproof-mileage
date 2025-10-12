import { sha256 } from 'js-sha256';

export async function hashData(data: string): Promise<string> {
  return sha256(data);
}

export async function hashFile(base64Data: string): Promise<string> {
  return sha256(base64Data);
}

export async function generateTripHash(trip: {
  start_time: string;
  end_time?: string;
  start_coords: any;
  end_coords?: any;
  distance_miles: number;
  points: any[];
  purpose: string;
  notes: string;
}): Promise<string> {
  const dataString = JSON.stringify({
    start_time: trip.start_time,
    end_time: trip.end_time,
    start_coords: trip.start_coords,
    end_coords: trip.end_coords,
    distance_miles: trip.distance_miles,
    points: trip.points,
    purpose: trip.purpose,
    notes: trip.notes,
  });
  return hashData(dataString);
}

export async function generateReportHash(data: {
  trips: any[];
  vehicle: any;
  monthYear: string;
  totalMiles: number;
  photoHashes: { start?: string; end?: string };
  mapHashes: string[];
}): Promise<string> {
  const dataString = JSON.stringify({
    trips: data.trips,
    vehicle: data.vehicle,
    monthYear: data.monthYear,
    totalMiles: data.totalMiles,
    photoHashes: data.photoHashes,
    mapHashes: data.mapHashes,
  });
  return hashData(dataString);
}

export async function verifyReportSignature(
  reportData: string,
  expectedHash: string
): Promise<boolean> {
  const computedHash = await hashData(reportData);
  return computedHash === expectedHash;
}

export function generateReportSignature(hash: string, timestamp: string): string {
  return `Auditproof Mileage Logger Report Signature
SHA256: ${hash}
Timestamp: ${timestamp}`;
}
