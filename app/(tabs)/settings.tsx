import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { DollarSign, Save, Info, RefreshCw, Cloud } from 'lucide-react-native';
import { getDatabase } from '../../src/services/localDbService';
import { resolvePendingAddresses, getPendingAddressCount } from '../../src/services/addressResolutionService';
import { syncAllToCloud, getUnsyncedCount } from '../../src/services/cloudSyncService';

export default function SettingsScreen() {
  const [irsRate, setIrsRate] = useState('0.67');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingAddresses, setPendingAddresses] = useState(0);
  const [unsyncedCount, setUnsyncedCount] = useState({ trips: 0, vehicles: 0 });

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (mounted) {
        await loadSettings();
        await loadCounts();
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  async function loadCounts() {
    try {
      const count = await getPendingAddressCount();
      setPendingAddresses(count);

      const unsynced = await getUnsyncedCount();
      setUnsyncedCount(unsynced);
    } catch (error) {
      console.error('Failed to load counts:', error);
    }
  }

  async function loadSettings() {
    try {
      setLoading(true);
      const db = await getDatabase();
      const row = await db.getFirstAsync(
        'SELECT value FROM settings WHERE key = ?',
        ['irs_rate_per_mile']
      );

      if (row) {
        setIrsRate((row as any).value);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings() {
    const rate = parseFloat(irsRate);

    if (isNaN(rate) || rate <= 0) {
      Alert.alert('Error', 'Please enter a valid rate');
      return;
    }

    try {
      setSaving(true);
      const db = await getDatabase();

      await db.runAsync(
        'UPDATE settings SET value = ?, updated_at = ? WHERE key = ?',
        [rate.toString(), new Date().toISOString(), 'irs_rate_per_mile']
      );

      Alert.alert('Success', 'Settings saved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleResolveAddresses() {
    try {
      setResolving(true);

      const result = await resolvePendingAddresses();

      if (result.total === 0) {
        Alert.alert('No Addresses to Resolve', 'All trips have valid addresses.');
      } else {
        Alert.alert(
          'Address Resolution Complete',
          `Resolved: ${result.resolved}\nFailed: ${result.failed}\nTotal: ${result.total}`
        );
      }

      await loadCounts();
    } catch (error) {
      Alert.alert('Error', 'Failed to resolve addresses');
    } finally {
      setResolving(false);
    }
  }

  async function handleSyncToCloud() {
    try {
      setSyncing(true);

      const result = await syncAllToCloud();

      if (!result.success) {
        Alert.alert('Sync Failed', result.error || 'Unable to sync to cloud. Please check your internet connection.');
        return;
      }

      const message = `Trips: ${result.trips.synced} synced, ${result.trips.failed} failed\nVehicles: ${result.vehicles.synced} synced, ${result.vehicles.failed} failed`;

      Alert.alert('Sync Complete', message);

      await loadCounts();
    } catch (error) {
      Alert.alert('Error', 'Failed to sync to cloud');
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reimbursement Rate</Text>

        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <DollarSign size={20} color="#64748b" />
              <Text style={styles.label}>IRS Rate per Mile</Text>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.input}
                value={irsRate}
                onChangeText={setIrsRate}
                keyboardType="decimal-pad"
                placeholder="0.67"
              />
            </View>
          </View>

          <View style={styles.infoBox}>
            <Info size={16} color="#3b82f6" />
            <Text style={styles.infoText}>
              The standard IRS mileage rate for 2024 is $0.67 per mile for business use.
              Update this rate as needed.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveSettings}
            disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Save size={20} color="#ffffff" />
                <Text style={styles.saveButtonText}>Save Settings</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Offline Features</Text>

        <View style={styles.card}>
          <View style={styles.actionItem}>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Resolve Addresses</Text>
              <Text style={styles.actionDescription}>
                Retry geocoding for {pendingAddresses} trip{pendingAddresses !== 1 ? 's' : ''} with offline coordinates
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.actionButton, resolving && styles.actionButtonDisabled]}
              onPress={handleResolveAddresses}
              disabled={resolving || pendingAddresses === 0}>
              {resolving ? (
                <ActivityIndicator size="small" color="#14b8a6" />
              ) : (
                <RefreshCw size={20} color={pendingAddresses > 0 ? '#14b8a6' : '#94a3b8'} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.actionItem}>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Sync to Cloud</Text>
              <Text style={styles.actionDescription}>
                Upload {unsyncedCount.trips} trip{unsyncedCount.trips !== 1 ? 's' : ''} to Supabase (optional backup)
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.actionButton, syncing && styles.actionButtonDisabled]}
              onPress={handleSyncToCloud}
              disabled={syncing || unsyncedCount.trips === 0}>
              {syncing ? (
                <ActivityIndicator size="small" color="#3b82f6" />
              ) : (
                <Cloud size={20} color={unsyncedCount.trips > 0 ? '#3b82f6' : '#94a3b8'} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>

        <View style={styles.card}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>App Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>

          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Local Database</Text>
            <Text style={styles.aboutValue}>SQLite</Text>
          </View>

          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Cloud Backup</Text>
            <Text style={styles.aboutValue}>Supabase (Optional)</Text>
          </View>

          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Offline Mode</Text>
            <Text style={styles.aboutValueSuccess}>Enabled</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Features</Text>

        <View style={styles.card}>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>📍</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>GPS Tracking</Text>
              <Text style={styles.featureDescription}>
                Background location tracking for accurate mileage calculation
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>📷</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Odometer Photos</Text>
              <Text style={styles.featureDescription}>
                Monthly photo verification with cryptographic hashing
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🔒</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Cryptographic Signing</Text>
              <Text style={styles.featureDescription}>
                Tamper-proof reports with SHA-256 digital signatures
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>📊</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Export Reports</Text>
              <Text style={styles.featureDescription}>
                CSV, JSON, and bundled ZIP exports with map images
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>✈️</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Offline First</Text>
              <Text style={styles.featureDescription}>
                Full functionality without internet connection
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Auditproof Mileage</Text>
        <Text style={styles.footerSubtext}>
          Professional-grade mileage tracking for audits and compliance
        </Text>
      </View>
    </ScrollView>
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
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    paddingLeft: 12,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
    marginRight: 4,
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#3b82f6',
    lineHeight: 18,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14b8a6',
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  aboutLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  aboutValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  aboutValueSuccess: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  featureItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  featureIcon: {
    fontSize: 24,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#14b8a6',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  actionInfo: {
    flex: 1,
    marginRight: 12,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
});
