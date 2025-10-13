import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Camera, Plus, X, ChevronDown, ChevronUp, Download } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { Vehicle, VehiclePhoto, MonthlyPhotoRecord } from '../../src/types';
import { getVehicles, addVehicle } from '../../src/services/simpleVehicleService';
import {
  saveOdometerPhoto,
  getMonthlyRecordsByVehicle,
  getCurrentMonthYear,
  checkMissingPhotos,
} from '../../src/services/odometerPhotoService';
import { checkNewVehicleNeedsStartPhoto, markPromptShown } from '../../src/services/photoPromptService';
import OdometerPhotoViewer from '../../src/components/OdometerPhotoViewer';
import PhotoPromptModal from '../../src/components/PhotoPromptModal';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

export default function VehiclesScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedVehicles, setExpandedVehicles] = useState<Set<string>>(new Set());
  const [monthlyRecords, setMonthlyRecords] = useState<Map<string, MonthlyPhotoRecord[]>>(new Map());
  const [selectedPhoto, setSelectedPhoto] = useState<{
    photo: VehiclePhoto;
    vehicleName: string;
  } | null>(null);
  const [newVehiclePrompt, setNewVehiclePrompt] = useState<{
    vehicleId: string;
    vehicleName: string;
  } | null>(null);
  const [capturingFor, setCapturingFor] = useState<{
    vehicleId: string;
    photoType: 'start' | 'end';
    monthYear?: string;
  } | null>(null);

  const [newVehicle, setNewVehicle] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    license_plate: '',
  });

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    try {
      setLoading(true);
      const data = await getVehicles();
      setVehicles(data);

      const records = new Map<string, MonthlyPhotoRecord[]>();
      for (const vehicle of data) {
        const vehicleRecords = await getMonthlyRecordsByVehicle(vehicle.id);
        records.set(vehicle.id, vehicleRecords);
      }
      setMonthlyRecords(records);
    } catch (err) {
      console.error('Error loading data:', err);
      Alert.alert('Error', 'Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddVehicle() {
    if (!newVehicle.make || !newVehicle.model || !newVehicle.license_plate) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const vehicle = await addVehicle(
        newVehicle.make,
        newVehicle.model,
        newVehicle.year,
        newVehicle.license_plate
      );

      setShowAddModal(false);
      setNewVehicle({
        make: '',
        model: '',
        year: new Date().getFullYear(),
        license_plate: '',
      });

      await loadData();

      const needsPhoto = await checkNewVehicleNeedsStartPhoto(vehicle.id);
      if (needsPhoto) {
        setNewVehiclePrompt({
          vehicleId: vehicle.id,
          vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        });
      }
    } catch (err) {
      console.error('Error adding vehicle:', err);
      Alert.alert('Error', 'Failed to create vehicle');
    }
  }

  async function handleTakePhoto(vehicleId: string, photoType: 'start' | 'end', monthYear?: string) {
    try {
      setCapturingFor({ vehicleId, photoType, monthYear });

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to take odometer photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        await saveOdometerPhoto(vehicleId, photoType, result.assets[0].uri, monthYear);
        Alert.alert('Success', 'Odometer photo saved');
        await loadData();
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to save photo');
    } finally {
      setCapturingFor(null);
    }
  }

  async function handleNewVehiclePhotoTaken(uri: string) {
    if (!newVehiclePrompt) return;

    try {
      await saveOdometerPhoto(newVehiclePrompt.vehicleId, 'start', uri);
      await markPromptShown(newVehiclePrompt.vehicleId, 'start');
      Alert.alert('Success', 'Start of month photo saved');
      setNewVehiclePrompt(null);
      await loadData();
    } catch (error) {
      console.error('Error saving new vehicle photo:', error);
      Alert.alert('Error', 'Failed to save photo');
    }
  }

  async function handleExportRecords(vehicle: Vehicle) {
    try {
      const records = monthlyRecords.get(vehicle.id) || [];
      if (records.length === 0) {
        Alert.alert('No Records', 'This vehicle has no odometer photos to export.');
        return;
      }

      const exportData = {
        vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        license_plate: vehicle.license_plate,
        export_date: new Date().toISOString(),
        records: records.map(record => ({
          month_year: record.month_year,
          start_photo: record.start_photo
            ? {
                timestamp: record.start_photo.timestamp,
                hash: record.start_photo.photo_hash,
              }
            : null,
          end_photo: record.end_photo
            ? {
                timestamp: record.end_photo.timestamp,
                hash: record.end_photo.photo_hash,
              }
            : null,
        })),
      };

      const filename = `odometer_records_${vehicle.make}_${vehicle.model}_${Date.now()}.json`;
      const fileUri = `${FileSystem.documentDirectory || ''}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportData, null, 2));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export Odometer Records',
        });
      } else {
        Alert.alert('Success', `Records exported to ${filename}`);
      }
    } catch (error) {
      console.error('Error exporting records:', error);
      Alert.alert('Error', 'Failed to export records');
    }
  }

  function toggleExpanded(vehicleId: string) {
    const newExpanded = new Set(expandedVehicles);
    if (newExpanded.has(vehicleId)) {
      newExpanded.delete(vehicleId);
    } else {
      newExpanded.add(vehicleId);
    }
    setExpandedVehicles(newExpanded);
  }

  function renderVehicle({ item }: { item: Vehicle }) {
    const isExpanded = expandedVehicles.has(item.id);
    const records = monthlyRecords.get(item.id) || [];
    const currentMonthYear = getCurrentMonthYear();
    const currentMonthRecord = records.find(r => r.month_year === currentMonthYear);

    const hasStart = !!currentMonthRecord?.start_photo;
    const hasEnd = !!currentMonthRecord?.end_photo;

    return (
      <View style={styles.vehicleCard}>
        <TouchableOpacity onPress={() => toggleExpanded(item.id)} activeOpacity={0.7}>
          <View style={styles.vehicleHeader}>
            <View style={styles.vehicleInfo}>
              <Text style={styles.vehicleName}>
                {item.year} {item.make} {item.model}
              </Text>
              <Text style={styles.licensePlate}>{item.license_plate}</Text>
            </View>
            {isExpanded ? (
              <ChevronUp size={24} color="#64748b" />
            ) : (
              <ChevronDown size={24} color="#64748b" />
            )}
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Current Month ({currentMonthYear})</Text>
            </View>

            <View style={styles.currentMonthPhotos}>
              <PhotoCard
                label="Start Photo"
                photo={currentMonthRecord?.start_photo}
                onTake={() => handleTakePhoto(item.id, 'start')}
                onView={(photo) =>
                  setSelectedPhoto({
                    photo,
                    vehicleName: `${item.year} ${item.make} ${item.model}`,
                  })
                }
                loading={capturingFor?.vehicleId === item.id && capturingFor?.photoType === 'start'}
              />

              <PhotoCard
                label="End Photo"
                photo={currentMonthRecord?.end_photo}
                onTake={() => handleTakePhoto(item.id, 'end')}
                onView={(photo) =>
                  setSelectedPhoto({
                    photo,
                    vehicleName: `${item.year} ${item.make} ${item.model}`,
                  })
                }
                loading={capturingFor?.vehicleId === item.id && capturingFor?.photoType === 'end'}
              />
            </View>

            {records.length > 1 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Previous Months</Text>
                </View>

                {records.slice(1).map((record, index) => (
                  <View key={index} style={styles.monthRecord}>
                    <Text style={styles.monthLabel}>{record.month_year}</Text>
                    <View style={styles.monthPhotos}>
                      <PhotoCard
                        label="Start"
                        photo={record.start_photo}
                        compact
                        onView={(photo) =>
                          setSelectedPhoto({
                            photo,
                            vehicleName: `${item.year} ${item.make} ${item.model}`,
                          })
                        }
                      />
                      <PhotoCard
                        label="End"
                        photo={record.end_photo}
                        compact
                        onView={(photo) =>
                          setSelectedPhoto({
                            photo,
                            vehicleName: `${item.year} ${item.make} ${item.model}`,
                          })
                        }
                      />
                    </View>
                  </View>
                ))}
              </>
            )}

            <TouchableOpacity style={styles.exportButton} onPress={() => handleExportRecords(item)}>
              <Download size={18} color="#3b82f6" />
              <Text style={styles.exportButtonText}>Export Records</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={vehicles}
        renderItem={renderVehicle}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Camera size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>No vehicles added yet</Text>
            <Text style={styles.emptySubtext}>Add a vehicle to start tracking odometer photos</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Plus size={24} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Vehicle</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Make</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Chevrolet"
                value={newVehicle.make}
                onChangeText={(t) => setNewVehicle({ ...newVehicle, make: t })}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Model</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Bolt EV"
                value={newVehicle.model}
                onChangeText={(t) => setNewVehicle({ ...newVehicle, model: t })}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Year</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 2024"
                keyboardType="numeric"
                value={newVehicle.year.toString()}
                onChangeText={(t) =>
                  setNewVehicle({ ...newVehicle, year: parseInt(t) || new Date().getFullYear() })
                }
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>License Plate</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., ABC-1234"
                value={newVehicle.license_plate}
                onChangeText={(t) => setNewVehicle({ ...newVehicle, license_plate: t })}
                autoCapitalize="characters"
              />
            </View>

            <TouchableOpacity style={styles.addButton} onPress={handleAddVehicle}>
              <Text style={styles.addButtonText}>Add Vehicle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {selectedPhoto && (
        <OdometerPhotoViewer
          photo={selectedPhoto.photo}
          vehicleName={selectedPhoto.vehicleName}
          visible={!!selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onRetake={() => {
            if (selectedPhoto) {
              handleTakePhoto(
                selectedPhoto.photo.vehicle_id,
                selectedPhoto.photo.photo_type,
                selectedPhoto.photo.month_year
              );
            }
          }}
        />
      )}

      {newVehiclePrompt && (
        <PhotoPromptModal
          prompt={{
            vehicleId: newVehiclePrompt.vehicleId,
            vehicleName: newVehiclePrompt.vehicleName,
            promptType: 'start',
            monthYear: getCurrentMonthYear(),
          }}
          visible={!!newVehiclePrompt}
          onPhotoTaken={handleNewVehiclePhotoTaken}
          onDismiss={() => setNewVehiclePrompt(null)}
          onSkip={() => {
            if (newVehiclePrompt) {
              markPromptShown(newVehiclePrompt.vehicleId, 'start');
            }
            setNewVehiclePrompt(null);
          }}
        />
      )}
    </View>
  );
}

interface PhotoCardProps {
  label: string;
  photo?: VehiclePhoto;
  onTake?: () => void;
  onView?: (photo: VehiclePhoto) => void;
  compact?: boolean;
  loading?: boolean;
}

function PhotoCard({ label, photo, onTake, onView, compact, loading }: PhotoCardProps) {
  if (compact) {
    return (
      <View style={styles.compactPhotoCard}>
        <Text style={styles.compactPhotoLabel}>{label}</Text>
        {photo ? (
          <TouchableOpacity onPress={() => onView?.(photo)}>
            <Image source={{ uri: photo.photo_uri }} style={styles.compactPhotoThumbnail} />
          </TouchableOpacity>
        ) : (
          <View style={styles.compactPhotoEmpty}>
            <X size={16} color="#cbd5e1" />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.photoCard}>
      <Text style={styles.photoLabel}>{label}</Text>
      {photo ? (
        <TouchableOpacity onPress={() => onView?.(photo)} activeOpacity={0.7}>
          <Image source={{ uri: photo.photo_uri }} style={styles.photoThumbnail} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.takePhotoButton} onPress={onTake} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <>
              <Camera size={20} color="#3b82f6" />
              <Text style={styles.takePhotoText}>Take Photo</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 80 },
  vehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehicleInfo: { flex: 1 },
  vehicleName: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  licensePlate: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  expandedContent: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' },
  currentMonthPhotos: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  photoCard: { flex: 1, alignItems: 'center' },
  photoLabel: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  photoThumbnail: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  takePhotoButton: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  takePhotoText: { fontSize: 12, fontWeight: '600', color: '#3b82f6' },
  monthRecord: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  monthLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
  monthPhotos: { flexDirection: 'row', gap: 12 },
  compactPhotoCard: { flex: 1, alignItems: 'center' },
  compactPhotoLabel: { fontSize: 12, color: '#64748b', marginBottom: 6 },
  compactPhotoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  compactPhotoEmpty: {
    width: 80,
    height: 80,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
    gap: 8,
    marginTop: 8,
  },
  exportButtonText: { fontSize: 15, fontWeight: '600', color: '#3b82f6' },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
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
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: { fontSize: 24, fontWeight: '700', color: '#1e293b' },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  addButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
