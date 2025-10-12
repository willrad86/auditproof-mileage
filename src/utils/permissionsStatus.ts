import * as Location from 'expo-location';

export type TrackingStatus = 'active' | 'limited' | 'off';

export async function getTrackingStatus(): Promise<TrackingStatus> {
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status === 'granted') return 'active';
  if (bg.status === 'denied') return 'off';
  return 'limited';
}
