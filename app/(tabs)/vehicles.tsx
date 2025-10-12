import { useState, useEffect } from 'react';
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
} from 'react-native';
import { Camera, Plus, X, Check } from 'lucide-react-native';
import {
  getAllVehicles,
  createVehicle,
  saveOdometerPhoto,
  verifyVehicleForMonth,
} from '../../src/services/vehicleService';
import { Vehicle } from '../../src/types';
import { photoService } from '../../src/services/photoService';

export default function VehiclesScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [capturingPhoto, setCapturingPhoto] = useState(false);

  const [newVehicle, setNewVehicle] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    license_plate: '',
  });

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (mounted) {
        await loadVehicles();
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  async function loadVehicles() {
    try {
      setLoading(true);
      const data = await getAllVehicles();
      setVehicles(data);
    } catch (error) {
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
      await createVehicle(newVehicle);
      setShowAddModal(false);
      setNewVehicle({
        make: '',
        model: '',
        year: new Date().getFullYear(),
        license_plate: '',
      });
      loadVehicles();
    } catch (error) {
      Alert.alert('Error', 'Failed to create vehicle');
    }
  }

  async function handleTakePhoto(vehicle: Vehicle, type: 'start' | 'end') {
    try {
      setCapturingPhoto(true);

      const result = await photoService.captureOdometerPhoto();

      if (!result.success) {
        if (result.error !== 'Photo capture cancelled') {
          Alert.alert('Error', result.error || 'Failed to capture photo');
        }
        return;
      }

      if (!result.uri) {
        Alert.alert('Error', 'No photo URI returned');
        return;
      }

      await saveOdometerPhoto(vehicle.id, result.uri, type);
      await loadVehicles();

      Alert.alert('Success', 'Odometer photo saved successfully');
    } catch (error) {
      console.error('Error in handleTakePhoto:', error);
      Alert.alert('Error', 'Failed to save odometer photo');
    } finally {
      setCapturingPhoto(false);
    }
  }

  function getVehicleStatus(vehicle: Vehicle): {
    icon: React.ReactElement;
    color: string;
    text: string;
  } {
    const currentMonth = new Date().toISOString().slice(0, 7);

    if (
      vehicle.month_year === currentMonth &&
      vehicle.photo_odometer_start &&
      vehicle.photo_odometer_end
    ) {
      return {
        icon: <Check size={16} color="#10b981" />,
        color: '#10b981',
        text: 'Verified',
      };
    }

    if (vehicle.month_year === currentMonth && vehicle.photo_odometer_start) {
      return {
        icon: <Camera size={16} color="#f59e0b" />,
        color: '#f59e0b',
        text: 'Pending end photo',
      };
    }

    return {
      icon: <X size={16} color="#ef4444" />,
      color: '#ef4444',
      text: 'Missing start photo',
    };
  }

  function renderVehicle({ item }: { item: Vehicle }) {
    const status = getVehicleStatus(item);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const needsStartPhoto = item.month_year !== currentMonth || !item.photo_odometer_start;

    return (
      <View style={styles.vehicleCard}>
        <View style={styles.vehicleHeader}>
          <Text style={styles.vehicleName}>
            {item.year} {item.make} {item.model}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: `${status.color}20` }]}>
            {status.icon}
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.text}
            </Text>
          </View>
        </View>

        <Text style={styles.licensePlate}>{item.license_plate}</Text>

        <View style={styles.photoButtons}>
          {needsStartPhoto ? (
            <TouchableOpacity
              style={[styles.photoButton, styles.primaryButton]}
              onPress={() => handleTakePhoto(item, 'start')}
              disabled={capturingPhoto}>
              {capturingPhoto ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Camera size={20} color="#ffffff" />
                  <Text style={styles.photoButtonTextPrimary}>Take Start Photo</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.photoButton}
              onPress={() => handleTakePhoto(item, 'end')}
              disabled={capturingPhoto}>
              {capturingPhoto ? (
                <ActivityIndicator size="small" color="#14b8a6" />
              ) : (
                <>
                  <Camera size={20} color="#14b8a6" />
                  <Text style={styles.photoButtonText}>Take End Photo</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {item.photo_odometer_start && (
          <View style={styles.photoPreview}>
            <Image
              source={{ uri: item.photo_odometer_start }}
              style={styles.photoThumbnail}
            />
            <Text style={styles.photoLabel}>Start Photo</Text>
          </View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#14b8a6" />
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
            <Text style={styles.emptyText}>No vehicles added yet</Text>
            <Text style={styles.emptySubtext}>
              Add a vehicle to start tracking mileage
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}>
        <Plus size={24} color="#ffffff" />
      </TouchableOpacity>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Vehicle</Text>

            <TextInput
              style={styles.input}
              placeholder="Make"
              value={newVehicle.make}
              onChangeText={(text) => setNewVehicle({ ...newVehicle, make: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Model"
              value={newVehicle.model}
              onChangeText={(text) => setNewVehicle({ ...newVehicle, model: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Year"
              keyboardType="numeric"
              value={newVehicle.year.toString()}
              onChangeText={(text) =>
                setNewVehicle({ ...newVehicle, year: parseInt(text) || 0 })
              }
            />

            <TextInput
              style={styles.input}
              placeholder="License Plate"
              value={newVehicle.license_plate}
              onChangeText={(text) =>
                setNewVehicle({ ...newVehicle, license_plate: text })
              }
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.addButton]}
                onPress={handleAddVehicle}>
                <Text style={styles.addButtonText}>Add Vehicle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  listContent: {
    padding: 16,
  },
  vehicleCard: {
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
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  vehicleName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  licensePlate: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  photoButtons: {
    gap: 8,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#14b8a6',
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#14b8a6',
    borderColor: '#14b8a6',
  },
  photoButtonText: {
    color: '#14b8a6',
    fontWeight: '600',
  },
  photoButtonTextPrimary: {
    color: '#ffffff',
    fontWeight: '600',
  },
  photoPreview: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photoThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  photoLabel: {
    fontSize: 14,
    color: '#64748b',
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
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f8fafc',
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
  addButton: {
    backgroundColor: '#14b8a6',
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
