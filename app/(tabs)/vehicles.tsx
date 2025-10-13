import { useState, useEffect } from "react";
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
  Animated,
} from "react-native";
import { Camera, Plus, X, Check } from "lucide-react-native";
import {
  getVehicles,
  addVehicle,
  saveOdometerPhoto,
  takeOdometerPhoto,
} from "../../src/services/vehicleService";
import { Vehicle } from "../../src/types";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as SQLite from "expo-sqlite";
import ImageViewer from "react-native-image-zoom-viewer";

const db = SQLite.openDatabaseSync("auditproof.db");

/* -------------------------------------------------------------------------- */
/*                           Local photo tracking DB                          */
/* -------------------------------------------------------------------------- */
function initVehiclePhotosTable() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS vehicle_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id TEXT NOT NULL,
      month TEXT NOT NULL,
      photo_path TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getVehiclePhoto(
  vehicleId: string | number,
  month: string
): Promise<string | null> {
  const rows = db.getAllSync<{ photo_path: string }>(
    "SELECT photo_path FROM vehicle_photos WHERE vehicle_id = ? AND month = ? LIMIT 1;",
    [vehicleId, month]
  );
  return rows.length ? rows[0].photo_path : null;
}

async function saveVehiclePhoto(
  vehicleId: string | number,
  month: string,
  photoPath: string
): Promise<void> {
  db.runSync(
    "INSERT INTO vehicle_photos (vehicle_id, month, photo_path) VALUES (?, ?, ?);",
    [vehicleId, month, photoPath]
  );
}

