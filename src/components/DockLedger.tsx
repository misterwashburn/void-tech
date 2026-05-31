import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFactoryStore } from '../store/useFactoryStore';
import { useUIStore } from '../store/useUIStore';
import { FactoryNode, NodeType } from '../types';
import { MATERIALS } from '../data/materials';
import { MISSIONS, getCurrentMission } from '../data/missions';

const NODE_TYPES: NodeType[] = [
  'HARVESTER',
  'REFINER',
  'ASSEMBLER',
  'STORAGE',
  'SINK',
  'FEEDBACK_REGULATOR',
];

function getNodeCode(type: NodeType): string {
  switch (type) {
    case 'HARVESTER': return 'HAR';
    case 'REFINER': return 'REF';
    case 'ASSEMBLER': return 'ASM';
    case 'STORAGE': return 'STO';
    case 'SINK': return 'SNK';
    case 'FEEDBACK_REGULATOR': return 'FBK';
    default: return '???';
  }
}

function getStatusColor(status: FactoryNode['operationalStatus']): string {
  switch (status) {
    case 'OPERATIONAL': return '#00BCD4';
    case 'STARVED': return '#FF9800';
    case 'WARNING': return '#FF5722';
    case 'STALLED': return '#F44336';
    default: return '#607D8B';
  }
}

function formatQuantity(quantity: number): string {
  if (quantity >= 100) {
    return Math.floor(quantity).toString();
  }

  return quantity.toFixed(1);
}

export default function DockLedger() {
  const insets = useSafeAreaInsets();
  const nodes = useFactoryStore((s) => s.nodes);
  const deleteNode = useFactoryStore((s) => s.deleteNode);
  const producedTotals = useFactoryStore((s) => s.producedTotals);
  const completedMissionIds = useFactoryStore((s) => s.completedMissionIds);
  const getUnlockedNodeTypes = useFactoryStore((s) => s.getUnlockedNodeTypes);
  const placementNodeType = useUIStore((s) => s.placementNodeType);
  const activeTab = useUIStore((s) => s.activeTab);
  const setPlacementNodeType = useUIStore((s) => s.setPlacementNodeType);
  const setConnectingFromId = useUIStore((s) => s.setConnectingFromId);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  const nodeList = Object.values(nodes);
  const unlockedNodeTypes = getUnlockedNodeTypes();
  const currentMission = getCurrentMission(completedMissionIds);
  const completedMissions = MISSIONS.filter((mission) => completedMissionIds.includes(mission.id));

  const renderNode = ({ item }: { item: FactoryNode }) => {
    const code = getNodeCode(item.type);
    const statusColor = getStatusColor(item.operationalStatus);
    const efficiencyPct = Math.round(item.efficiencyRating * 100);

    return (
      <View style={styles.ledgerRow}>
        <Text style={styles.ledgerCode}>{code}</Text>
        <Text style={styles.ledgerName} numberOfLines={1}>{item.name}</Text>
        <View style={[styles.statusBadge, { borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{item.operationalStatus}</Text>
        </View>
        <Text style={styles.efficiencyText}>{efficiencyPct}%</Text>
        <TouchableOpacity
          style={styles.connectButton}
          onPress={() => setConnectingFromId(item.id)}
        >
          <Text style={styles.connectButtonText}>Connect</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteNode(item.id)}
        >
          <Text style={styles.deleteButtonText}>🗑</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMissionPanel = () => {
    if (!currentMission) {
      return (
        <ScrollView style={styles.missionsScroll} contentContainerStyle={styles.missionsContent}>
          <Text style={styles.missionTitle}>All missions complete</Text>
          <Text style={styles.missionObjective}>The current progression arc has been cleared.</Text>
          <CompletedMissionList completedMissions={completedMissions} />
        </ScrollView>
      );
    }

    const materialName = MATERIALS[currentMission.requirement.materialId]?.name ?? currentMission.requirement.materialId;
    const currentAmount = producedTotals[currentMission.requirement.materialId] ?? 0;
    const targetAmount = currentMission.requirement.quantity;
    const progressPct = Math.min(100, Math.round((currentAmount / targetAmount) * 100));

    return (
      <ScrollView style={styles.missionsScroll} contentContainerStyle={styles.missionsContent}>
        <Text style={styles.sectionLabel}>Current Mission</Text>
        <View style={styles.missionCard}>
          <View style={styles.missionHeaderRow}>
            <Text style={styles.missionTitle}>{currentMission.title}</Text>
            <Text style={styles.missionPercent}>{progressPct}%</Text>
          </View>
          <Text style={styles.missionObjective}>{currentMission.objective}</Text>
          <Text style={styles.missionRequirement}>
            Produce {formatQuantity(currentAmount)} / {formatQuantity(targetAmount)} {materialName}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
        </View>
        <CompletedMissionList completedMissions={completedMissions} />
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'PALETTE' && styles.tabButtonActive]}
          onPress={() => setActiveTab('PALETTE')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'PALETTE' && styles.tabButtonTextActive]}>
            Place
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'LEDGER' && styles.tabButtonActive]}
          onPress={() => setActiveTab('LEDGER')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'LEDGER' && styles.tabButtonTextActive]}>
            Status
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'MISSIONS' && styles.tabButtonActive]}
          onPress={() => setActiveTab('MISSIONS')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'MISSIONS' && styles.tabButtonTextActive]}>
            Missions
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'PALETTE' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.paletteScroll} contentContainerStyle={styles.paletteContent}>
          {NODE_TYPES.map((type) => {
            const isSelected = placementNodeType === type;
            const isUnlocked = unlockedNodeTypes.includes(type);
            return (
              <TouchableOpacity
                key={type}
                disabled={!isUnlocked}
                style={[
                  styles.paletteButton,
                  isSelected && styles.paletteButtonSelected,
                  !isUnlocked && styles.paletteButtonLocked,
                ]}
                onPress={() => setPlacementNodeType(type)}
              >
                <Text style={[styles.paletteCode, !isUnlocked && styles.lockedText]}>{getNodeCode(type)}</Text>
                <Text style={[styles.paletteName, !isUnlocked && styles.lockedText]}>{type}</Text>
                {!isUnlocked && <Text style={styles.lockedLabel}>LOCKED</Text>}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setPlacementNodeType(null)}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {activeTab === 'LEDGER' && (
        <FlatList
          data={nodeList}
          keyExtractor={(item) => item.id}
          renderItem={renderNode}
          style={styles.ledgerList}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No nodes placed yet.</Text>
          }
        />
      )}

      {activeTab === 'MISSIONS' && renderMissionPanel()}
    </View>
  );
}

