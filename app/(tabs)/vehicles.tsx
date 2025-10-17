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
import { Camera, Plus, X, ChevronDown, ChevronUp, Download, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { Vehicle, VehiclePhoto, MonthlyPhotoRecord } from '../../src/types';
import { getVehicles, addVehicle, deleteVehicle } from '../../src/services/simpleVehicleService';
import {
  saveOdometerPhoto,
  getMonthlyRecordsByVehicle,
  getCurrentMonthYear,
} from '../../src/services/odometerPhotoService';
import {
  checkNewVehicleNeedsStartPhoto,
  markPromptShown,
  markEndOfMonthPromptShown,
} from '../../src/services/photoPromptService';
import OdometerPhotoViewer from '../../src/components/OdometerPhotoViewer';
import PhotoPromptModal from '../../src/components/PhotoPromptModal';
import EndOfMonthPhotoModal from '../../src/components/EndOfMonthPhotoModal';
import StartOfMonthPhotoModal from '../../src/components/StartOfMonthPhotoModal';
import { usePhotoPrompts } from '../../hooks/usePhotoPrompts';
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

  const { pendingPrompts, clearPrompt, checkForPrompts } = usePhotoPrompts();
  const [currentPrompt, setCurrentPrompt] = useState<{
    vehicleId: string;
    vehicleName: string;
    monthYear: string;
  } | null>(null);

  const [newVehicle, setNewVehicle] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    license_plate: '',
    photoUri: null as string | null,
  });
  const [takingInitialPhoto, setTakingInitialPhoto] = useState(false);

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
      checkForPrompts();
    }, [])
  );

  useEffect(() => {
    if (pendingPrompts.length > 0 && !currentPrompt) {
      // Prioritize end-of-month prompts (previous month) over start-of-month (current month)
      const endPrompt = pendingPrompts.find(p => p.type === 'end');
      setCurrentPrompt(endPrompt || pendingPrompts[0]);
    }
  }, [pendingPrompts, currentPrompt]);

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

  async function handleTakeInitialPhoto() {
    try {
      setTakingInitialPhoto(true);
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
        setNewVehicle({ ...newVehicle, photoUri: result.assets[0].uri });
      }
    } catch (error) {
      console.error('Error taking initial photo:', error);
      Alert.alert('Error', 'Failed to capture photo');
    } finally {
      setTakingInitialPhoto(false);
    }
  }

  async function handleAddVehicle() {
    if (!newVehicle.make || !newVehicle.model || !newVehicle.license_plate) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!newVehicle.photoUri) {
      Alert.alert('Photo Required', 'Please take a starting odometer photo before saving the vehicle.');
      return;
    }

    try {
      const vehicle = await addVehicle(
        newVehicle.make,
        newVehicle.model,
        newVehicle.year,
        newVehicle.license_plate
      );

      if (!vehicle || !vehicle.id) {
        throw new Error('Vehicle creation failed - no vehicle returned');
      }

      // Save the initial odometer photo
      await saveOdometerPhoto(vehicle.id, 'start', newVehicle.photoUri);

      setShowAddModal(false);
      setNewVehicle({
        make: '',
        model: '',
        year: new Date().getFullYear(),
        license_plate: '',
        photoUri: null,
      });

      await loadData();
      Alert.alert('Success', 'Vehicle added with starting odometer photo');
    } catch (err) {
      console.error('Error adding vehicle:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create vehicle';
      Alert.alert('Error', errorMessage);
    }
  }

  async function handleStartOfMonthPhoto(photoUri: string) {
    if (!currentPrompt || currentPrompt.type !== 'start') return;

    try {
      await saveOdometerPhoto(currentPrompt.vehicleId, 'start', photoUri, currentPrompt.monthYear);
      await markPromptShown(currentPrompt.vehicleId);
      clearPrompt(currentPrompt.vehicleId);
      setCurrentPrompt(null);
      await loadData();
      Alert.alert('Success', 'Start-of-month odometer photo saved');
    } catch (error) {
      console.error('Error saving start-of-month photo:', error);
      Alert.alert('Error', 'Failed to save photo');
    }
  }

  async function handleEndOfMonthPhoto(photoUri: string) {
    if (!currentPrompt || currentPrompt.type !== 'end') return;

    try {
      await saveOdometerPhoto(currentPrompt.vehicleId, 'end', photoUri, currentPrompt.monthYear);
      await markEndOfMonthPromptShown(currentPrompt.vehicleId, currentPrompt.monthYear);
      clearPrompt(currentPrompt.vehicleId);
      setCurrentPrompt(null);
      await loadData();
      Alert.alert('Success', 'End-of-month odometer photo saved');
    } catch (error) {
      console.error('Error saving end-of-month photo:', error);
      Alert.alert('Error', 'Failed to save photo');
    }
  }

  function handleDismissEndOfMonthPrompt() {
    setCurrentPrompt(null);
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

  async function handleDeleteVehicle(vehicleId: string, vehicleName: string) {
    Alert.alert(
      'Delete Vehicle',
      `Are you sure you want to delete ${vehicleName}? This will remove all associated photos and trip data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteVehicle(vehicleId);
              await loadData();
              Alert.alert('Success', 'Vehicle deleted');
            } catch (error) {
              console.error('Error deleting vehicle:', error);
              Alert.alert('Error', 'Failed to delete vehicle');
            }
          },
        },
      ]
    );
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
        <View style={styles.vehicleHeader}>
          <TouchableOpacity
            onPress={() => toggleExpanded(item.id)}
            activeOpacity={0.7}
            style={styles.vehicleHeaderMain}
          >
            <View style={styles.vehicleInfo}>
              <Text style={styles.vehicleName}>
                {item.year} {item.make} {item.model}
              </Text>
              <Text style={styles.licensePlate}>{item.license_plate}</Text>
            </View>
            {isExpanded ? <ChevronUp size={24} color="#64748b" /> : <ChevronDown size={24} color="#64748b" />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() =>
              handleDeleteVehicle(item.id, `${item.year} ${item.make} ${item.model}`)
            }
          >
            <Trash2 size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>

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

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Starting Odometer Photo *</Text>
                    <TouchableOpacity
                      style={[styles.photoButton, newVehicle.photoUri && styles.photoButtonSuccess]}
                      onPress={handleTakeInitialPhoto}
                      disabled={takingInitialPhoto}
                    >
                      <Camera size={20} color="#fff" />
                      <Text style={styles.photoButtonText}>
                        {takingInitialPhoto
                          ? 'Opening Camera...'
                          : newVehicle.photoUri
                          ? 'Photo Captured ✓'
                          : 'Take Photo'}
                      </Text>
                    </TouchableOpacity>
                    {newVehicle.photoUri && (
                      <Image source={{ uri: newVehicle.photoUri }} style={styles.photoPreview} />
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.addButton, !newVehicle.photoUri && styles.addButtonDisabled]}
                    onPress={handleAddVehicle}
                    disabled={!newVehicle.photoUri}
                  >
                    <Text style={styles.addButtonText}>Add Vehicle</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Start-of-Month Photo Prompt */}
      {currentPrompt && currentPrompt.type === 'start' && (
        <StartOfMonthPhotoModal
          visible={true}
          vehicleName={currentPrompt.vehicleName}
          monthYear={currentPrompt.monthYear}
          onPhotoTaken={handleStartOfMonthPhoto}
          onDismiss={handleDismissEndOfMonthPrompt}
        />
      )}

      {/* End-of-Month Photo Prompt */}
      {currentPrompt && currentPrompt.type === 'end' && (
        <EndOfMonthPhotoModal
          visible={true}
          vehicleName={currentPrompt.vehicleName}
          monthYear={currentPrompt.monthYear}
          onPhotoTaken={handleEndOfMonthPhoto}
          onDismiss={handleDismissEndOfMonthPrompt}
        />
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
    elevation: 3,
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehicleHeaderMain: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehicleInfo: { flex: 1 },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
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
  addButtonDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.6,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  photoButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  photoButtonSuccess: {
    backgroundColor: '#10b981',
  },
  photoButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginTop: 12,
  },
});
