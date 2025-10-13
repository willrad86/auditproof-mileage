import { View, Text, StyleSheet, Modal, TouchableOpacity, Alert } from 'react-native';
import { Camera, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { PhotoPrompt } from '../services/photoPromptService';

interface PhotoPromptModalProps {
  prompt: PhotoPrompt | null;
  visible: boolean;
  onPhotoTaken: (uri: string) => void;
  onDismiss: () => void;
  onSkip: () => void;
}

export default function PhotoPromptModal({
  prompt,
  visible,
  onPhotoTaken,
  onDismiss,
  onSkip,
}: PhotoPromptModalProps) {
  if (!prompt) return null;

  const photoTypeLabel = prompt.promptType === 'start' ? 'Start of Month' : 'End of Month';
  const message =
    prompt.promptType === 'start'
      ? `Take your ${photoTypeLabel} odometer photo for ${prompt.vehicleName}.`
      : `Take your ${photoTypeLabel} odometer photo for ${prompt.vehicleName} after finishing your last trip for the day.`;

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera access in your device settings to take odometer photos.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        onPhotoTaken(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Odometer Photo Required</Text>
            <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.badge}>
              <Camera size={32} color="#3b82f6" />
            </View>

            <Text style={styles.vehicleName}>{prompt.vehicleName}</Text>
            <Text style={styles.monthYear}>{prompt.monthYear}</Text>
            <Text style={styles.message}>{message}</Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity onPress={handleTakePhoto} style={styles.takePhotoButton}>
                <Camera size={20} color="#fff" />
                <Text style={styles.takePhotoText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
                <Text style={styles.skipText}>Skip for Now</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  vehicleName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 4,
  },
  monthYear: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 16,
  },
  message: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  takePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  takePhotoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '500',
  },
});
