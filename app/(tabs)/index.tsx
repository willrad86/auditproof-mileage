import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Switch,
  Image,
} from 'react-native';
import { Play, Square, MapPin, AlertTriangle, Zap, CheckCircle, Settings, WifiOff, Cloud } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import {
  getAllTrips,
  startTrip,
  stopTrip,
  getActiveTrip,
  updateTripDetails,
  updateTripClassification,
  calculateReimbursement,
} from '../../src/services/tripService';
import { getVehicles } from '../../src/services/vehicleService';
import { geocodeWithFallback } from '../../src/services/geoService';
import { generateStaticMapImage } from '../../src/services/mapService';
import {
  startAutoTripDetection,
  stopAutoTripDetection,
  getAutoDetectionStatus,
} from '../../src/services/autoTripService';
import { Trip, Vehicle } from '../../src/types';
import { getTrackingStatus, TrackingStatus } from '../../src/utils/permissionsStatus';
import DiagnosticsModal from '../../src/components/DiagnosticsModal';

export default function TripsScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [autoDetectionEnabled, setAutoDetectionEnabled] = useState(false);
  const [showClassifyModal, setShowClassifyModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied' | 'unknown'>('checking');
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>('limited');
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useFocusEffect(
    useCallback(() => {
      checkTrackingStatus();
      const interval = setInterval(checkTrackingStatus, 15000);
      return () => clearInterval(interval);
    }, [])
  );

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (mounted) {
        await checkPermissions();
        await loadData();
        await checkAutoDetection();
      }
    }

    init();

    const interval = setInterval(() => {
      if (mounted) {
        loadData();
      }
    }, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [tripsData, vehiclesData, activeTripData] = await Promise.all([
        getAllTrips(),
        getVehicles(),
        getActiveTrip(),
      ]);

      setTrips(tripsData);
      setVehicles(vehiclesData);
      setActiveTrip(activeTripData);
    } catch (error: any) {
      console.log('Load data error (offline mode):', error?.message);
      if (trips.length === 0 && vehicles.length === 0) {
        setTrips([]);
        setVehicles([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function checkPermissions() {
    try {
      const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
      const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();

      if (foregroundStatus === 'granted' && backgroundStatus === 'granted') {
        setPermissionStatus('granted');
      } else if (foregroundStatus === 'denied' || backgroundStatus === 'denied') {
        setPermissionStatus('denied');
      } else {
        setPermissionStatus('unknown');
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      setPermissionStatus('unknown');
    }
  }

  async function requestPermissions() {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Auditproof Mileage needs location access to track your trips. Please enable location permissions in your device settings.',
          [{ text: 'OK' }]
        );
        setPermissionStatus('denied');
        return;
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

      if (backgroundStatus !== 'granted') {
        Alert.alert(
          'Background Location Required',
          'For automatic trip detection, please allow location access "Always" or "Allow all the time" in your device settings.',
          [{ text: 'OK' }]
        );
        setPermissionStatus('denied');
        return;
      }

      setPermissionStatus('granted');
      Alert.alert('Success', 'Location permissions granted! You can now track trips.');
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to request permissions');
    }
  }

  async function checkTrackingStatus() {
    try {
      const status = await getTrackingStatus();
      setTrackingStatus(status);
    } catch (error) {
      console.error('Error checking tracking status:', error);
    }
  }

  async function checkAutoDetection() {
    const status = await getAutoDetectionStatus();
    setAutoDetectionEnabled(status.running);
  }

  async function toggleAutoDetection(enabled: boolean) {
    try {
      if (enabled) {
        if (permissionStatus !== 'granted') {
          Alert.alert(
            'Permissions Required',
            'Location permissions (including "Always" or "Allow all the time") are required for automatic trip detection.\n\nPlease grant permissions in your device settings:\n\n1. Open device Settings\n2. Find Auditproof Mileage\n3. Tap Location\n4. Select "Always" or "Allow all the time"',
            [{ text: 'OK' }]
          );
          return;
        }

        const success = await startAutoTripDetection();
        if (success) {
          setAutoDetectionEnabled(true);
          Alert.alert(
            'Auto-Detection Enabled',
            'Trips will be automatically detected when you drive. Make sure to keep the app running in the background.'
          );
        } else {
          Alert.alert(
            'Failed to Enable',
            'Could not start auto-detection. Please ensure:\n\n1. Location permissions are set to "Always"\n2. You have at least one vehicle added\n3. Battery optimization is disabled for this app',
            [{ text: 'OK' }]
          );
        }
      } else {
        await stopAutoTripDetection();
        setAutoDetectionEnabled(false);
        Alert.alert('Auto-Detection Disabled', 'Manual trip tracking only');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to toggle auto-detection: ' + (error as Error).message);
    }
  }

  async function handleStartTrip() {
    if (!selectedVehicleId) {
      Alert.alert('Error', 'Please select a vehicle');
      return;
    }

    try {
      const trip = await startTrip(selectedVehicleId, purpose, notes);
      setActiveTrip(trip);
      setShowStartModal(false);
      setPurpose('');
      setNotes('');
      Alert.alert('Success', 'Trip started');
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to start trip: ' + error);
    }
  }

  async function handleStopTrip() {
    if (!activeTrip) return;

    try {
      Alert.alert('Stop Trip', 'Are you sure you want to stop this trip?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            const stoppedTrip = await stopTrip(activeTrip.id);

            const startAddress = await geocodeWithFallback(stoppedTrip.start_coords);
            const endAddress = stoppedTrip.end_coords
              ? await geocodeWithFallback(stoppedTrip.end_coords)
              : null;

            await updateTripDetails(stoppedTrip.id, {
              start_address: startAddress,
              end_address: endAddress || undefined,
            });

            if (stoppedTrip.end_coords) {
              const mapData = await generateStaticMapImage(
                stoppedTrip.id,
                stoppedTrip.vehicle_id,
                stoppedTrip.start_coords,
                stoppedTrip.end_coords,
                stoppedTrip.points
              );

              if (mapData) {
                await updateTripDetails(stoppedTrip.id, {
                  map_image_uri: mapData.uri,
                });
              }
            }

            setActiveTrip(null);
            Alert.alert('Success', 'Trip stopped and saved');
            loadData();
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to stop trip');
    }
  }

  async function handleClassifyTrip(
    trip: Trip,
    classification: 'business' | 'personal' | 'commute' | 'other'
  ) {
    try {
      await updateTripClassification(trip.id, classification);
      setShowClassifyModal(false);
      setSelectedTrip(null);
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to update classification');
    }
  }

  function formatDuration(start: string, end?: string): string {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const durationMs = endTime - startTime;

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  function getClassificationColor(classification: string): string {
    switch (classification) {
      case 'business':
        return '#10b981';
      case 'personal':
        return '#8b5cf6';
      case 'commute':
        return '#3b82f6';
      case 'other':
        return '#64748b';
      default:
        return '#f59e0b';
    }
  }

  function getClassificationLabel(classification: string): string {
    return classification.charAt(0).toUpperCase() + classification.slice(1);
  }

  function renderTrip({ item }: { item: Trip }) {
    const vehicle = vehicles.find((v) => v.id === item.vehicle_id);
    const isActive = item.status === 'active';
    const isUnclassified = item.classification === 'unclassified';

    return (
      <TouchableOpacity
        style={[styles.tripCard, isActive && styles.activeTripCard]}
        onPress={() => {
          if (!isActive && item.auto_detected) {
            setSelectedTrip(item);
            setShowClassifyModal(true);
          }
        }}>
        <View style={styles.tripHeader}>
          <View style={styles.tripInfo}>
            <View style={styles.tripTitleRow}>
              <Text style={styles.tripVehicle}>
                {vehicle
                  ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
                  : 'Unknown Vehicle'}
              </Text>
              {item.auto_detected && (
                <View style={styles.autoDetectedBadge}>
                  <Zap size={12} color="#f59e0b" fill="#f59e0b" />
                </View>
              )}
              {item.needs_lookup && (
                <View style={styles.needsLookupBadge}>
                  <WifiOff size={12} color="#ef4444" />
                </View>
              )}
              {!item.synced_to_cloud && !isActive && (
                <View style={styles.unsyncedBadge}>
                  <Cloud size={12} color="#3b82f6" />
                </View>
              )}
            </View>
            <Text style={styles.tripDate}>
              {new Date(item.start_time).toLocaleDateString()} •{' '}
              {new Date(item.start_time).toLocaleTimeString()}
            </Text>
          </View>

          {isActive ? (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.classificationBadge,
                { backgroundColor: `${getClassificationColor(item.classification)}20` },
              ]}
              onPress={() => {
                setSelectedTrip(item);
                setShowClassifyModal(true);
              }}>
              {isUnclassified && <AlertTriangle size={14} color="#f59e0b" />}
              <Text
                style={[
                  styles.classificationText,
                  { color: getClassificationColor(item.classification) },
                ]}>
                {getClassificationLabel(item.classification)}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {item.map_image_uri && (
          <Image source={{ uri: item.map_image_uri }} style={styles.mapThumbnail} />
        )}

        <View style={styles.tripDetails}>
          <View style={styles.tripRow}>
            <MapPin size={16} color="#64748b" />
            <Text style={styles.tripDetailText} numberOfLines={1}>
              {item.start_address || 'Loading...'}
            </Text>
          </View>

          {item.end_address && (
            <View style={styles.tripRow}>
              <MapPin size={16} color="#64748b" />
              <Text style={styles.tripDetailText} numberOfLines={1}>
                {item.end_address}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.tripStats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>{item.distance_miles.toFixed(1)} mi</Text>
          </View>

          <View style={styles.stat}>
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>
              {formatDuration(item.start_time, item.end_time)}
            </Text>
          </View>

          {!isActive && item.classification === 'business' && (
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Value</Text>
              <Text style={styles.statValue}>
                ${(item.distance_miles * 0.67).toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {item.purpose && <Text style={styles.tripPurpose}>Purpose: {item.purpose}</Text>}
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  const unclassifiedCount = trips.filter((t) => t.classification === 'unclassified').length;

  if (vehicles.length === 0 && trips.length === 0) {
    return (
      <View style={styles.welcomeContainer}>
        <View style={styles.welcomeContent}>
          <View style={styles.logoContainer}>
            <MapPin size={64} color="#14b8a6" strokeWidth={2} />
          </View>
          <Text style={styles.welcomeTitle}>Auditproof Mileage</Text>
          <Text style={styles.welcomeSubtitle}>
            Track your business miles with audit-ready precision
          </Text>

          {permissionStatus === 'checking' && (
            <ActivityIndicator size="large" color="#14b8a6" style={{ marginVertical: 24 }} />
          )}

          {permissionStatus !== 'checking' && (
            <>
              {permissionStatus !== 'granted' && (
                <View style={styles.permissionBanner}>
                  <AlertTriangle size={24} color="#f59e0b" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.permissionBannerTitle}>Location Access Required</Text>
                    <Text style={styles.permissionBannerText}>
                      Grant location permissions to track trips
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.permissionButton}
                    onPress={requestPermissions}>
                    <Settings size={20} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.welcomeFeatures}>
                <View style={styles.welcomeFeature}>
                  <CheckCircle size={20} color="#10b981" />
                  <Text style={styles.welcomeFeatureText}>Automatic trip detection</Text>
                </View>
                <View style={styles.welcomeFeature}>
                  <CheckCircle size={20} color="#10b981" />
                  <Text style={styles.welcomeFeatureText}>GPS-based mileage tracking</Text>
                </View>
                <View style={styles.welcomeFeature}>
                  <CheckCircle size={20} color="#10b981" />
                  <Text style={styles.welcomeFeatureText}>Cryptographic verification</Text>
                </View>
                <View style={styles.welcomeFeature}>
                  <CheckCircle size={20} color="#10b981" />
                  <Text style={styles.welcomeFeatureText}>IRS-compliant reports</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.welcomeButton,
                  permissionStatus !== 'granted' && styles.welcomeButtonDisabled,
                ]}
                onPress={() => {
                  if (permissionStatus !== 'granted') {
                    Alert.alert(
                      'Permission Required',
                      'Please grant location permissions first.',
                      [{ text: 'OK' }]
                    );
                  } else {
                    Alert.alert(
                      'Get Started',
                      'Add a vehicle in the Vehicles tab to begin tracking trips.',
                      [{ text: 'OK' }]
                    );
                  }
                }}>
                <Text style={styles.welcomeButtonText}>Get Started</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => setShowDiagnostics(true)}
        style={[
          styles.statusBanner,
          trackingStatus === 'active'
            ? styles.statusBannerActive
            : trackingStatus === 'limited'
            ? styles.statusBannerLimited
            : styles.statusBannerOff,
        ]}>
        <Text style={styles.statusBannerText}>
          {trackingStatus === 'active'
            ? '🟢 Tracking Active — Trips are being recorded automatically.'
            : trackingStatus === 'limited'
            ? '🟡 Limited Access — App may miss some trips.'
            : '🔴 Location Off — Enable background tracking to log trips.'}
        </Text>
      </TouchableOpacity>

      <View style={styles.autoDetectBar}>
        <View style={styles.autoDetectContent}>
          <Zap size={20} color={autoDetectionEnabled ? '#f59e0b' : '#64748b'} />
          <View style={styles.autoDetectTextContainer}>
            <Text style={styles.autoDetectTitle}>Auto-Detect Trips</Text>
            <Text style={styles.autoDetectSubtitle}>
              {autoDetectionEnabled ? 'Monitoring speed' : 'Manual only'}
            </Text>
          </View>
        </View>
        <Switch
          value={autoDetectionEnabled}
          onValueChange={toggleAutoDetection}
          trackColor={{ false: '#cbd5e1', true: '#fed7aa' }}
          thumbColor={autoDetectionEnabled ? '#f59e0b' : '#f1f5f9'}
        />
      </View>

      {unclassifiedCount > 0 && (
        <View style={styles.warningBanner}>
          <AlertTriangle size={20} color="#f59e0b" />
          <Text style={styles.warningText}>
            {unclassifiedCount} {unclassifiedCount === 1 ? 'trip' : 'trips'} need classification
          </Text>
        </View>
      )}

      {activeTrip && (
        <View style={styles.activeBar}>
          <View style={styles.activeBarContent}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveTextLarge}>Trip in Progress</Text>
            </View>
            <Text style={styles.activeDistance}>
              {activeTrip.distance_miles.toFixed(1)} miles
            </Text>
          </View>

          <TouchableOpacity style={styles.stopButton} onPress={handleStopTrip}>
            <Square size={20} color="#ffffff" fill="#ffffff" />
            <Text style={styles.stopButtonText}>Stop Trip</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={trips}
        renderItem={renderTrip}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No trips recorded</Text>
            <Text style={styles.emptySubtext}>
              {autoDetectionEnabled
                ? 'Trips will be detected automatically'
                : 'Enable auto-detection or start a trip manually'}
            </Text>
          </View>
        }
      />

      {!activeTrip && !autoDetectionEnabled && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowStartModal(true)}>
          <Play size={24} color="#ffffff" fill="#ffffff" />
        </TouchableOpacity>
      )}

      <Modal visible={showStartModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Start New Trip</Text>

            <Text style={styles.label}>Select Vehicle</Text>
            <View style={styles.vehicleList}>
              {vehicles.map((vehicle) => (
                <TouchableOpacity
                  key={vehicle.id}
                  style={[
                    styles.vehicleOption,
                    selectedVehicleId === vehicle.id && styles.vehicleOptionSelected,
                  ]}
                  onPress={() => setSelectedVehicleId(vehicle.id)}>
                  <Text
                    style={[
                      styles.vehicleOptionText,
                      selectedVehicleId === vehicle.id && styles.vehicleOptionTextSelected,
                    ]}>
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Purpose</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Client meeting, Site visit"
              value={purpose}
              onChangeText={setPurpose}
            />

            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Additional details..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowStartModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.startButton]}
                onPress={handleStartTrip}>
                <Text style={styles.startButtonText}>Start Trip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showClassifyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Classify Trip</Text>

            {selectedTrip && (
              <>
                <View style={styles.tripSummary}>
                  <Text style={styles.tripSummaryText}>
                    {new Date(selectedTrip.start_time).toLocaleDateString()} •{' '}
                    {selectedTrip.distance_miles.toFixed(1)} mi
                  </Text>
                  <Text style={styles.tripSummaryAddress} numberOfLines={2}>
                    {selectedTrip.start_address || 'Unknown location'}
                  </Text>
                </View>

                <View style={styles.classificationOptions}>
                  {['business', 'personal', 'commute', 'other'].map((classification) => (
                    <TouchableOpacity
                      key={classification}
                      style={[
                        styles.classificationOption,
                        {
                          borderColor: getClassificationColor(classification),
                          backgroundColor:
                            selectedTrip.classification === classification
                              ? `${getClassificationColor(classification)}20`
                              : '#f8fafc',
                        },
                      ]}
                      onPress={() =>
                        handleClassifyTrip(
                          selectedTrip,
                          classification as 'business' | 'personal' | 'commute' | 'other'
                        )
                      }>
                      <Text
                        style={[
                          styles.classificationOptionText,
                          { color: getClassificationColor(classification) },
                        ]}>
                        {getClassificationLabel(classification)}
                      </Text>
                      {classification === 'business' && (
                        <Text style={styles.classificationNote}>
                          ${(selectedTrip.distance_miles * 0.67).toFixed(2)} deduction
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowClassifyModal(false);
                    setSelectedTrip(null);
                  }}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <DiagnosticsModal visible={showDiagnostics} onClose={() => setShowDiagnostics(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  welcomeContent: {
    alignItems: 'center',
    maxWidth: 480,
    width: '100%',
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e0f2f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  welcomeFeatures: {
    width: '100%',
    gap: 16,
    marginBottom: 40,
  },
  welcomeFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  welcomeFeatureText: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '500',
  },
  welcomeButton: {
    backgroundColor: '#14b8a6',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    shadowColor: '#14b8a6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  welcomeButtonDisabled: {
    backgroundColor: '#94a3b8',
    shadowColor: '#94a3b8',
  },
  welcomeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fffbeb',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fef3c7',
    marginBottom: 24,
    width: '100%',
  },
  permissionBannerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  permissionBannerText: {
    fontSize: 13,
    color: '#b45309',
  },
  permissionButton: {
    backgroundColor: '#14b8a6',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBanner: {
    padding: 12,
    borderRadius: 8,
    margin: 8,
  },
  statusBannerActive: {
    backgroundColor: '#0f9d58',
  },
  statusBannerLimited: {
    backgroundColor: '#fbc02d',
  },
  statusBannerOff: {
    backgroundColor: '#d32f2f',
  },
  statusBannerText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
  autoDetectBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  autoDetectContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  autoDetectTextContainer: {
    flex: 1,
  },
  autoDetectTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  autoDetectSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fffbeb',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#fef3c7',
  },
  warningText: {
    fontSize: 14,
    color: '#d97706',
    fontWeight: '500',
  },
  activeBar: {
    backgroundColor: '#14b8a6',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  activeBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444',
  },
  liveTextLarge: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  activeDistance: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  stopButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  tripCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activeTripCard: {
    borderWidth: 2,
    borderColor: '#14b8a6',
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tripInfo: {
    flex: 1,
  },
  tripTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripVehicle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  autoDetectedBadge: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
  },
  needsLookupBadge: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
  },
  unsyncedBadge: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
  },
  tripDate: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  classificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  classificationText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mapThumbnail: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 12,
  },
  tripDetails: {
    gap: 8,
    marginBottom: 12,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripDetailText: {
    fontSize: 14,
    color: '#64748b',
    flex: 1,
  },
  tripStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  tripPurpose: {
    fontSize: 14,
    color: '#14b8a6',
    marginTop: 8,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#14b8a6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  vehicleList: {
    gap: 8,
    marginBottom: 16,
  },
  vehicleOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  vehicleOptionSelected: {
    borderColor: '#14b8a6',
    backgroundColor: '#f0fdfa',
  },
  vehicleOptionText: {
    fontSize: 14,
    color: '#64748b',
  },
  vehicleOptionTextSelected: {
    color: '#14b8a6',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f8fafc',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  cancelButtonText: {
    color: '#64748b',
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: '#14b8a6',
  },
  startButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  tripSummary: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  tripSummaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 6,
  },
  tripSummaryAddress: {
    fontSize: 13,
    color: '#64748b',
  },
  classificationOptions: {
    gap: 12,
    marginBottom: 20,
  },
  classificationOption: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  classificationOptionText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  classificationNote: {
    fontSize: 13,
    color: '#64748b',
  },
});
