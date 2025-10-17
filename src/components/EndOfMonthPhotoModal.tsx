import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Alert } from 'react-native';
import { Camera, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

interface EndOfMonthPhotoModalProps {
  visible: boolean;
  vehicleName: string;
  monthYear: string;
  onPhotoTaken: (photoUri: string) => Promise<void>;
  onDismiss: () => void;
}

export default function EndOfMonthPhotoModal({
  visible,
  vehicleName,
  monthYear,
  onPhotoTaken,
  onDismiss,
}: EndOfMonthPhotoModalProps) {
  const [taking, setTaking] = useState(false);

  async function handleTakePhoto() {
    try {
      setTaking(true);
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
        await onPhotoTaken(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking end-of-month photo:', error);
      Alert.alert('Error', 'Failed to capture photo');
    } finally {
      setTaking(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>End-of-Month Verification</Text>
            <TouchableOpacity onPress={onDismiss}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <Text style={styles.vehicleName}>{vehicleName}</Text>
          <Text style={styles.monthLabel}>Month: {monthYear}</Text>

          <Text style={styles.description}>
            Please take a photo of your odometer to verify the ending mileage for {monthYear}.
            This helps maintain accurate records for tax purposes.
          </Text>

          <TouchableOpacity
            style={[styles.button, taking && styles.buttonDisabled]}
            onPress={handleTakePhoto}
            disabled={taking}
          >
            {taking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Camera size={20} color="#fff" />
                <Text style={styles.buttonText}>Take Ending Photo</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.laterButton} onPress={onDismiss}>
            <Text style={styles.laterText}>Remind Me Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  vehicleName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 8,
  },
  monthLabel: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 10,
    gap: 8,
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  laterButton: {
    padding: 12,
    alignItems: 'center',
  },
  laterText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '500',
  },
});
