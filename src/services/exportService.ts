import * as FileSystem from 'expo-file-system';
import { Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from '../utils/supabaseClient';
import { Trip, Vehicle, ReportMetadata } from '../types';
import {
  generateReportHash,
  generateReportSignature,
} from '../utils/cryptoUtils';
import { getTripsByMonthYear, calculateReimbursement, getAllTrips } from './tripService';
import { getVehicleById, getVehicleOdometerPhotos } from './vehicleService';
import { getAllMapImages } from './mapService';

const EXPORTS_DIR = `${Paths.document.uri}exports/`;

async function ensureExportsDirectory() {
  const dirInfo = await FileSystem.getInfoAsync(EXPORTS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(EXPORTS_DIR, { intermediates: true });
  }
}

export async function generateCSV(trips: Trip[]): Promise<string> {
  const headers = [
    'Trip ID',
    'Date',
    'Start Time',
    'End Time',
    'Start Location',
    'End Location',
    'Distance (miles)',
    'Distance (km)',
    'Purpose',
    'Notes',
    'Reimbursement',
  ];

  let csv = headers.join(',') + '\n';

  for (const trip of trips) {
    const reimbursement = await calculateReimbursement(trip.distance_miles);
    const row = [
      trip.id,
      new Date(trip.start_time).toLocaleDateString(),
      new Date(trip.start_time).toLocaleTimeString(),
      trip.end_time ? new Date(trip.end_time).toLocaleTimeString() : '',
      trip.start_address || `${trip.start_coords.lat}, ${trip.start_coords.lng}`,
      trip.end_address || (trip.end_coords ? `${trip.end_coords.lat}, ${trip.end_coords.lng}` : ''),
      trip.distance_miles.toFixed(2),
      trip.distance_km.toFixed(2),
      `"${trip.purpose.replace(/"/g, '""')}"`,
      `"${trip.notes.replace(/"/g, '""')}"`,
      `$${reimbursement.toFixed(2)}`,
    ];
    csv += row.join(',') + '\n';
  }

  return csv;
}

export async function generateJSON(
  trips: Trip[],
  vehicle: Vehicle,
  monthYear: string
): Promise<string> {
  const tripsData = await Promise.all(
    trips.map(async (trip) => {
      const reimbursement = await calculateReimbursement(trip.distance_miles);
      return {
        id: trip.id,
        date: new Date(trip.start_time).toISOString(),
        startTime: trip.start_time,
        endTime: trip.end_time,
        startLocation: trip.start_address || trip.start_coords,
        endLocation: trip.end_address || trip.end_coords,
        distanceMiles: trip.distance_miles,
        distanceKm: trip.distance_km,
        purpose: trip.purpose,
        notes: trip.notes,
        reimbursement,
        hash: trip.hash,
      };
    })
  );

  const data = {
    vehicle: {
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      licensePlate: vehicle.license_plate,
    },
    monthYear,
    trips: tripsData,
    summary: {
      totalTrips: trips.length,
      totalMiles: trips.reduce((sum, t) => sum + t.distance_miles, 0),
      totalKm: trips.reduce((sum, t) => sum + t.distance_km, 0),
      totalReimbursement: await Promise.all(
        trips.map((t) => calculateReimbursement(t.distance_miles))
      ).then((values) => values.reduce((sum, val) => sum + val, 0)),
    },
  };

  return JSON.stringify(data, null, 2);
}

export async function generateMetadata(
  vehicle: Vehicle,
  monthYear: string,
  trips: Trip[],
  hash: string,
  photoHashes: { start?: string; end?: string },
  mapImagesCount: number
): Promise<ReportMetadata> {
  const totalMiles = trips.reduce((sum, t) => sum + t.distance_miles, 0);
  const totalReimbursement = await Promise.all(
    trips.map((t) => calculateReimbursement(t.distance_miles))
  ).then((values) => values.reduce((sum, val) => sum + val, 0));

  return {
    vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    month: monthYear,
    totalMiles,
    totalValue: totalReimbursement,
    hash,
    signatureCreatedAt: new Date().toISOString(),
    mapImages: mapImagesCount,
    photos: {
      start: photoHashes.start || '',
      end: photoHashes.end || '',
    },
  };
}

export async function exportMonthlyReport(
  vehicleId: string,
  monthYear: string
): Promise<string> {
  await ensureExportsDirectory();

  const vehicle = await getVehicleById(vehicleId);
  if (!vehicle) throw new Error('Vehicle not found');

  const allTrips = await getTripsByMonthYear(vehicleId, monthYear);
  const trips = allTrips.filter((t) => t.classification === 'business');

  if (trips.length === 0) throw new Error('No business trips found for this period');

  const photos = await getVehicleOdometerPhotos(vehicleId);
  const mapImages = await getAllMapImages(vehicleId, monthYear);

  const csv = await generateCSV(trips);
  const json = await generateJSON(trips, vehicle, monthYear);

  const hash = await generateReportHash({
    trips,
    vehicle,
    monthYear,
    totalMiles: trips.reduce((sum, t) => sum + t.distance_miles, 0),
    photoHashes: {
      start: photos.startHash,
      end: photos.endHash,
    },
    mapHashes: mapImages,
  });

  const signature = generateReportSignature(hash, new Date().toISOString());

  const metadata = await generateMetadata(
    vehicle,
    monthYear,
    trips,
    hash,
    { start: photos.startHash, end: photos.endHash },
    mapImages.length
  );

  const reportDir = `${EXPORTS_DIR}${vehicleId}_${monthYear}/`;
  await FileSystem.makeDirectoryAsync(reportDir, { intermediates: true });

  await FileSystem.writeAsStringAsync(`${reportDir}trips.csv`, csv);
  await FileSystem.writeAsStringAsync(`${reportDir}trips.json`, json);
  await FileSystem.writeAsStringAsync(
    `${reportDir}metadata.json`,
    JSON.stringify(metadata, null, 2)
  );
  await FileSystem.writeAsStringAsync(`${reportDir}report_signature.txt`, signature);

  if (photos.start) {
    const photoInfo = await FileSystem.getInfoAsync(photos.start);
    if (photoInfo.exists) {
      await FileSystem.copyAsync({
        from: photos.start,
        to: `${reportDir}start_odometer.jpg`,
      });
    }
  }

  if (photos.end) {
    const photoInfo = await FileSystem.getInfoAsync(photos.end);
    if (photoInfo.exists) {
      await FileSystem.copyAsync({
        from: photos.end,
        to: `${reportDir}end_odometer.jpg`,
      });
    }
  }

  const mapsDir = `${reportDir}maps/`;
  await FileSystem.makeDirectoryAsync(mapsDir, { intermediates: true });

  for (let i = 0; i < mapImages.length; i++) {
    const mapUri = mapImages[i];
    const mapInfo = await FileSystem.getInfoAsync(mapUri);
    if (mapInfo.exists) {
      const fileName = mapUri.split('/').pop() || `map_${i}.png`;
      await FileSystem.copyAsync({
        from: mapUri,
        to: `${mapsDir}${fileName}`,
      });
    }
  }

  await supabase.from('reports').insert({
    vehicle_id: vehicleId,
    month_year: monthYear,
    total_miles: trips.reduce((sum, t) => sum + t.distance_miles, 0),
    total_km: trips.reduce((sum, t) => sum + t.distance_km, 0),
    total_value: metadata.totalValue,
    trip_count: trips.length,
    report_hash: hash,
    signature,
    signed_at: new Date().toISOString(),
    export_uri: reportDir,
  });

  return reportDir;
}

export async function shareReport(reportDir: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device');
  }

  const files = await FileSystem.readDirectoryAsync(reportDir);
  const mainFiles = files.filter(
    (f) => f.endsWith('.csv') || f.endsWith('.json') || f.endsWith('.txt')
  );

  if (mainFiles.length > 0) {
    await Sharing.shareAsync(`${reportDir}${mainFiles[0]}`);
  }
}

export async function verifyReport(
  reportDir: string
): Promise<{ valid: boolean; message: string }> {
  try {
    const metadataPath = `${reportDir}metadata.json`;
    const metadataContent = await FileSystem.readAsStringAsync(metadataPath);
    const metadata: ReportMetadata = JSON.parse(metadataContent);

    const jsonPath = `${reportDir}trips.json`;
    const jsonContent = await FileSystem.readAsStringAsync(jsonPath);

    const computedHash = await generateReportHash({
      trips: JSON.parse(jsonContent).trips,
      vehicle: JSON.parse(jsonContent).vehicle,
      monthYear: metadata.month,
      totalMiles: metadata.totalMiles,
      photoHashes: metadata.photos,
      mapHashes: [],
    });

    if (computedHash === metadata.hash) {
      return {
        valid: true,
        message: 'Report signature verified successfully',
      };
    } else {
      return {
        valid: false,
        message: 'Report signature verification failed - data may have been tampered',
      };
    }
  } catch (error) {
    return {
      valid: false,
      message: `Verification error: ${error}`,
    };
  }
}
