import { initDatabase } from './simpleVehicleService';
import { getMonthlyRecordsByVehicle } from './odometerPhotoService';

export interface TripTypeStats {
  business: number;
  commute: number;
  personal: number;
  total: number;
}

export interface VehicleStats {
  vehicleId: string;
  vehicleName: string;
  monthly: TripTypeStats;
  ytd: TripTypeStats;
  allTime: TripTypeStats;
  auditCompleteness: {
    totalMonths: number;
    completeMonths: number;
    missingStartPhotos: number;
    missingEndPhotos: number;
    completenessPercentage: number;
  };
}

export interface OverallStats {
  monthly: TripTypeStats;
  ytd: TripTypeStats;
  allTime: TripTypeStats;
  vehicleCount: number;
  totalTrips: number;
}

function createEmptyStats(): TripTypeStats {
  return { business: 0, commute: 0, personal: 0, total: 0 };
}

function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return {
    start: `${year}-${month}-01`,
    end: `${year}-${month}-31`,
  };
}

function getYTDRange(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
}

async function calculateTripStats(
  vehicleId: string | null,
  startDate: string | null,
  endDate: string | null
): Promise<TripTypeStats> {
  try {
    const db = await initDatabase();
    const stats = createEmptyStats();

    let query = 'SELECT trip_type, distance FROM trips WHERE 1=1';
    const params: any[] = [];

    if (vehicleId) {
      query += ' AND vehicle_id = ?';
      params.push(vehicleId);
    }

    if (startDate) {
      query += ' AND start_time >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND start_time <= ?';
      params.push(endDate + ' 23:59:59');
    }

    const rows = db.getAllSync(query, params);

    for (const row of rows) {
      const distance = row.distance || 0;
      const tripType = (row.trip_type || 'personal').toLowerCase();

      stats.total += distance;

      if (tripType === 'business') {
        stats.business += distance;
      } else if (tripType === 'commute') {
        stats.commute += distance;
      } else {
        stats.personal += distance;
      }
    }

    return stats;
  } catch (error) {
    console.error('Error calculating trip stats:', error);
    return createEmptyStats();
  }
}

async function calculateAuditCompleteness(vehicleId: string) {
  try {
    const records = await getMonthlyRecordsByVehicle(vehicleId);
    let totalMonths = records.length;
    let completeMonths = 0;
    let missingStartPhotos = 0;
    let missingEndPhotos = 0;

    for (const record of records) {
      if (!record.start_photo) missingStartPhotos++;
      if (!record.end_photo) missingEndPhotos++;
      if (record.start_photo && record.end_photo) completeMonths++;
    }

    const completenessPercentage =
      totalMonths > 0 ? Math.round((completeMonths / totalMonths) * 100) : 0;

    return {
      totalMonths,
      completeMonths,
      missingStartPhotos,
      missingEndPhotos,
      completenessPercentage,
    };
  } catch (error) {
    console.error('Error calculating audit completeness:', error);
    return {
      totalMonths: 0,
      completeMonths: 0,
      missingStartPhotos: 0,
      missingEndPhotos: 0,
      completenessPercentage: 0,
    };
  }
}

export async function getVehicleStatistics(vehicleId: string): Promise<VehicleStats> {
  try {
    const db = await initDatabase();
    const vehicle = db.getFirstSync('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    const monthRange = getCurrentMonthRange();
    const ytdRange = getYTDRange();

    const [monthly, ytd, allTime, auditCompleteness] = await Promise.all([
      calculateTripStats(vehicleId, monthRange.start, monthRange.end),
      calculateTripStats(vehicleId, ytdRange.start, ytdRange.end),
      calculateTripStats(vehicleId, null, null),
      calculateAuditCompleteness(vehicleId),
    ]);

    return {
      vehicleId,
      vehicleName,
      monthly,
      ytd,
      allTime,
      auditCompleteness,
    };
  } catch (error) {
    console.error('Error getting vehicle statistics:', error);
    throw error;
  }
}

export async function getAllVehiclesStatistics(): Promise<VehicleStats[]> {
  try {
    const db = await initDatabase();
    const vehicles = db.getAllSync('SELECT * FROM vehicles ORDER BY created_at DESC');

    const stats = await Promise.all(
      vehicles.map((v: any) => getVehicleStatistics(v.id))
    );

    return stats;
  } catch (error) {
    console.error('Error getting all vehicles statistics:', error);
    return [];
  }
}

export async function getOverallStatistics(): Promise<OverallStats> {
  try {
    const db = await initDatabase();
    const monthRange = getCurrentMonthRange();
    const ytdRange = getYTDRange();

    const [monthly, ytd, allTime] = await Promise.all([
      calculateTripStats(null, monthRange.start, monthRange.end),
      calculateTripStats(null, ytdRange.start, ytdRange.end),
      calculateTripStats(null, null, null),
    ]);

    const vehicleCount = db.getFirstSync('SELECT COUNT(*) as count FROM vehicles')?.count || 0;
    const totalTrips = db.getFirstSync('SELECT COUNT(*) as count FROM trips')?.count || 0;

    return {
      monthly,
      ytd,
      allTime,
      vehicleCount,
      totalTrips,
    };
  } catch (error) {
    console.error('Error getting overall statistics:', error);
    return {
      monthly: createEmptyStats(),
      ytd: createEmptyStats(),
      allTime: createEmptyStats(),
      vehicleCount: 0,
      totalTrips: 0,
    };
  }
}
