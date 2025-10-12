# Offline-First Architecture Documentation

## Overview

AuditProof Mileage has been fully refactored to follow an **offline-first architecture** using local SQLite storage. All core features work 100% offline with optional cloud sync to Supabase.

## Core Principles

1. **100% Offline Functionality**
   - GPS tracking
   - Mileage calculation
   - Trip storage
   - Vehicle management
   - CSV/JSON export

2. **Address Lookup Policy**
   - Automatic address resolution when online
   - Offline fallback: coordinates with "(offline)" suffix
   - `needs_lookup` flag tracks trips needing resolution
   - Manual "Resolve Addresses" feature available

3. **Cloud Sync (Optional)**
   - Manual sync to Supabase when user requests
   - Tracks sync status with `synced_to_cloud` flag
   - Never blocks offline operations

## Architecture

### Local Database (SQLite)

Location: `src/services/localDbService.ts`

**Tables:**
- `vehicles` - Vehicle information with odometer photos
- `trips` - Trip records with GPS points and addresses
- `settings` - App settings (IRS rate, etc.)
- `reports` - Monthly mileage reports

**Key Fields:**
- `needs_lookup` (INTEGER) - 1 if address needs resolution
- `synced_to_cloud` (INTEGER) - 1 if synced to Supabase

### Service Layer

#### 1. Local Database Services

**`localDbService.ts`**
- Database initialization
- Helper functions (ID generation, offline detection)

**`localVehicleDb.ts`**
- CRUD operations for vehicles
- All operations are synchronous and offline-capable

**`localTripDb.ts`**
- CRUD operations for trips
- GPS point management
- Query helpers (by month, by vehicle, needing lookup, unsynced)

#### 2. Business Logic Services

**`tripService.ts`** - Trip management
- Start/stop trips
- Background location tracking
- Distance calculation
- Works 100% offline

**`vehicleService.ts`** - Vehicle management
- CRUD operations
- Odometer photo storage (local filesystem)
- Verification logic

**`autoTripService.ts`** - Automatic trip detection
- Background GPS monitoring
- Speed-based trip detection
- Fully offline operation

**`geoService.ts`** - Address geocoding
- OpenStreetMap Nominatim API
- Offline fallback with "(offline)" suffix
- Network status checking

#### 3. Helper Services

**`addressResolutionService.ts`**
- Batch resolve pending addresses
- Single trip address resolution
- Get count of trips needing lookup

**`cloudSyncService.ts`**
- Manual sync to Supabase
- Sync trips and vehicles separately
- Network status validation
- Error handling and reporting

## Data Flow

### Starting a Trip (Offline)

```
User taps "Start Trip"
  ↓
Get current GPS coordinates
  ↓
Try to resolve address via Nominatim
  ↓
If offline/fails:
  - Store coordinates as "38.768,-105.505 (offline)"
  - Set needs_lookup = 1
  ↓
Store trip in local SQLite
  ↓
Start background location tracking
```

### Stopping a Trip (Offline)

```
User taps "Stop Trip"
  ↓
Get final GPS coordinates
  ↓
Try to resolve end address via Nominatim
  ↓
If offline/fails:
  - Store coordinates with "(offline)" suffix
  - Keep needs_lookup = 1
  ↓
Calculate total distance from GPS points
  ↓
Generate SHA-256 hash for audit trail
  ↓
Update trip in local SQLite
  ↓
Trip saved, ready for export
```

### Address Resolution (When Online)

```
User taps "Resolve Addresses"
  ↓
Query trips WHERE needs_lookup = 1
  ↓
For each trip:
  - Retry Nominatim lookup
  - Update address if successful
  - Set needs_lookup = 0 if both resolved
  ↓
Show results (resolved/failed)
```

### Cloud Sync (Manual)

```
User taps "Sync to Cloud"
  ↓
Check network status
  ↓
If offline: Show error
  ↓
If online:
  - Get all trips WHERE synced_to_cloud = 0
  - Upload to Supabase
  - Set synced_to_cloud = 1 on success
  ↓
Show sync results
```

## Trip Data Structure

```typescript
{
  "id": "1728756120000-abc123xyz",
  "vehicle_id": "...",
  "start_time": "2025-10-12T14:22:00Z",
  "end_time": "2025-10-12T15:05:00Z",
  "start_coords": { "lat": 38.768, "lng": -105.505, "timestamp": 1728756120000 },
  "end_coords": { "lat": 38.770, "lng": -105.500, "timestamp": 1728759900000 },
  "start_address": "123 Main St, Guffey, CO" | "38.768,-105.505 (offline)",
  "end_address": "456 Oak St, Guffey, CO" | "38.770,-105.500 (offline)",
  "distance_miles": 12.4,
  "distance_km": 19.95,
  "points": [...GPS coordinates array...],
  "purpose": "Client meeting",
  "notes": "Optional notes",
  "hash": "abc123...",
  "status": "completed",
  "classification": "business",
  "auto_detected": false,
  "needs_lookup": false,
  "synced_to_cloud": false,
  "created_at": "2025-10-12T14:22:00Z",
  "updated_at": "2025-10-12T15:05:00Z"
}
```

## Usage Guide

### For Users

**Normal Operation:**
1. Start trip (works offline)
2. Drive (GPS tracks in background)
3. Stop trip (works offline)
4. View/export trips anytime

**Address Resolution:**
1. When back online, go to Settings
2. Tap "Resolve Addresses"
3. App will retry all failed lookups

**Cloud Backup:**
1. Optional: Tap "Sync to Cloud"
2. All unsynced data uploads to Supabase
3. Local data remains primary source

### For Developers

**Accessing Local Data:**
```typescript
import { getAllTripsLocal } from '@/services/localTripDb';

const trips = await getAllTripsLocal();
```

**Syncing to Cloud:**
```typescript
import { syncAllToCloud } from '@/services/cloudSyncService';

const result = await syncAllToCloud();
console.log(`Synced ${result.trips.synced} trips`);
```

**Resolving Addresses:**
```typescript
import { resolvePendingAddresses } from '@/services/addressResolutionService';

const result = await resolvePendingAddresses();
console.log(`Resolved ${result.resolved} of ${result.total} trips`);
```

## Testing Offline Mode

1. **Enable Airplane Mode** on device
2. **Start a trip** - should work fine
3. **Check addresses** - should show coordinates with "(offline)"
4. **Stop trip** - should complete successfully
5. **View trip** - all data stored locally
6. **Disable Airplane Mode**
7. **Tap "Resolve Addresses"** - addresses should update
8. **Tap "Sync to Cloud"** (optional) - data uploads to Supabase

## Migration Notes

### What Changed

**Before:**
- All operations required Supabase connection
- Failed when offline
- No offline address fallback
- No sync tracking

**After:**
- SQLite as primary storage
- All operations work offline
- Automatic offline address fallback
- Optional cloud sync with tracking

### Backward Compatibility

The app can import existing data from Supabase if needed. The cloud sync service uses `upsert` to handle both new and existing records.

## Performance

- **SQLite queries:** < 10ms typical
- **GPS updates:** Every 10 seconds during trips
- **Background tracking:** Minimal battery impact
- **Storage:** ~1KB per trip (excluding photos)

## Security

- **Local data:** Encrypted by device OS
- **SHA-256 hashing:** For audit trail integrity
- **No sensitive data:** In coordinates/addresses
- **Optional cloud:** User controls when to sync

## Future Enhancements

- [ ] Automatic sync when WiFi detected
- [ ] Conflict resolution for edited trips
- [ ] Batch address resolution scheduling
- [ ] Export to encrypted backup files
- [ ] Multi-device sync coordination
