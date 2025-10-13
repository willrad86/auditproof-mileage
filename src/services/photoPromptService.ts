import { getCurrentMonthYear, checkMissingPhotos } from './odometerPhotoService';
import { getVehicles } from './simpleVehicleService';

export interface PhotoPrompt {
  vehicleId: string;
  vehicleName: string;
  promptType: 'start' | 'end';
  monthYear: string;
}

export async function checkForPhotoPrompts(): Promise<PhotoPrompt[]> {
  return [];
}

export async function markPromptShown(vehicleId: string, promptType: 'start' | 'end'): Promise<void> {
  // Simplified - no persistence
}

export async function checkNewVehicleNeedsStartPhoto(vehicleId: string): Promise<boolean> {
  const currentMonthYear = getCurrentMonthYear();
  const now = new Date();

  if (now.getDate() === 1) {
    return false;
  }

  const missing = await checkMissingPhotos(vehicleId, currentMonthYear);
  return missing.needsStart;
}
