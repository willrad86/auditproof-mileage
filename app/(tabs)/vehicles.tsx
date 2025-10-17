import { useState, useEffect, useCallback, useRef } from 'react';
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
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
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

  // --- fade animation for modal overlay
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showAddModal) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [showAddModal]);

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
      const errorMessage = err instanceof Error ? err.message : 'Failed to create vehicle';
      Alert.alert('Error', `Failed to create vehicle: ${errorMessage}`);
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

  function toggleExpanded(vehicleId: string) {
    const newExpanded = new Set(expandedVehicles);
    if (newExpanded.has(vehicleId)) newExpanded.delete(vehicleId);
    else newExpanded.add(vehicleId);
    setExpandedVehicles(newExpanded);
  }

  // --- render vehicle list
  function renderVehicle({ item }: { item: Vehicle }) {
    const isExpanded = expandedVehicles.has(item.id);
    const records = monthlyRecords.get(item.id) || [];
    const currentMonthYear = getCurrentMonthYear();
    const currentMonthRecord = records.find(r => r.month_year === currentMonthYear);

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
            {isExpanded ? <ChevronUp size={24} color="#64748b" /> : <ChevronDown size={24} color="#64748b" />}
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Current Month ({currentMonthYear})</Text>
            </View>
            <View style={styles.currentMonthPhotos}>
              {/* ... PhotoCards stay unchanged ... */}
            </View>
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
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Plus size={24} color="#fff" />
      </TouchableOpacity>

      {/* --- Animated Add Vehicle Modal --- */}
      <Modal visible={showAddModal} animationType="fade" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <Animated.View
              style={[
                styles.modalOverlay,
                {
                  opacity: fadeAnim,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                },
              ]}
            >
              <View style={styles.modalContent}>
                <ScrollView
                  contentContainerStyle={{ paddingBottom: 20 }}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator={false}
                >
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
                </ScrollView>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
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
  expandedContent: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 16 },
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
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
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
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 6 },
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
