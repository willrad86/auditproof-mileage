import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import ImageView from 'react-native-image-viewing';
import { VehiclePhoto } from '../types';
import { Camera, X } from 'lucide-react-native';

interface OdometerPhotoViewerProps {
  photo: VehiclePhoto;
  vehicleName: string;
  visible: boolean;
  onClose: () => void;
  onRetake: () => void;
}

export default function OdometerPhotoViewer({
  photo,
  vehicleName,
  visible,
  onClose,
  onRetake,
}: OdometerPhotoViewerProps) {
  const photoTypeLabel = photo.photo_type === 'start' ? 'Start' : 'End';
  const headerText = `${photoTypeLabel} – ${photo.month_year} – ${vehicleName}`;

  const handleRetake = () => {
    Alert.alert(
      'Retake Photo',
      `Replace the ${photoTypeLabel} photo for ${photo.month_year}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Retake',
          onPress: () => {
            onClose();
            setTimeout(() => onRetake(), 300);
          },
        },
      ]
    );
  };

  return (
    <ImageView
      images={[{ uri: photo.photo_uri }]}
      imageIndex={0}
      visible={visible}
      onRequestClose={onClose}
      HeaderComponent={() => (
        <View style={styles.header}>
          <Text style={styles.headerText}>{headerText}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      FooterComponent={() => (
        <View style={styles.footer}>
          <TouchableOpacity onPress={handleRetake} style={styles.retakeButton}>
            <Camera size={20} color="#fff" />
            <Text style={styles.retakeText}>Retake Photo</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  headerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  retakeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
