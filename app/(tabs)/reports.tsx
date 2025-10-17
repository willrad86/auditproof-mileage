import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { FileText, Download, CheckCircle, AlertCircle } from 'lucide-react-native';
import { supabase } from '../../src/utils/supabaseClient';
import { getVehicles } from '../../src/services/simpleVehicleService';
import { exportMonthlyReport, shareReport, verifyReport } from '../../src/services/exportService';
import { Vehicle, Report } from '../../src/types';

export default function ReportsScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (mounted) {
        await loadData();
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [reportsData, vehiclesData] = await Promise.all([
        loadReports(),
        getVehicles(),
      ]);

      setReports(reportsData);
      setVehicles(vehiclesData);

      const currentMonth = new Date().toISOString().slice(0, 7);
      setSelectedMonth(currentMonth);
    } catch (error) {
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function loadReports(): Promise<Report[]> {
    if (!supabase) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('signed_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn('Failed to load reports from cloud:', error);
      return [];
    }
  }

  async function handleExportReport() {
    if (!selectedVehicleId || !selectedMonth) {
      Alert.alert('Error', 'Please select a vehicle and month');
      return;
    }

    try {
      setExporting(true);
      const reportDir = await exportMonthlyReport(selectedVehicleId, selectedMonth);

      Alert.alert(
        'Success',
        'Report generated successfully',
        [
          {
            text: 'Share',
            onPress: () => shareReport(reportDir),
          },
          { text: 'OK' },
        ]
      );

      setShowExportModal(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to export report');
    } finally {
      setExporting(false);
    }
  }

  async function handleVerifyReport(report: Report) {
    if (!report.export_uri) {
      Alert.alert('Error', 'Report export path not found');
      return;
    }

    try {
      const result = await verifyReport(report.export_uri);

      Alert.alert(
        result.valid ? 'Verified' : 'Verification Failed',
        result.message,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to verify report');
    }
  }

  async function handleShareReport(report: Report) {
    if (!report.export_uri) {
      Alert.alert('Error', 'Report export path not found');
      return;
    }

    try {
      await shareReport(report.export_uri);
    } catch (error) {
      Alert.alert('Error', 'Failed to share report');
    }
  }

  function getMonthOptions(): string[] {
    const months: string[] = [];
    const now = new Date();

    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(date.toISOString().slice(0, 7));
    }

    return months;
  }

  function formatMonthYear(monthYear: string): string {
    const [year, month] = monthYear.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function renderReport({ item }: { item: Report }) {
    const vehicle = vehicles.find((v) => v.id === item.vehicle_id);

    return (
      <View style={styles.reportCard}>
        <View style={styles.reportHeader}>
          <View style={styles.reportInfo}>
            <Text style={styles.reportVehicle}>
              {vehicle
                ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
                : 'Unknown Vehicle'}
            </Text>
            <Text style={styles.reportMonth}>{formatMonthYear(item.month_year)}</Text>
          </View>

          <View style={styles.verifiedBadge}>
            <CheckCircle size={20} color="#10b981" />
            <Text style={styles.verifiedText}>Signed</Text>
          </View>
        </View>

        <View style={styles.reportStats}>
          <View style={styles.reportStat}>
            <Text style={styles.statLabel}>Trips</Text>
            <Text style={styles.statValue}>{item.trip_count}</Text>
          </View>

          <View style={styles.reportStat}>
            <Text style={styles.statLabel}>Miles</Text>
            <Text style={styles.statValue}>{item.total_miles.toFixed(1)}</Text>
          </View>

          <View style={styles.reportStat}>
            <Text style={styles.statLabel}>Value</Text>
            <Text style={styles.statValue}>${item.total_value.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.reportActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleVerifyReport(item)}>
            <AlertCircle size={18} color="#14b8a6" />
            <Text style={styles.actionButtonText}>Verify</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleShareReport(item)}>
            <Download size={18} color="#14b8a6" />
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hashContainer}>
          <Text style={styles.hashLabel}>Report Hash:</Text>
          <Text style={styles.hashText} numberOfLines={1}>
            {item.report_hash}
          </Text>
        </View>
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Monthly Reports</Text>
        <Text style={styles.headerSubtitle}>
          Cryptographically signed and tamper-proof
        </Text>
      </View>

      <FlatList
        data={reports}
        renderItem={renderReport}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FileText size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>No reports generated</Text>
            <Text style={styles.emptySubtext}>
              Export a monthly report to get started
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowExportModal(true)}>
        <FileText size={24} color="#ffffff" />
      </TouchableOpacity>

      <Modal visible={showExportModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Export Monthly Report</Text>

            <Text style={styles.label}>Select Vehicle</Text>
            <View style={styles.vehicleList}>
              {vehicles.map((vehicle) => (
                <TouchableOpacity
                  key={vehicle.id}
                  style={[
                    styles.vehicleOption,
                    selectedVehicleId === vehicle.id && styles.vehicleOptionSelected,
                  ]}
                  onPress={() => setSelectedVehicleId(vehicle.id)}>
                  <Text
                    style={[
                      styles.vehicleOptionText,
                      selectedVehicleId === vehicle.id &&
                        styles.vehicleOptionTextSelected,
                    ]}>
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Select Month</Text>
            <View style={styles.monthList}>
              {getMonthOptions().map((month) => (
                <TouchableOpacity
                  key={month}
                  style={[
                    styles.monthOption,
                    selectedMonth === month && styles.monthOptionSelected,
                  ]}
                  onPress={() => setSelectedMonth(month)}>
                  <Text
                    style={[
                      styles.monthOptionText,
                      selectedMonth === month && styles.monthOptionTextSelected,
                    ]}>
                    {formatMonthYear(month)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowExportModal(false)}
                disabled={exporting}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.exportButton]}
                onPress={handleExportReport}
                disabled={exporting}>
                {exporting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.exportButtonText}>Export</Text>
                )}
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
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  listContent: {
    padding: 16,
  },
  reportCard: {
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
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  reportInfo: {
    flex: 1,
  },
  reportVehicle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  reportMonth: {
    fontSize: 14,
    color: '#64748b',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  reportStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  reportStat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  reportActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#14b8a6',
    gap: 6,
  },
  actionButtonText: {
    color: '#14b8a6',
    fontWeight: '600',
    fontSize: 14,
  },
  hashContainer: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 6,
  },
  hashLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
  },
  hashText: {
    fontSize: 10,
    color: '#94a3b8',
    fontFamily: 'monospace',
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
    marginTop: 16,
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
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  vehicleList: {
    gap: 8,
    marginBottom: 20,
  },
  vehicleOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  vehicleOptionSelected: {
    borderColor: '#14b8a6',
    backgroundColor: '#f0fdfa',
  },
  vehicleOptionText: {
    fontSize: 14,
    color: '#64748b',
  },
  vehicleOptionTextSelected: {
    color: '#14b8a6',
    fontWeight: '600',
  },
  monthList: {
    gap: 8,
    marginBottom: 20,
    maxHeight: 200,
  },
  monthOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  monthOptionSelected: {
    borderColor: '#14b8a6',
    backgroundColor: '#f0fdfa',
  },
  monthOptionText: {
    fontSize: 14,
    color: '#64748b',
  },
  monthOptionTextSelected: {
    color: '#14b8a6',
    fontWeight: '600',
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
  exportButton: {
    backgroundColor: '#14b8a6',
  },
  exportButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
