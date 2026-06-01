import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppMenu from '../src/components/AppMenu';
import { MATERIALS } from '../src/data/materials';
import { useFactoryStore } from '../src/store/useFactoryStore';

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatRuntime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m ${remainingSeconds}s`;
}

export default function StatsScreen() {
  const stats = useFactoryStore((s) => s.stats);
  const nodes = useFactoryStore((s) => s.nodes);
  const edges = useFactoryStore((s) => s.edges);
  const producedTotals = useFactoryStore((s) => s.producedTotals);
  const completedMissionIds = useFactoryStore((s) => s.completedMissionIds);

  const liveNodeCount = Object.keys(nodes).length;
  const liveConnectionCount = Object.keys(edges).length;
  const favoriteMaterial = Object.entries(producedTotals).sort((a, b) => b[1] - a[1])[0];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <AppMenu compact />
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Factory Archive</Text>
          <Text style={styles.title}>Stats</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroNumber}>{formatRuntime(stats.totalRuntimeSeconds)}</Text>
          <Text style={styles.heroLabel}>tracked runtime across plays</Text>
        </View>

        <View style={styles.grid}>
          <StatCard label="Current structures" value={formatNumber(liveNodeCount)} />
          <StatCard label="Current lines" value={formatNumber(liveConnectionCount)} />
          <StatCard label="Structures built" value={formatNumber(stats.totalNodesBuilt)} />
          <StatCard label="Connections made" value={formatNumber(stats.totalConnectionsMade)} />
          <StatCard label="Resource moved" value={formatNumber(stats.totalResourceMoved, 1)} suffix=" units" />
          <StatCard label="Energy generated" value={formatNumber(stats.totalEnergyGenerated, 1)} suffix=" MWs" />
          <StatCard label="Energy consumed" value={formatNumber(stats.totalEnergyConsumed, 1)} suffix=" MWs" />
          <StatCard label="Peak net energy" value={formatNumber(stats.peakNetEnergy, 1)} suffix=" MW" />
          <StatCard label="Missions completed" value={formatNumber(completedMissionIds.length)} />
          <StatCard label="Play sessions" value={formatNumber(stats.playSessions)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Favorite material</Text>
          <Text style={styles.body}>
            {favoriteMaterial
              ? `${MATERIALS[favoriteMaterial[0]]?.name ?? favoriteMaterial[0]} has moved ${formatNumber(favoriteMaterial[1], 1)} units.`
              : 'No materials have moved yet. Build a line and let the station hum.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, suffix = '' }: { label: string; value: string; suffix?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}<Text style={styles.statSuffix}>{suffix}</Text></Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#0D1117', flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomColor: '#1C2733',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerCopy: { flex: 1 },
  kicker: { color: '#7DDCE8', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  content: { gap: 14, padding: 16, paddingBottom: 32 },
  heroCard: {
    alignItems: 'center',
    backgroundColor: '#102331',
    borderColor: '#00BCD4',
    borderRadius: 18,
    borderWidth: 1,
    padding: 22,
  },
  heroNumber: { color: '#FFFFFF', fontSize: 34, fontWeight: '900' },
  heroLabel: { color: '#7DDCE8', fontSize: 13, marginTop: 4, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    backgroundColor: '#101A26',
    borderColor: '#1C3B4C',
    borderRadius: 14,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    padding: 14,
  },
  statValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  statSuffix: { color: '#7DDCE8', fontSize: 12, fontWeight: '700' },
  statLabel: { color: '#C8D4E0', fontSize: 12, marginTop: 6 },
  card: {
    backgroundColor: '#101A26',
    borderColor: '#1C3B4C',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  cardTitle: { color: '#00BCD4', fontSize: 17, fontWeight: '900' },
  body: { color: '#C8D4E0', fontSize: 13, lineHeight: 19, marginTop: 8 },
});
