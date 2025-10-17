import * as SQLite from 'expo-sqlite';
import { initDatabase } from './simpleVehicleService';
import { getMonthlyRecordsByVehicle, getCurrentMonthYear } from './odometerPhotoService';
import { generateUUID } from '../utils/uuid';

/**
 * This service controls whether the app should prompt a user
 * to take a starting odometer photo for a newly added vehicle.
 *
 * It ensures prompts are shown once per vehicle per month.
 */

/** Ensures the prompt tracking table exists. */
export async function initPromptTable(): Promise<void> {
  const db = await initDatabase();
  db.execSync(`
    CREATE TABLE IF NOT EXISTS photo_prompts (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      month_year TEXT NOT NULL,
      shown INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );
  `);
}

/**
 * Checks whether a new vehicle requires a start photo this month.
 * Returns true if there is no start photo recorded yet for the current month.
 */
export async function checkNewVehicleNeedsStartPhoto(vehicle_id: string): Promise<boolean> {
  try {
    const db = await initDatabase();
    await initPromptTable();

    const month = getCurrentMonthYear();

    // First check if we’ve already recorded any photos for this month
    const monthlyRecords = await getMonthlyRecordsByVehicle(vehicle_id);
    const thisMonth = monthlyRecords.find(r => r.month_year === month);

    // If already has a start photo → no need to prompt
    if (thisMonth && thisMonth.start_photo) return false;

    // If we already marked a prompt as shown this month → skip
    const existing = db.getFirstSync(
      'SELECT * FROM photo_prompts WHERE vehicle_id = ? AND month_year = ?',
      [vehicle_id, month]
    );
    if (existing && existing.shown === 1) return false;

    // Otherwise, create a new prompt record and signal the app to show the modal
    const id = generateUUID();
    const now = new Date().toISOString();
    db.runSync(
      `INSERT OR REPLACE INTO photo_prompts (id, vehicle_id, month_year, shown, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, vehicle_id, month, 0, now]
    );

    console.log(`📸 Prompt created for vehicle ${vehicle_id} (${month})`);
    return true;
  } catch (error) {
    console.error('❌ Error checking start photo prompt:', error);
    return false;
  }
}

/**
 * Marks that a photo prompt has been displayed and acknowledged
 * so the user isn’t asked again for that vehicle this month.
 */
export async function markPromptShown(vehicle_id: string): Promise<void> {
  try {
    const db = await initDatabase();
    await initPromptTable();
    const month = getCurrentMonthYear();

    const row = db.getFirstSync(
      'SELECT * FROM photo_prompts WHERE vehicle_id = ? AND month_year = ?',
      [vehicle_id, month]
    );

    if (row) {
      db.runSync(
        'UPDATE photo_prompts SET shown = 1 WHERE vehicle_id = ? AND month_year = ?',
        [vehicle_id, month]
      );
    } else {
      const id = generateUUID();
      const now = new Date().toISOString();
      db.runSync(
        'INSERT INTO photo_prompts (id, vehicle_id, month_year, shown, created_at) VALUES (?, ?, ?, ?, ?)',
        [id, vehicle_id, month, 1, now]
      );
    }

    console.log(`✅ Prompt marked as shown for ${vehicle_id} (${month})`);
  } catch (error) {
    console.error('❌ Error marking prompt as shown:', error);
  }
}

/**
 * Checks if a vehicle needs an end-of-month odometer photo.
 * Returns the month-year string if an end photo is missing for the previous month.
 */
export async function checkEndOfMonthPhotoPrompt(vehicle_id: string): Promise<string | null> {
  try {
    const db = await initDatabase();
    await initPromptTable();

    const currentMonth = getCurrentMonthYear();
    const monthlyRecords = await getMonthlyRecordsByVehicle(vehicle_id);

    // Get previous month
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevMonthDate.getFullYear()}-${(prevMonthDate.getMonth() + 1)
      .toString()
      .padStart(2, '0')}`;

    // Check if previous month has an end photo
    const prevMonthRecord = monthlyRecords.find(r => r.month_year === prevMonth);

    // If there's a start photo but no end photo for previous month
    if (prevMonthRecord && prevMonthRecord.start_photo && !prevMonthRecord.end_photo) {
      // Check if we've already prompted for this
      const existing = db.getFirstSync(
        'SELECT * FROM photo_prompts WHERE vehicle_id = ? AND month_year = ? AND shown = 1',
        [vehicle_id, prevMonth]
      );

      // Only prompt if we haven't already shown this prompt
      if (!existing) {
        console.log(`📸 End-of-month photo needed for vehicle ${vehicle_id} (${prevMonth})`);
        return prevMonth;
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Error checking end-of-month photo prompt:', error);
    return null;
  }
}

/**
 * Marks that an end-of-month prompt has been shown and acknowledged.
 */
export async function markEndOfMonthPromptShown(vehicle_id: string, month_year: string): Promise<void> {
  try {
    const db = await initDatabase();
    await initPromptTable();

    const existing = db.getFirstSync(
      'SELECT * FROM photo_prompts WHERE vehicle_id = ? AND month_year = ?',
      [vehicle_id, month_year]
    );

    if (existing) {
      db.runSync(
        'UPDATE photo_prompts SET shown = 1 WHERE vehicle_id = ? AND month_year = ?',
        [vehicle_id, month_year]
      );
    } else {
      const id = generateUUID();
      const now = new Date().toISOString();
      db.runSync(
        'INSERT INTO photo_prompts (id, vehicle_id, month_year, shown, created_at) VALUES (?, ?, ?, ?, ?)',
        [id, vehicle_id, month_year, 1, now]
      );
    }

    console.log(`✅ End-of-month prompt marked as shown for ${vehicle_id} (${month_year})`);
  } catch (error) {
    console.error('❌ Error marking end-of-month prompt as shown:', error);
  }
}

/**
 * Clears old prompt records (optional housekeeping).
 * Call monthly or on DB cleanup.
 */
export async function clearOldPrompts(): Promise<void> {
  try {
    const db = await initDatabase();
    await initPromptTable();

    // Keep only the last 6 months of records
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    const cutoffStr = `${cutoff.getFullYear()}-${(cutoff.getMonth() + 1)
      .toString()
      .padStart(2, '0')}`;

    db.runSync('DELETE FROM photo_prompts WHERE month_year < ?', [cutoffStr]);
    console.log('🧹 Cleared old photo prompt records');
  } catch (error) {
    console.error('❌ Error clearing old prompts:', error);
  }
}
