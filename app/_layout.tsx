import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { initDatabase } from '@/src/services/simpleVehicleService';

export default function RootLayout() {
  useFrameworkReady();

  useEffect(() => {
    async function init() {
      try {
        await initDatabase();
        console.log('✅ App and database initialized');
      } catch (error) {
        console.error('❌ Failed to initialize database:', error);
      }
    }
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
