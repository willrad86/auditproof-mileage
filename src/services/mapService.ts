import * as FileSystem from 'expo-file-system';
import { Paths } from 'expo-file-system';
import { Coordinates } from '../types';
import axios from 'axios';
import { hashFile } from '../utils/cryptoUtils';

const MAPS_DIR = `${Paths.document.uri}maps/`;

async function ensureMapsDirectory(vehicleId: string, monthYear: string) {
  const dirPath = `${MAPS_DIR}${vehicleId}/${monthYear}/`;
  const dirInfo = await FileSystem.getInfoAsync(dirPath);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
  }
  return dirPath;
}

function encodePolyline(coordinates: Coordinates[]): string {
  if (coordinates.length < 2) return '';

  let encoded = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const coord of coordinates) {
    const lat = Math.round(coord.lat * 1e5);
    const lng = Math.round(coord.lng * 1e5);

    const dLat = lat - prevLat;
    const dLng = lng - prevLng;

    encoded += encodeValue(dLat);
    encoded += encodeValue(dLng);

    prevLat = lat;
    prevLng = lng;
  }

  return encoded;
}

function encodeValue(value: number): string {
  let encoded = '';
  let num = value < 0 ? ~(value << 1) : value << 1;

  while (num >= 0x20) {
    encoded += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }

  encoded += String.fromCharCode(num + 63);
  return encoded;
}

export async function generateStaticMapImage(
  tripId: string,
  vehicleId: string,
  startCoords: Coordinates,
  endCoords: Coordinates,
  routePoints: Coordinates[]
): Promise<{ uri: string; hash: string } | null> {
  try {
    const monthYear = new Date().toISOString().slice(0, 7);
    const dirPath = await ensureMapsDirectory(vehicleId, monthYear);
    const fileName = `${tripId}.png`;
    const filePath = `${dirPath}${fileName}`;

    const centerLat = (startCoords.lat + endCoords.lat) / 2;
    const centerLng = (startCoords.lng + endCoords.lng) / 2;

    const latDiff = Math.abs(startCoords.lat - endCoords.lat);
    const lngDiff = Math.abs(startCoords.lng - endCoords.lng);
    const maxDiff = Math.max(latDiff, lngDiff);

    let zoom = 13;
    if (maxDiff > 0.1) zoom = 11;
    if (maxDiff > 0.5) zoom = 9;
    if (maxDiff > 1.0) zoom = 7;

    const width = 600;
    const height = 400;

    const markerStart = `${startCoords.lat},${startCoords.lng}`;
    const markerEnd = `${endCoords.lat},${endCoords.lng}`;

    const osmUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${centerLat},${centerLng}&zoom=${zoom}&size=${width}x${height}&markers=${markerStart},greena|${markerEnd},redb`;

    const response = await axios.get(osmUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });

    const base64Image = Buffer.from(response.data, 'binary').toString('base64');

    await FileSystem.writeAsStringAsync(filePath, base64Image, {
      encoding: 'base64' as any,
    });

    const hash = await hashFile(base64Image);

    return { uri: filePath, hash };
  } catch (error) {
    console.error('Error generating static map:', error);
    return null;
  }
}

export async function getMapImageForTrip(
  tripId: string,
  vehicleId: string,
  monthYear: string
): Promise<string | null> {
  const filePath = `${MAPS_DIR}${vehicleId}/${monthYear}/${tripId}.png`;
  const fileInfo = await FileSystem.getInfoAsync(filePath);

  if (fileInfo.exists) {
    return filePath;
  }

  return null;
}

export async function getAllMapImages(
  vehicleId: string,
  monthYear: string
): Promise<string[]> {
  const dirPath = `${MAPS_DIR}${vehicleId}/${monthYear}/`;
  const dirInfo = await FileSystem.getInfoAsync(dirPath);

  if (!dirInfo.exists) {
    return [];
  }

  const files = await FileSystem.readDirectoryAsync(dirPath);
  return files.map((file) => `${dirPath}${file}`);
}

export async function deleteMapImage(uri: string): Promise<void> {
  const fileInfo = await FileSystem.getInfoAsync(uri);
  if (fileInfo.exists) {
    await FileSystem.deleteAsync(uri);
  }
}
