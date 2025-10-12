import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { Alert } from 'react-native';

export async function enforceAlwaysOnLocation(): Promise<boolean> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    const res = await Location.requestForegroundPermissionsAsync();
    if (res.status !== 'granted') {
      Alert.alert(
        'Location Required',
        'Auditproof Mileage Logger needs location access at all times to automatically detect trips.',
        [{ text: 'Open Settings', onPress: () => Linking.openSettings() }]
      );
      return false;
    }
  }

  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    const res = await Location.requestBackgroundPermissionsAsync();
    if (res.status !== 'granted') {
      Alert.alert(
        'Background Access Required',
        'Please enable "Allow all the time" location access so the app can track trips automatically.',
        [{ text: 'Open Settings', onPress: () => Linking.openSettings() }]
      );
      return false;
    }
  }

  return true;
}
