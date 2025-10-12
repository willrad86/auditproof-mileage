import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react-native';

interface DiagnosticsModalProps {
  visible: boolean;
  onClose: () => void;
}

interface DiagnosticInfo {
  fg: string;
  bg: string;
  taskActive: boolean;
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null;
  time: string;
}

export default function DiagnosticsModal({ visible, onClose }: DiagnosticsModalProps) {
  const [info, setInfo] = useState<DiagnosticInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      load();
    }
  }, [visible]);

  async function load() {
    setLoading(true);
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      const bg = await Location.getBackgroundPermissionsAsync();
      const last = await Location.getLastKnownPositionAsync();
      const tasks = await TaskManager.getRegisteredTasksAsync();
      const taskActive = tasks.some((t) => t.taskName === 'AUTO_TRIP_TRACKING_TASK');

      setInfo({
        fg: fg.status,
        bg: bg.status,
        taskActive,
        coords: last?.coords
          ? {
              latitude: last.coords.latitude,
              longitude: last.coords.longitude,
              accuracy: last.coords.accuracy || 0,
            }
          : null,
        time: last?.timestamp ? new Date(last.timestamp).toLocaleTimeString() : 'N/A',
      });
    } catch (error) {
      console.error('Error loading diagnostics:', error);
    }
    setLoading(false);
  }

  function getStatusIcon(status: string) {
    if (status === 'granted') {
      return <CheckCircle size={20} color="#10b981" />;
    }
    return <AlertCircle size={20} color="#ef4444" />;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Location Diagnostics</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent}>
            {loading && (
              <View style={styles.centerContent}>
                <Text style={styles.loadingText}>Loading diagnostics...</Text>
              </View>
            )}

            {!loading && info && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Permission Status</Text>
                  <View style={styles.diagnosticRow}>
                    {getStatusIcon(info.fg)}
                    <Text style={styles.diagnosticLabel}>Foreground:</Text>
                    <Text
                      style={[
                        styles.diagnosticValue,
                        info.fg === 'granted' ? styles.statusGood : styles.statusBad,
                      ]}>
                      {info.fg}
                    </Text>
                  </View>
                  <View style={styles.diagnosticRow}>
                    {getStatusIcon(info.bg)}
                    <Text style={styles.diagnosticLabel}>Background:</Text>
                    <Text
                      style={[
                        styles.diagnosticValue,
                        info.bg === 'granted' ? styles.statusGood : styles.statusBad,
                      ]}>
                      {info.bg}
                    </Text>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Background Task</Text>
                  <View style={styles.diagnosticRow}>
                    {info.taskActive ? (
                      <CheckCircle size={20} color="#10b981" />
                    ) : (
                      <AlertCircle size={20} color="#ef4444" />
                    )}
                    <Text style={styles.diagnosticLabel}>Task Active:</Text>
                    <Text
                      style={[
                        styles.diagnosticValue,
                        info.taskActive ? styles.statusGood : styles.statusBad,
                      ]}>
                      {info.taskActive ? 'Yes' : 'No'}
                    </Text>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Last Known Location</Text>
                  {info.coords ? (
                    <>
                      <View style={styles.diagnosticRow}>
                        <Info size={20} color="#14b8a6" />
                        <Text style={styles.diagnosticLabel}>Latitude:</Text>
                        <Text style={styles.diagnosticValue}>
                          {info.coords.latitude.toFixed(5)}
                        </Text>
                      </View>
                      <View style={styles.diagnosticRow}>
                        <Info size={20} color="#14b8a6" />
                        <Text style={styles.diagnosticLabel}>Longitude:</Text>
                        <Text style={styles.diagnosticValue}>
                          {info.coords.longitude.toFixed(5)}
                        </Text>
                      </View>
                      <View style={styles.diagnosticRow}>
                        <Info size={20} color="#14b8a6" />
                        <Text style={styles.diagnosticLabel}>Accuracy:</Text>
                        <Text style={styles.diagnosticValue}>
                          ±{info.coords.accuracy.toFixed(1)} m
                        </Text>
                      </View>
                      <View style={styles.diagnosticRow}>
                        <Info size={20} color="#14b8a6" />
                        <Text style={styles.diagnosticLabel}>Time:</Text>
                        <Text style={styles.diagnosticValue}>{info.time}</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.diagnosticRow}>
                      <AlertCircle size={20} color="#f59e0b" />
                      <Text style={styles.diagnosticLabel}>No location data available</Text>
                    </View>
                  )}
                </View>

                <View style={styles.infoBox}>
                  <Info size={20} color="#14b8a6" />
                  <Text style={styles.infoText}>
                    For automatic trip detection, ensure background permission is set to "Always"
                    and the background task is active.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.closeBottomButton} onPress={onClose}>
            <Text style={styles.closeBottomButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 20,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 15,
    color: '#64748b',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  diagnosticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  diagnosticLabel: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '500',
  },
  diagnosticValue: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '600',
  },
  statusGood: {
    color: '#10b981',
  },
  statusBad: {
    color: '#ef4444',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#e0f2f1',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#b2dfdb',
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#00695c',
    lineHeight: 20,
  },
  closeBottomButton: {
    backgroundColor: '#14b8a6',
    margin: 20,
    marginTop: 0,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeBottomButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
