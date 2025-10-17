import { useState, useEffect } from 'react';
import { getVehicles } from '../src/services/simpleVehicleService';
import { checkEndOfMonthPhotoPrompt, checkStartOfMonthPhotoPrompt } from '../src/services/photoPromptService';

export interface PhotoPromptInfo {
  vehicleId: string;
  vehicleName: string;
  monthYear: string;
  type: 'start' | 'end';
}

export function usePhotoPrompts() {
  const [pendingPrompts, setPendingPrompts] = useState<PhotoPromptInfo[]>([]);
  const [loading, setLoading] = useState(false);

  async function checkForPrompts() {
    try {
      setLoading(true);
      const vehicles = await getVehicles();
      const prompts: PhotoPromptInfo[] = [];

      for (const vehicle of vehicles) {
        // Check for end-of-month photo (previous month)
        const endMonthYear = await checkEndOfMonthPhotoPrompt(vehicle.id);
        if (endMonthYear) {
          prompts.push({
            vehicleId: vehicle.id,
            vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
            monthYear: endMonthYear,
            type: 'end',
          });
        }

        // Check for start-of-month photo (current month)
        const startMonthYear = await checkStartOfMonthPhotoPrompt(vehicle.id);
        if (startMonthYear) {
          prompts.push({
            vehicleId: vehicle.id,
            vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
            monthYear: startMonthYear,
            type: 'start',
          });
        }
      }

      setPendingPrompts(prompts);
    } catch (error) {
      console.error('Error checking photo prompts:', error);
    } finally {
      setLoading(false);
    }
  }

  function clearPrompt(vehicleId: string) {
    setPendingPrompts((prev) => prev.filter((p) => p.vehicleId !== vehicleId));
  }

  useEffect(() => {
    checkForPrompts();
  }, []);

  return {
    pendingPrompts,
    loading,
    checkForPrompts,
    clearPrompt,
  };
}
