import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CheckCircle, Clock, MapPin } from 'lucide-react-native';
import {
  getAllTrips,
  updateTripClassification,
} from '../../src/services/tripService';
import { Trip } from '../../src/types';

type FilterType = 'all' | 'unclassified' | 'business';

interface TripSection {
  title: string;
  data: Trip[];
}

export default function ReviewScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [classifyingId, setClassifyingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (mounted) {
        await loadTrips();
      }
    }

    init();

    const interval = setInterval(() => {
      if (mounted) {
        loadTrips();
      }
    }, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  async function loadTrips() {
    try {
      setLoading(true);
      const data = await getAllTrips();
      setTrips(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load trips');
    } finally {
      setLoading(false);
    }
  }

  async function handleClassify(
    trip: Trip,
    classification: 'business' | 'personal' | 'commute' | 'other'
  ) {
    try {
      setClassifyingId(trip.id);
      await updateTripClassification(trip.id, classification);
      await loadTrips();
    } catch (error) {
      Alert.alert('Error', 'Failed to update classification');
    } finally {
      setClassifyingId(null);
    }
  }

  function getFilteredTrips(): Trip[] {
    switch (filter) {
      case 'unclassified':
        return trips.filter((t) => t.classification === 'unclassified');
      case 'business':
        return trips.filter((t) => t.classification === 'business');
      default:
        return trips;
    }
  }

  function groupTripsByDate(trips: Trip[]): TripSection[] {
    const sections: { [key: string]: Trip[] } = {};
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000).toDateString();

    trips.forEach((trip) => {
      const tripDate = new Date(trip.start_time);
      const dateString = tripDate.toDateString();

      let sectionTitle: string;
      if (dateString === today) {
        sectionTitle = 'Today';
      } else if (dateString === yesterday) {
        sectionTitle = 'Yesterday';
      } else {
        sectionTitle = tripDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });
      }

      if (!sections[sectionTitle]) {
        sections[sectionTitle] = [];
      }
      sections[sectionTitle].push(trip);
    });

    return Object.keys(sections).map((title) => ({
      title,
      data: sections[title],
    }));
  }

  function getClassificationColor(classification: string): string {
    switch (classification) {
      case 'business':
        return '#10b981';
      case 'personal':
        return '#8b5cf6';
      case 'commute':
        return '#3b82f6';
      case 'other':
        return '#64748b';
      default:
        return '#f59e0b';
    }
  }

  function formatDuration(start: string, end?: string): string {
    if (!end) return 'In progress';

    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const durationMs = endTime - startTime;

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  function renderTrip({ item }: { item: Trip }) {
    const isClassifying = classifyingId === item.id;
    const isUnclassified = item.classification === 'unclassified';

    return (
      <View style={styles.tripCard}>
        <View style={styles.tripHeader}>
          <View style={styles.timeContainer}>
            <Clock size={16} color="#64748b" />
            <Text style={styles.timeText}>
              {new Date(item.start_time).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              →{' '}
              {item.end_time
                ? new Date(item.end_time).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Now'}
            </Text>
          </View>

          <View style={styles.statsContainer}>
            <Text style={styles.distanceText}>{item.distance_miles.toFixed(1)} mi</Text>
            <Text style={styles.durationText}>
              {formatDuration(item.start_time, item.end_time)}
            </Text>
          </View>
        </View>

        <View style={styles.addressContainer}>
          <View style={styles.addressRow}>
            <MapPin size={14} color="#10b981" fill="#10b981" />
            <Text style={styles.addressText} numberOfLines={1}>
              {item.start_address || 'Unknown location'}
            </Text>
          </View>

          {item.end_address && (
            <View style={styles.addressRow}>
              <MapPin size={14} color="#ef4444" fill="#ef4444" />
              <Text style={styles.addressText} numberOfLines={1}>
                {item.end_address}
              </Text>
            </View>
          )}
        </View>

        {item.map_image_uri && (
          <Image source={{ uri: item.map_image_uri }} style={styles.mapThumbnail} />
        )}

        <View style={styles.classificationContainer}>
          {isClassifying ? (
            <ActivityIndicator size="small" color="#14b8a6" />
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.classButton,
                  {
                    backgroundColor:
                      item.classification === 'business' ? '#d1fae5' : '#f0fdf4',
                    borderColor: '#10b981',
                  },
                ]}
                onPress={() => handleClassify(item, 'business')}>
                {item.classification === 'business' && (
                  <CheckCircle size={16} color="#10b981" fill="#10b981" />
                )}
                <Text
                  style={[
                    styles.classButtonText,
                    { color: '#10b981' },
                    item.classification === 'business' && styles.classButtonTextActive,
                  ]}>
                  Business
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.classButton,
                  {
                    backgroundColor:
                      item.classification === 'personal' ? '#ede9fe' : '#faf5ff',
                    borderColor: '#8b5cf6',
                  },
                ]}
                onPress={() => handleClassify(item, 'personal')}>
                {item.classification === 'personal' && (
                  <CheckCircle size={16} color="#8b5cf6" fill="#8b5cf6" />
                )}
                <Text
                  style={[
                    styles.classButtonText,
                    { color: '#8b5cf6' },
                    item.classification === 'personal' && styles.classButtonTextActive,
                  ]}>
                  Personal
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.classButton,
                  {
                    backgroundColor:
                      item.classification === 'commute' ? '#dbeafe' : '#eff6ff',
                    borderColor: '#3b82f6',
                  },
                ]}
                onPress={() => handleClassify(item, 'commute')}>
                {item.classification === 'commute' && (
                  <CheckCircle size={16} color="#3b82f6" fill="#3b82f6" />
                )}
                <Text
                  style={[
                    styles.classButtonText,
                    { color: '#3b82f6' },
                    item.classification === 'commute' && styles.classButtonTextActive,
                  ]}>
                  Commute
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.classButton,
                  {
                    backgroundColor: item.classification === 'other' ? '#e2e8f0' : '#f8fafc',
                    borderColor: '#64748b',
                  },
                ]}
                onPress={() => handleClassify(item, 'other')}>
                {item.classification === 'other' && (
                  <CheckCircle size={16} color="#64748b" fill="#64748b" />
                )}
                <Text
                  style={[
                    styles.classButtonText,
                    { color: '#64748b' },
                    item.classification === 'other' && styles.classButtonTextActive,
                  ]}>
                  Other
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {item.classification === 'business' && (
          <View style={styles.valueContainer}>
            <Text style={styles.valueLabel}>Deduction Value:</Text>
            <Text style={styles.valueAmount}>
              ${(item.distance_miles * 0.67).toFixed(2)}
            </Text>
          </View>
        )}
      </View>
    );
  }

  function renderSectionHeader({ section }: { section: TripSection }) {
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionCount}>{section.data.length} trips</Text>
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

  const filteredTrips = getFilteredTrips();
  const sections = groupTripsByDate(filteredTrips);
  const unclassifiedCount = trips.filter((t) => t.classification === 'unclassified').length;

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}>
          <Text
            style={[
              styles.filterButtonText,
              filter === 'all' && styles.filterButtonTextActive,
            ]}>
            All ({trips.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'unclassified' && styles.filterButtonActive,
          ]}
          onPress={() => setFilter('unclassified')}>
          <Text
            style={[
              styles.filterButtonText,
              filter === 'unclassified' && styles.filterButtonTextActive,
            ]}>
            Unclassified ({unclassifiedCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, filter === 'business' && styles.filterButtonActive]}
          onPress={() => setFilter('business')}>
          <Text
            style={[
              styles.filterButtonText,
              filter === 'business' && styles.filterButtonTextActive,
            ]}>
            Business ({trips.filter((t) => t.classification === 'business').length})
          </Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        renderItem={renderTrip}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No trips to review</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'unclassified'
                ? 'All trips are classified'
                : 'Start tracking trips to see them here'}
            </Text>
          </View>
        }
      />
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
  filterBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterButtonActive: {
    backgroundColor: '#14b8a6',
    borderColor: '#14b8a6',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  listContent: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  sectionCount: {
    fontSize: 14,
    color: '#64748b',
  },
  tripCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  distanceText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#14b8a6',
  },
  durationText: {
    fontSize: 14,
    color: '#64748b',
  },
  addressContainer: {
    gap: 6,
    marginBottom: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: '#64748b',
  },
  mapThumbnail: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    marginBottom: 12,
  },
  classificationContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  classButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  classButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  classButtonTextActive: {
    fontWeight: '700',
  },
  valueContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  valueLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  valueAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
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
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
