import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { BarChart3, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getAllVehiclesStatistics,
  getOverallStatistics,
  VehicleStats,
  OverallStats,
} from '../../src/services/statisticsService';

export default function StatsScreen() {
  const [vehicleStats, setVehicleStats] = useState<VehicleStats[]>([]);
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedVehicles, setExpandedVehicles] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [])
  );

  async function loadStats() {
    try {
      setLoading(true);
      const [vehicles, overall] = await Promise.all([
        getAllVehiclesStatistics(),
        getOverallStatistics(),
      ]);
      setVehicleStats(vehicles);
      setOverallStats(overall);
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleExpanded(vehicleId: string) {
    const newExpanded = new Set(expandedVehicles);
    if (newExpanded.has(vehicleId)) {
      newExpanded.delete(vehicleId);
    } else {
      newExpanded.add(vehicleId);
    }
    setExpandedVehicles(newExpanded);
  }

  function formatDistance(distance: number): string {
    return distance.toFixed(1);
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading statistics...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <BarChart3 size={32} color="#3b82f6" />
        <Text style={styles.headerTitle}>Statistics</Text>
      </View>

      {overallStats && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overall Summary</Text>

          <View style={styles.overallCard}>
            <View style={styles.overallRow}>
              <Text style={styles.overallLabel}>Total Vehicles</Text>
              <Text style={styles.overallValue}>{overallStats.vehicleCount}</Text>
            </View>
            <View style={styles.overallRow}>
              <Text style={styles.overallLabel}>Total Trips</Text>
              <Text style={styles.overallValue}>{overallStats.totalTrips}</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statPeriod}>This Month</Text>
              <Text style={styles.statValue}>{formatDistance(overallStats.monthly.total)} mi</Text>
              <View style={styles.statBreakdown}>
                <Text style={styles.statBreakdownItem}>Business: {formatDistance(overallStats.monthly.business)}</Text>
                <Text style={styles.statBreakdownItem}>Commute: {formatDistance(overallStats.monthly.commute)}</Text>
                <Text style={styles.statBreakdownItem}>Personal: {formatDistance(overallStats.monthly.personal)}</Text>
              </View>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statPeriod}>Year-to-Date</Text>
              <Text style={styles.statValue}>{formatDistance(overallStats.ytd.total)} mi</Text>
              <View style={styles.statBreakdown}>
                <Text style={styles.statBreakdownItem}>Business: {formatDistance(overallStats.ytd.business)}</Text>
                <Text style={styles.statBreakdownItem}>Commute: {formatDistance(overallStats.ytd.commute)}</Text>
                <Text style={styles.statBreakdownItem}>Personal: {formatDistance(overallStats.ytd.personal)}</Text>
              </View>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statPeriod}>All Time</Text>
              <Text style={styles.statValue}>{formatDistance(overallStats.allTime.total)} mi</Text>
              <View style={styles.statBreakdown}>
                <Text style={styles.statBreakdownItem}>Business: {formatDistance(overallStats.allTime.business)}</Text>
                <Text style={styles.statBreakdownItem}>Commute: {formatDistance(overallStats.allTime.commute)}</Text>
                <Text style={styles.statBreakdownItem}>Personal: {formatDistance(overallStats.allTime.personal)}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>By Vehicle</Text>
        {vehicleStats.length === 0 ? (
          <Text style={styles.emptyText}>No vehicles found. Add a vehicle to see statistics.</Text>
        ) : (
          vehicleStats.map((vehicle) => {
            const isExpanded = expandedVehicles.has(vehicle.vehicleId);
            return (
              <View key={vehicle.vehicleId} style={styles.vehicleCard}>
                <TouchableOpacity
                  onPress={() => toggleExpanded(vehicle.vehicleId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.vehicleHeader}>
                    <Text style={styles.vehicleName}>{vehicle.vehicleName}</Text>
                    <View style={styles.auditBadge}>
                      {vehicle.auditCompleteness.completenessPercentage === 100 ? (
                        <CheckCircle2 size={20} color="#10b981" />
                      ) : (
                        <AlertCircle size={20} color="#f59e0b" />
                      )}
                      <Text
                        style={[
                          styles.auditText,
                          vehicle.auditCompleteness.completenessPercentage === 100
                            ? styles.auditTextComplete
                            : styles.auditTextIncomplete,
                        ]}
                      >
                        {vehicle.auditCompleteness.completenessPercentage}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.vehicleSummary}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Monthly</Text>
                      <Text style={styles.summaryValue}>{formatDistance(vehicle.monthly.total)} mi</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>YTD</Text>
                      <Text style={styles.summaryValue}>{formatDistance(vehicle.ytd.total)} mi</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>All Time</Text>
                      <Text style={styles.summaryValue}>{formatDistance(vehicle.allTime.total)} mi</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.vehicleDetails}>
                    <Text style={styles.detailsTitle}>Detailed Breakdown</Text>

                    <View style={styles.detailSection}>
                      <Text style={styles.detailPeriod}>This Month</Text>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Business:</Text>
                        <Text style={styles.detailValue}>{formatDistance(vehicle.monthly.business)} mi</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Commute:</Text>
                        <Text style={styles.detailValue}>{formatDistance(vehicle.monthly.commute)} mi</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Personal:</Text>
                        <Text style={styles.detailValue}>{formatDistance(vehicle.monthly.personal)} mi</Text>
                      </View>
                    </View>

                    <View style={styles.detailSection}>
                      <Text style={styles.detailPeriod}>Year-to-Date</Text>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Business:</Text>
                        <Text style={styles.detailValue}>{formatDistance(vehicle.ytd.business)} mi</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Commute:</Text>
                        <Text style={styles.detailValue}>{formatDistance(vehicle.ytd.commute)} mi</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Personal:</Text>
                        <Text style={styles.detailValue}>{formatDistance(vehicle.ytd.personal)} mi</Text>
                      </View>
                    </View>

                    <View style={styles.detailSection}>
                      <Text style={styles.detailPeriod}>All Time</Text>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Business:</Text>
                        <Text style={styles.detailValue}>{formatDistance(vehicle.allTime.business)} mi</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Commute:</Text>
                        <Text style={styles.detailValue}>{formatDistance(vehicle.allTime.commute)} mi</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Personal:</Text>
                        <Text style={styles.detailValue}>{formatDistance(vehicle.allTime.personal)} mi</Text>
                      </View>
                    </View>

                    <View style={styles.auditSection}>
                      <Text style={styles.detailsTitle}>Audit Completeness</Text>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Total Months:</Text>
                        <Text style={styles.detailValue}>{vehicle.auditCompleteness.totalMonths}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Complete Months:</Text>
                        <Text style={styles.detailValue}>{vehicle.auditCompleteness.completeMonths}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Missing Start Photos:</Text>
                        <Text style={[styles.detailValue, styles.warningValue]}>
                          {vehicle.auditCompleteness.missingStartPhotos}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Missing End Photos:</Text>
                        <Text style={[styles.detailValue, styles.warningValue]}>
                          {vehicle.auditCompleteness.missingEndPhotos}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  overallCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  overallRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  overallLabel: {
    fontSize: 16,
    color: '#64748b',
  },
  overallValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  statsGrid: {
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  statPeriod: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#3b82f6',
    marginBottom: 12,
  },
  statBreakdown: {
    gap: 4,
  },
  statBreakdownItem: {
    fontSize: 14,
    color: '#475569',
  },
  vehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  vehicleName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  auditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  auditText: {
    fontSize: 14,
    fontWeight: '600',
  },
  auditTextComplete: {
    color: '#10b981',
  },
  auditTextIncomplete: {
    color: '#f59e0b',
  },
  vehicleSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  vehicleDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailPeriod: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  warningValue: {
    color: '#f59e0b',
  },
  auditSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 32,
  },
});