/* -------------------------------------------------------------------------- */
/*                                Main screen                                 */
/* -------------------------------------------------------------------------- */
export default function VehiclesScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<{
    uri: string;
    vehicleId: string | number;
    label: string;
  } | null>(null);
  const [newVehicle, setNewVehicle] = useState({
    make: "",
    model: "",
    year: new Date().getFullYear(),
    license_plate: "",
  });

  // Fade animation for photo preview modal
  const fadeAnim = useState(new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: previewVisible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [previewVisible]);

  useEffect(() => {
    initVehiclePhotosTable();
    loadVehicles();
  }, []);

  async function loadVehicles() {
    try {
      setLoading(true);
      const data = await getVehicles();
      setVehicles(data);
    } catch (err) {
      console.error("Error loading vehicles:", err);
      Alert.alert("Error", "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddVehicle() {
    if (!newVehicle.make || !newVehicle.model || !newVehicle.license_plate) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    try {
      await addVehicle(newVehicle.make);
      setShowAddModal(false);
      setNewVehicle({
        make: "",
        model: "",
        year: new Date().getFullYear(),
        license_plate: "",
      });
      loadVehicles();
    } catch (err) {
      console.error("Error adding vehicle:", err);
      Alert.alert("Error", "Failed to create vehicle");
    }
  }

  async function handleTakePhoto(vehicle: Vehicle, type: "start" | "end") {
    try {
      setCapturingPhoto(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (result.canceled) return;

      const photo = result.assets[0];
      const destination = `${FileSystem.documentDirectory}odometer_${vehicle.id}_${type}_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: photo.uri, to: destination });

      await saveOdometerPhoto(vehicle.id, destination);
      await loadVehicles();

      Alert.alert("Success", "Odometer photo saved locally.");
    } catch (error) {
      console.error("Error saving odometer photo:", error);
      Alert.alert("Error", "Failed to save photo");
    } finally {
      setCapturingPhoto(false);
    }
  }

  function getVehicleStatus(vehicle: Vehicle) {
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (
      vehicle.month_year === currentMonth &&
      vehicle.photo_odometer_start &&
      vehicle.photo_odometer_end
    ) {
      return { icon: <Check size={16} color="#10b981" />, color: "#10b981", text: "Verified" };
    }
    if (vehicle.month_year === currentMonth && vehicle.photo_odometer_start) {
      return {
        icon: <Camera size={16} color="#f59e0b" />,
        color: "#f59e0b",
        text: "Pending end photo",
      };
    }
    return {
      icon: <X size={16} color="#ef4444" />,
      color: "#ef4444",
      text: "Missing start photo",
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
            <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
          </View>
        </View>

        <Text style={styles.licensePlate}>{item.license_plate}</Text>

        <View style={styles.photoButtons}>
          {needsStartPhoto ? (
            <TouchableOpacity
              style={[styles.photoButton, styles.primaryButton]}
              onPress={() => handleTakePhoto(item, "start")}
              disabled={capturingPhoto}
            >
              {capturingPhoto ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Camera size={20} color="#fff" />
                  <Text style={styles.photoButtonTextPrimary}>Take Start Photo</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.photoButton}
              onPress={() => handleTakePhoto(item, "end")}
              disabled={capturingPhoto}
            >
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

        {/* Start Photo */}
        {item.photo_odometer_start && (
          <TouchableOpacity
            onPress={() => {
              setPreviewPhoto({
                uri: item.photo_odometer_start ?? "",
                vehicleId: item.id,
                label: "Start Photo",
              });
              setPreviewVisible(true);
            }}
          >
            <View style={styles.photoPreview}>
              <Image
                source={{ uri: item.photo_odometer_start ?? "" }}
                style={styles.photoThumbnail}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.photoLabel}>Start Photo</Text>
                <TouchableOpacity
                  onPress={async () => {
                    const newPhoto = await takeOdometerPhoto(item.id);
                    if (newPhoto) {
                      Alert.alert("✅ Updated", "Start photo replaced successfully.");
                      await loadVehicles();
                    }
                  }}
                  style={styles.retakeButton}
                >
                  <Text style={styles.retakeButtonText}>Retake Photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* End Photo */}
        {item.photo_odometer_end && (
          <TouchableOpacity
            onPress={() => {
              setPreviewPhoto({
                uri: item.photo_odometer_end ?? "",
                vehicleId: item.id,
                label: "End Photo",
              });
              setPreviewVisible(true);
            }}
          >
            <View style={styles.photoPreview}>
              <Image
                source={{ uri: item.photo_odometer_end ?? "" }}
                style={styles.photoThumbnail}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.photoLabel}>End Photo</Text>
                <TouchableOpacity
                  onPress={async () => {
                    const newPhoto = await takeOdometerPhoto(item.id);
                    if (newPhoto) {
                      Alert.alert("✅ Updated", "End photo replaced successfully.");
                      await loadVehicles();
                    }
                  }}
                  style={styles.retakeButton}
                >
                  <Text style={styles.retakeButtonText}>Retake Photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
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
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No vehicles added yet</Text>
            <Text style={styles.emptySubtext}>Add a vehicle to start tracking mileage</Text>
          </View>
        }
      />

      {/* Floating Add Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Plus size={24} color="#fff" />
      </TouchableOpacity>

      {/* Add Vehicle Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Vehicle</Text>
            <TextInput
              style={styles.input}
              placeholder="Make"
              value={newVehicle.make}
              onChangeText={(t) => setNewVehicle({ ...newVehicle, make: t })}
            />
            <TextInput
              style={styles.input}
              placeholder="Model"
              value={newVehicle.model}
              onChangeText={(t) => setNewVehicle({ ...newVehicle, model: t })}
            />
            <TextInput
              style={styles.input}
              placeholder="Year"
              keyboardType="numeric"
              value={newVehicle.year.toString()}
              onChangeText={(t) =>
                setNewVehicle({ ...newVehicle, year: parseInt(t) || new Date().getFullYear() })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="License Plate"
              value={newVehicle.license_plate}
              onChangeText={(t) => setNewVehicle({ ...newVehicle, license_plate: t })}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.addButton]}
                onPress={handleAddVehicle}
              >
                <Text style={styles.addButtonText}>Add Vehicle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fullscreen Photo Preview with Fade */}
      <Modal visible={previewVisible} transparent animationType="none">
        <Animated.View style={[styles.previewContainer, { opacity: fadeAnim }]}>
          {previewPhoto && (
            <>
              <Text style={styles.previewTitle}>{previewPhoto.label}</Text>
              <TouchableOpacity
                style={styles.previewClose}
                onPress={() => setPreviewVisible(false)}
              >
                <X size={28} color="#fff" />
              </TouchableOpacity>

              <ImageViewer
                imageUrls={[{ url: previewPhoto.uri }]}
                enableSwipeDown
                onSwipeDown={() => setPreviewVisible(false)}
              />

              <TouchableOpacity
                style={styles.previewRetakeButton}
                onPress={async () => {
                  const newPhoto = await takeOdometerPhoto(previewPhoto.vehicleId);
                  if (newPhoto) {
                    Alert.alert("✅ Updated", `${previewPhoto.label} replaced successfully.`);
                    setPreviewVisible(false);
                    await loadVehicles();
                  }
                }}
              >
                <Text style={styles.previewRetakeText}>Retake Photo</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </Modal>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Styles                                   */
/* -------------------------------------------------------------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 16 },
  vehicleCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vehicleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  vehicleName: { fontSize: 18, fontWeight: "600", color: "#1e293b", flex: 1 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: { fontSize: 12, fontWeight: "600" },
  licensePlate: { fontSize: 14, color: "#64748b", marginBottom: 16 },
  photoButtons: { gap: 8 },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#14b8a6",
    gap: 8,
  },
  primaryButton: { backgroundColor: "#14b8a6", borderColor: "#14b8a6" },
  photoButtonText: { color: "#14b8a6", fontWeight: "600" },
  photoButtonTextPrimary: { color: "#fff", fontWeight: "600" },
  photoPreview: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  photoThumbnail: { width: 60, height: 60, borderRadius: 8 },
  photoLabel: { fontSize: 14, color: "#64748b" },
  retakeButton: {
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#14b8a6",
    alignSelf: "flex-start",
  },
  retakeButtonText: { color: "#14b8a6", fontWeight: "600", fontSize: 13 },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyText: { fontSize: 18, fontWeight: "600", color: "#64748b", marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: "#94a3b8" },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#14b8a6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: { fontSize: 24, fontWeight: "600", color: "#1e293b", marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: "#f8fafc",
  },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 8 },
  modalButton: { flex: 1, padding: 14, borderRadius: 8, alignItems: "center" },
  cancelButton: { backgroundColor: "#f1f5f9" },
  cancelButtonText: { color: "#64748b", fontWeight: "600" },
  addButton: { backgroundColor: "#14b8a6" },
  addButtonText: { color: "#fff", fontWeight: "600" },
  previewContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewTitle: {
    position: "absolute",
    top: 60,
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
  },
  previewClose: { position: "absolute", top: 40, right: 20, zIndex: 10 },
  previewRetakeButton: {
    position: "absolute",
    bottom: 60,
    backgroundColor: "#14b8a6",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  previewRetakeText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
