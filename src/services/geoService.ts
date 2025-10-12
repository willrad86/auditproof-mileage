import axios from 'axios';
import { Coordinates } from '../types';
import * as Network from 'expo-network';

let isOnline = true;

export async function checkNetworkStatus(): Promise<boolean> {
  try {
    const networkState = await Network.getNetworkStateAsync();
    isOnline = networkState.isConnected ?? false;
    return isOnline;
  } catch (error) {
    isOnline = false;
    return false;
  }
}

export async function reverseGeocode(coords: Coordinates): Promise<string | null> {
  try {
    const online = await checkNetworkStatus();
    if (!online) {
      return null;
    }

    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse`,
      {
        params: {
          lat: coords.lat,
          lon: coords.lng,
          format: 'json',
          zoom: 18,
          addressdetails: 1,
        },
        headers: {
          'User-Agent': 'AuditproofMileage/1.0',
        },
        timeout: 5000,
      }
    );

    if (response.data && response.data.display_name) {
      return response.data.display_name;
    }

    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

export async function forwardGeocode(address: string): Promise<Coordinates | null> {
  try {
    const online = await checkNetworkStatus();
    if (!online) {
      return null;
    }

    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search`,
      {
        params: {
          q: address,
          format: 'json',
          limit: 1,
        },
        headers: {
          'User-Agent': 'AuditproofMileage/1.0',
        },
        timeout: 5000,
      }
    );

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
      };
    }

    return null;
  } catch (error) {
    console.error('Forward geocoding error:', error);
    return null;
  }
}

export function getOfflineFallbackAddress(coords: Coordinates): string {
  return `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
}

export async function geocodeWithFallback(
  coords: Coordinates
): Promise<string> {
  const address = await reverseGeocode(coords);
  return address || getOfflineFallbackAddress(coords);
}

export async function lookupAddress(lat: number, lon: number): Promise<string> {
  try {
    const online = await checkNetworkStatus();
    if (!online) {
      return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    }

    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse`,
      {
        params: {
          lat,
          lon,
          format: 'json',
          zoom: 18,
        },
        headers: {
          'User-Agent': 'AuditproofMileage/1.0',
        },
        timeout: 5000,
      }
    );

    if (response.data && response.data.display_name) {
      return response.data.display_name;
    }

    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  } catch (error) {
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }
}
