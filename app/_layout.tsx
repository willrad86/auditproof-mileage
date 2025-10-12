import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { enforceAlwaysOnLocation } from '../src/utils/permissionsEnforcer';
import { initDatabase } from '../src/services/localDbService';

export default function RootLayout() {
  useFrameworkReady();

  useEffect(() => {
    const init = async () => {
      try {
        await initDatabase();
        console.log('Local database initialized');
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
      enforceAlwaysOnLocation();
    };

    init();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
