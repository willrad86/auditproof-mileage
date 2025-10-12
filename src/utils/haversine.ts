import { Coordinates } from '../types';

const EARTH_RADIUS_MILES = 3958.8;
const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function calculateDistance(
  coord1: Coordinates,
  coord2: Coordinates,
  unit: 'miles' | 'km' = 'miles'
): number {
  const lat1 = toRadians(coord1.lat);
  const lat2 = toRadians(coord2.lat);
  const deltaLat = toRadians(coord2.lat - coord1.lat);
  const deltaLng = toRadians(coord2.lng - coord1.lng);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const radius = unit === 'miles' ? EARTH_RADIUS_MILES : EARTH_RADIUS_KM;
  return radius * c;
}

export function calculateTotalDistance(
  points: Coordinates[],
  unit: 'miles' | 'km' = 'miles'
): number {
  if (points.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalDistance += calculateDistance(points[i], points[i + 1], unit);
  }

  return totalDistance;
}
