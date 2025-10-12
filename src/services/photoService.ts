import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Platform } from 'react-native';

export interface PhotoCaptureResult {
  success: boolean;
  uri?: string;
  error?: string;
}

export const photoService = {
  async requestPermissions(): Promise<boolean> {
    try {
      const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
      const mediaLibraryStatus = await MediaLibrary.requestPermissionsAsync();

      if (!cameraStatus.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Auditproof Mileage Logger needs camera access to capture odometer photos. Please enable it in your device settings.',
          [{ text: 'OK' }]
        );
        return false;
      }

      if (!mediaLibraryStatus.granted) {
        Alert.alert(
          'Storage Permission Required',
          'Auditproof Mileage Logger needs storage access to save odometer photos. Please enable it in your device settings.',
          [{ text: 'OK' }]
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert(
        'Permission Error',
        'Failed to request permissions. Please check your device settings.',
        [{ text: 'OK' }]
      );
      return false;
    }
  },

  async captureOdometerPhoto(): Promise<PhotoCaptureResult> {
    try {
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        return {
          success: false,
          error: 'Permissions not granted',
        };
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
        exif: true,
      });

      if (result.canceled) {
        return {
          success: false,
          error: 'Photo capture cancelled',
        };
      }

      const photoUri = result.assets[0].uri;

      try {
        const asset = await MediaLibrary.createAssetAsync(photoUri);
        console.log('Photo saved to media library:', asset.uri);

        return {
          success: true,
          uri: asset.uri,
        };
      } catch (saveError) {
        console.warn('Failed to save to media library, using temporary URI:', saveError);

        return {
          success: true,
          uri: photoUri,
        };
      }
    } catch (error) {
      console.error('Error capturing photo:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      Alert.alert(
        'Photo Capture Failed',
        `Failed to capture odometer photo: ${errorMessage}. Please try again.`,
        [{ text: 'OK' }]
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  async checkPermissions(): Promise<{
    camera: boolean;
    mediaLibrary: boolean;
  }> {
    try {
      const cameraStatus = await ImagePicker.getCameraPermissionsAsync();
      const mediaLibraryStatus = await MediaLibrary.getPermissionsAsync();

      return {
        camera: cameraStatus.granted,
        mediaLibrary: mediaLibraryStatus.granted,
      };
    } catch (error) {
      console.error('Error checking permissions:', error);
      return {
        camera: false,
        mediaLibrary: false,
      };
    }
  },
};