function CompletedMissionList({ completedMissions }: { completedMissions: typeof MISSIONS }) {
  return (
    <View style={styles.completedSection}>
      <Text style={styles.sectionLabel}>Completed</Text>
      {completedMissions.length === 0 ? (
        <Text style={styles.emptyText}>No missions completed yet.</Text>
      ) : (
        completedMissions.map((mission) => (
          <View key={mission.id} style={styles.completedRow}>
            <Text style={styles.completedCheck}>✓</Text>
            <Text style={styles.completedTitle}>{mission.title}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0A0E14',
    borderTopWidth: 1,
    borderTopColor: '#1C2733',
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00BCD4',
  },
  tabButtonActive: {
    backgroundColor: '#00BCD4',
  },
  tabButtonText: {
    color: '#00BCD4',
    fontSize: 12,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#0A0E14',
  },
  paletteScroll: {
    flex: 1,
  },
  paletteContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  paletteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1C2733',
    backgroundColor: '#0D1117',
    minWidth: 70,
  },
  paletteButtonSelected: {
    borderColor: '#00BCD4',
    borderWidth: 2,
  },
  paletteButtonLocked: {
    opacity: 0.45,
  },
  paletteCode: {
    color: '#00BCD4',
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: 'bold',
  },
  paletteName: {
    color: '#8B9DC3',
    fontSize: 9,
    marginTop: 2,
  },
  lockedText: {
    color: '#607D8B',
  },
  lockedLabel: {
    color: '#607D8B',
    fontSize: 8,
    marginTop: 2,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F44336',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  cancelButtonText: {
    color: '#F44336',
    fontSize: 12,
  },
  ledgerList: {
    flex: 1,
    paddingHorizontal: 12,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1C2733',
    gap: 6,
  },
  ledgerCode: {
    color: '#00BCD4',
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 'bold',
    width: 32,
  },
  ledgerName: {
    color: '#FFFFFF',
    fontSize: 12,
    flex: 1,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '600',
  },
  efficiencyText: {
    color: '#8B9DC3',
    fontSize: 11,
    width: 34,
    textAlign: 'right',
  },
  connectButton: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#00BCD4',
  },
  connectButtonText: {
    color: '#00BCD4',
    fontSize: 10,
  },
  deleteButton: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  deleteButtonText: {
    fontSize: 14,
  },
  emptyText: {
    color: '#607D8B',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 13,
  },
  missionsScroll: {
    flex: 1,
  },
  missionsContent: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 14,
  },
  sectionLabel: {
    color: '#607D8B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  missionCard: {
    backgroundColor: '#0D1117',
    borderColor: '#1C2733',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  missionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  missionTitle: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  missionPercent: {
    color: '#00BCD4',
    fontSize: 12,
    fontWeight: '700',
  },
  missionObjective: {
    color: '#8B9DC3',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 5,
  },
  missionRequirement: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  progressTrack: {
    backgroundColor: '#1C2733',
    borderRadius: 999,
    height: 6,
    marginTop: 7,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#00BCD4',
    borderRadius: 999,
    height: 6,
  },
  completedSection: {
    marginTop: 10,
  },
  completedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 3,
  },
  completedCheck: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '700',
  },
  completedTitle: {
    color: '#8B9DC3',
    fontSize: 11,
  },
});
