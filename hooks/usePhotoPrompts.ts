import { useState, useEffect } from 'react';
import { getVehicles } from '../src/services/simpleVehicleService';
import { checkEndOfMonthPhotoPrompt } from '../src/services/photoPromptService';

export interface PhotoPromptInfo {
  vehicleId: string;
  vehicleName: string;
  monthYear: string;
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
        const monthYear = await checkEndOfMonthPhotoPrompt(vehicle.id);
        if (monthYear) {
          prompts.push({
            vehicleId: vehicle.id,
            vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
            monthYear,
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
