import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFactoryStore } from '../store/useFactoryStore';
import { useUIStore } from '../store/useUIStore';
import { FactoryEdge, FactoryNode, NodeType, PowerEdge, ResourceEdge } from '../types';
import { MATERIALS } from '../data/materials';
import { MISSIONS, getCurrentMission } from '../data/missions';
import { VOID_TYPES, getVoidTypeForTier } from '../data/progression';

type BuildCategoryId = 'POWER' | 'VOID_HARVESTING' | 'MANUFACTURING' | 'REFINING' | 'TRANSPORTING' | 'COMMUNICATIONS';

type BuildMenuItem =
  | { kind: 'NODE'; nodeType: NodeType }
  | { kind: 'METHOD'; id: string; code: string; name: string; description: string; isUnlocked: boolean };

const BUILD_CATEGORIES: Array<{ id: BuildCategoryId; label: string; description: string; nodeTypes: NodeType[] }> = [
  {
    id: 'POWER',
    label: 'Power',
    description: 'Generators and power connection methods.',
    nodeTypes: ['POWER_GENERATOR'],
  },
  {
    id: 'VOID_HARVESTING',
    label: 'Void Harvesting',
    description: 'Extract raw void materials from the grid.',
    nodeTypes: ['HARVESTER'],
  },
  {
    id: 'MANUFACTURING',
    label: 'Manufacturing',
    description: 'Assemble advanced parts and control systems.',
    nodeTypes: ['ASSEMBLER', 'FEEDBACK_REGULATOR'],
  },
  {
    id: 'REFINING',
    label: 'Refining',
    description: 'Convert raw outputs into processed materials.',
    nodeTypes: ['REFINER'],
  },
  {
    id: 'TRANSPORTING',
    label: 'Transporting',
    description: 'Conveyance endpoints and material routing support.',
    nodeTypes: ['STORAGE', 'SINK'],
  },
  {
    id: 'COMMUNICATIONS',
    label: 'Comms',
    description: 'Relay tier discoveries back to Earth to authorize new void work.',
    nodeTypes: ['RELAY'],
  },
];

const PERF_HISTORY_LIMIT = 18;

type PerfSample = {
  efficiency: number;
  power: number;
  throughput: number;
};

function getNodeCode(type: NodeType): string {
  switch (type) {
    case 'POWER_GENERATOR': return 'PWR';
    case 'HARVESTER': return 'HAR';
    case 'REFINER': return 'REF';
    case 'ASSEMBLER': return 'ASM';
    case 'STORAGE': return 'STO';
    case 'SINK': return 'SNK';
    case 'RELAY': return 'RLY';
    case 'FEEDBACK_REGULATOR': return 'FBK';
    default: return '???';
  }
}


function getNodeDisplayName(type: NodeType): string {
  switch (type) {
    case 'POWER_GENERATOR': return 'Generator';
    case 'HARVESTER': return 'Void Harvester';
    case 'REFINER': return 'Refiner';
    case 'ASSEMBLER': return 'Assembler';
    case 'STORAGE': return 'Storage';
    case 'SINK': return 'Output Sink';
    case 'RELAY': return 'Relay';
    case 'FEEDBACK_REGULATOR': return 'Feedback Regulator';
    default: return type;
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

function isResourceEdge(edge: FactoryEdge): edge is ResourceEdge {
  return edge.connectionType === 'RESOURCE';
}

function isPowerEdge(edge: FactoryEdge): edge is PowerEdge {
  return edge.connectionType === 'POWER';
}

function getNodeThroughput(nodeId: string, edges: FactoryEdge[]): number {
  return edges.reduce((sum, edge) => {
    if (!isResourceEdge(edge) || edge.sourceNodeId !== nodeId) {
      return sum;
    }

    return sum + edge.currentFlowRate;
  }, 0);
}

function getNodePowerMetric(node: FactoryNode, edges: FactoryEdge[]): number {
  if (node.type === 'POWER_GENERATOR') {
    return node.powerOutput;
  }

  return edges.reduce((sum, edge) => {
    if (!isPowerEdge(edge) || edge.targetNodeId !== node.id) {
      return sum;
    }

    return sum + edge.currentTransferRate;
  }, 0);
}

function getPowerLabel(node: FactoryNode): string {
  return node.type === 'POWER_GENERATOR' ? 'Generation' : 'Power Draw';
}

function AnimatedMeter({ value, max, color }: { value: number; max: number; color: string }) {
  const progress = useSharedValue(0);
  const safeMax = Math.max(max, 1);

  useEffect(() => {
    progress.value = withTiming(Math.min(1, Math.max(0, value / safeMax)), { duration: 260 });
  }, [progress, safeMax, value]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.meterTrack}>
      <Animated.View style={[styles.meterFill, { backgroundColor: color }, animatedStyle]} />
    </View>
  );
}

function Sparkline({ samples, color }: { samples: number[]; color: string }) {
  const max = Math.max(...samples, 1);
  return (
    <View style={styles.sparkline}>
      {samples.map((sample, index) => (
        <View
          key={`${index}_${sample.toFixed(2)}`}
          style={[
            styles.sparkBar,
            {
              backgroundColor: color,
              height: `${Math.max(8, (sample / max) * 100)}%`,
              opacity: 0.35 + (index + 1) / samples.length * 0.65,
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function DockLedger() {
  const insets = useSafeAreaInsets();
  const nodes = useFactoryStore((s) => s.nodes);
  const edges = useFactoryStore((s) => s.edges);
  const deleteNode = useFactoryStore((s) => s.deleteNode);
  const producedTotals = useFactoryStore((s) => s.producedTotals);
  const completedMissionIds = useFactoryStore((s) => s.completedMissionIds);
  const getUnlockedNodeTypes = useFactoryStore((s) => s.getUnlockedNodeTypes);
  const placementNodeType = useUIStore((s) => s.placementNodeType);
  const activeTab = useUIStore((s) => s.activeTab);
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const setPlacementNodeType = useUIStore((s) => s.setPlacementNodeType);
  const requestPlacementDrop = useUIStore((s) => s.requestPlacementDrop);
  const setSelectedNodeId = useUIStore((s) => s.setSelectedNodeId);
  const setConnectingFromId = useUIStore((s) => s.setConnectingFromId);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  const nodeList = Object.values(nodes);
  const edgeList = Object.values(edges);
  const selectedNode = selectedNodeId ? nodes[selectedNodeId] : undefined;
  const unlockedNodeTypes = getUnlockedNodeTypes();
  const currentMission = getCurrentMission(completedMissionIds);
  const completedMissions = MISSIONS.filter((mission) => completedMissionIds.includes(mission.id));
  const [activeBuildCategoryId, setActiveBuildCategoryId] = useState<BuildCategoryId>('POWER');
  const activeBuildCategory = BUILD_CATEGORIES.find((category) => category.id === activeBuildCategoryId) ?? BUILD_CATEGORIES[0];
  const buildMenuItems: BuildMenuItem[] = [
    ...activeBuildCategory.nodeTypes.map((nodeType) => ({ kind: 'NODE' as const, nodeType })),
    ...(activeBuildCategory.id === 'POWER'
      ? [{
        kind: 'METHOD' as const,
        id: 'power_line',
        code: 'LINE',
        name: 'Power Line',
        description: 'Draw from a generator to a machine to choose Power.',
        isUnlocked: unlockedNodeTypes.includes('POWER_GENERATOR'),
      }]
      : []),
  ];

  const renderStatusPanel = () => (
    <MachineStatusPanel
      node={selectedNode}
      nodeCount={nodeList.length}
      edges={edgeList}
      onConnect={(nodeId) => setConnectingFromId(nodeId)}
      onDelete={(nodeId) => {
        deleteNode(nodeId);
        setSelectedNodeId(null);
      }}
    />
  );

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
    const tierVoidType = getVoidTypeForTier(currentMission.tier);
    const discoveredVoidType = currentMission.discoversVoidTypeId
      ? VOID_TYPES.find((voidType) => voidType.id === currentMission.discoversVoidTypeId)
      : undefined;
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
          {tierVoidType && (
            <Text style={styles.missionLore}>
              T{currentMission.tier} {tierVoidType.baseType}: {tierVoidType.name} — {tierVoidType.discoverySummary}
            </Text>
          )}
          <Text style={styles.missionLore}>{currentMission.narrativeBeat}</Text>
          {currentMission.relayCommunication && (
            <Text style={styles.missionRelay}>
              Relay to Earth: {currentMission.relayCommunication.durationLabel}
              {discoveredVoidType ? ` to unlock T${discoveredVoidType.tier} ${discoveredVoidType.name}` : ''}
            </Text>
          )}
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
            Build
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
        <View style={styles.buildPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryContent}>
            {BUILD_CATEGORIES.map((category) => {
              const isActive = category.id === activeBuildCategoryId;
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.categoryButton, isActive && styles.categoryButtonActive]}
                  onPress={() => setActiveBuildCategoryId(category.id)}
                >
                  <Text style={[styles.categoryButtonText, isActive && styles.categoryButtonTextActive]}>{category.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.categoryDescription}>{activeBuildCategory.description}</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.paletteScroll} contentContainerStyle={styles.paletteContent}>
            {buildMenuItems.map((item) => {
              if (item.kind === 'METHOD') {
                return (
                  <View
                    key={item.id}
                    style={[styles.paletteButton, !item.isUnlocked && styles.paletteButtonLocked]}
                  >
                    <Text style={[styles.paletteCode, !item.isUnlocked && styles.lockedText]}>{item.code}</Text>
                    <Text style={[styles.paletteName, !item.isUnlocked && styles.lockedText]}>{item.name}</Text>
                    <Text style={styles.paletteHint}>{item.description}</Text>
                    {!item.isUnlocked && <Text style={styles.lockedLabel}>LOCKED</Text>}
                  </View>
                );
              }

              const type = item.nodeType;
              const isSelected = placementNodeType === type;
              const isUnlocked = unlockedNodeTypes.includes(type);
              return (
                <DraggablePaletteNode
                  key={type}
                  type={type}
                  isSelected={isSelected}
                  isUnlocked={isUnlocked}
                  onSelect={setPlacementNodeType}
                  onDrop={requestPlacementDrop}
                />
              );
            })}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setPlacementNodeType(null)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {activeTab === 'LEDGER' && renderStatusPanel()}

      {activeTab === 'MISSIONS' && renderMissionPanel()}
    </View>
  );
}


function DraggablePaletteNode({
  type,
  isSelected,
  isUnlocked,
  onSelect,
  onDrop,
}: {
  type: NodeType;
  isSelected: boolean;
  isUnlocked: boolean;
  onSelect: (type: NodeType | null) => void;
  onDrop: (type: NodeType, absoluteX: number, absoluteY: number) => void;
}) {
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const dragStyle = useAnimatedStyle(() => ({
    opacity: isDragging.value ? 0.85 : 1,
    transform: [
      { translateX: dragX.value },
      { translateY: dragY.value },
      { scale: isDragging.value ? 1.05 : 1 },
    ],
  }));

  const dragGesture = Gesture.Pan()
    .enabled(isUnlocked)
    .onBegin(() => {
      isDragging.value = true;
      runOnJS(onSelect)(type);
    })
    .onUpdate((event) => {
      dragX.value = event.translationX;
      dragY.value = event.translationY;
    })
    .onFinalize((event) => {
      isDragging.value = false;
      dragX.value = withTiming(0, { duration: 120 });
      dragY.value = withTiming(0, { duration: 120 });
      runOnJS(onDrop)(type, event.absoluteX, event.absoluteY);
    });

  return (
    <GestureDetector gesture={dragGesture}>
      <Animated.View
        style={[
          styles.paletteButton,
          isSelected && styles.paletteButtonSelected,
          !isUnlocked && styles.paletteButtonLocked,
          dragStyle,
        ]}
      >
        <TouchableOpacity disabled={!isUnlocked} activeOpacity={0.85} onPress={() => onSelect(type)}>
          <Text style={[styles.paletteCode, !isUnlocked && styles.lockedText]}>{getNodeCode(type)}</Text>
          <Text style={[styles.paletteName, !isUnlocked && styles.lockedText]}>{getNodeDisplayName(type)}</Text>
          <Text style={styles.paletteHint}>Drag onto the play area to place anywhere.</Text>
          {!isUnlocked && <Text style={styles.lockedLabel}>LOCKED</Text>}
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
}

function MachineStatusPanel({
  node,
  nodeCount,
  edges,
  onConnect,
  onDelete,
}: {
  node?: FactoryNode;
  nodeCount: number;
  edges: FactoryEdge[];
  onConnect: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
}) {
  const [history, setHistory] = useState<PerfSample[]>([]);

  const nodeEdges = useMemo(() => {
    if (!node) {
      return [];
    }

    return edges.filter((edge) => edge.sourceNodeId === node.id || edge.targetNodeId === node.id);
  }, [edges, node]);

  const throughput = node ? getNodeThroughput(node.id, edges) : 0;
  const powerMetric = node ? getNodePowerMetric(node, edges) : 0;

  useEffect(() => {
    if (!node) {
      setHistory([]);
      return;
    }

    setHistory((samples) => [
      ...samples.slice(-(PERF_HISTORY_LIMIT - 1)),
      {
        efficiency: Math.round(node.efficiencyRating * 100),
        power: powerMetric,
        throughput,
      },
    ]);
  }, [node?.id, node?.efficiencyRating, powerMetric, throughput]);

  if (!node) {
    return (
      <View style={styles.emptyStatusPanel}>
        <Text style={styles.emptyStatusTitle}>Tap a machine to inspect it</Text>
        <Text style={styles.emptyStatusCopy}>
          The Status tab now follows the selected machine and streams live performance, power, and flow telemetry.
        </Text>
        <Text style={styles.emptyStatusCopy}>Machines placed: {nodeCount}</Text>
      </View>
    );
  }

  const statusColor = getStatusColor(node.operationalStatus);
  const efficiencyPct = Math.round(node.efficiencyRating * 100);
  const powerMax = node.type === 'POWER_GENERATOR'
    ? Math.max(node.powerOutput, 1)
    : Math.max(node.powerRequirement, powerMetric, 1);
  const throughputMax = Math.max(...history.map((sample) => sample.throughput), throughput, 1);
  const powerHistory = history.map((sample) => sample.power);
  const throughputHistory = history.map((sample) => sample.throughput);
  const recipeOutput = node.productionRecipe?.outputs[0];
  const recipeName = recipeOutput ? MATERIALS[recipeOutput.materialId]?.name ?? recipeOutput.materialId : 'No recipe';

  return (
    <ScrollView style={styles.statusScroll} contentContainerStyle={styles.statusContent}>
      <View style={styles.statusHeaderRow}>
        <View style={styles.machineIdentity}>
          <Text style={styles.machineCode}>{getNodeCode(node.type)}</Text>
          <View style={styles.machineTitleBlock}>
            <Text style={styles.machineName} numberOfLines={1}>{node.name}</Text>
            <Text style={styles.machineSubtitle}>{node.type} • X {Math.round(node.x ?? node.gridX * 80 + 8)}, Y {Math.round(node.y ?? node.gridY * 80 + 8)}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{node.operationalStatus}</Text>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <MetricCard label="Efficiency" value={`${efficiencyPct}%`} color={statusColor}>
          <AnimatedMeter value={efficiencyPct} max={100} color={statusColor} />
        </MetricCard>
        <MetricCard label={getPowerLabel(node)} value={`${formatQuantity(powerMetric)} MW`} color="#FFD700">
          <AnimatedMeter value={powerMetric} max={powerMax} color="#FFD700" />
        </MetricCard>
        <MetricCard label="Output Flow" value={`${formatQuantity(throughput)}/s`} color="#4CAF50">
          <AnimatedMeter value={throughput} max={throughputMax} color="#4CAF50" />
        </MetricCard>
      </View>

      <View style={styles.liveGraphCard}>
        <View style={styles.liveGraphHeader}>
          <Text style={styles.sectionLabel}>Live Fluctuations</Text>
          <Text style={styles.liveTag}>REAL-TIME</Text>
        </View>
        <View style={styles.sparkRow}>
          <View style={styles.sparkBlock}>
            <Text style={styles.sparkLabel}>{getPowerLabel(node)}</Text>
            <Sparkline samples={powerHistory.length ? powerHistory : [0]} color="#FFD700" />
          </View>
          <View style={styles.sparkBlock}>
            <Text style={styles.sparkLabel}>Throughput</Text>
            <Sparkline samples={throughputHistory.length ? throughputHistory : [0]} color="#4CAF50" />
          </View>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Recipe</Text>
        <Text style={styles.detailValue}>{recipeName}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Power Capacity</Text>
        <Text style={styles.detailValue}>
          {node.type === 'POWER_GENERATOR' ? `${node.powerOutput} MW generated` : `${node.powerRequirement} MW required`}
        </Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Connections</Text>
        <Text style={styles.detailValue}>{nodeEdges.length}</Text>
      </View>

      <View style={styles.boosterSlot}>
        <View>
          <Text style={styles.boosterTitle}>Booster Slot</Text>
          <Text style={styles.boosterCopy}>Empty socket reserved for future booster modules.</Text>
        </View>
        <View style={styles.boosterSocket}>
          <Text style={styles.boosterPlus}>＋</Text>
        </View>
      </View>

      <View style={styles.statusActions}>
        <TouchableOpacity style={styles.connectButtonLarge} onPress={() => onConnect(node.id)}>
          <Text style={styles.connectButtonText}>Connect Tap Mode</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButtonLarge} onPress={() => onDelete(node.id)}>
          <Text style={styles.deleteButtonTextLarge}>Delete</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function MetricCard({
  label,
  value,
  color,
  children,
}: {
  label: string;
  value: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.metricCard, { borderColor: `${color}66` }]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      {children}
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
  buildPanel: {
    flex: 1,
  },
  categoryScroll: {
    maxHeight: 36,
  },
  categoryContent: {
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  categoryButton: {
    borderColor: '#334155',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  categoryButtonActive: {
    backgroundColor: '#1C2733',
    borderColor: '#00BCD4',
  },
  categoryButtonText: {
    color: '#8B9DC3',
    fontSize: 11,
    fontWeight: '700',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  categoryDescription: {
    color: '#8B9DC3',
    fontSize: 10,
    paddingHorizontal: 14,
    paddingVertical: 2,
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
  paletteHint: {
    color: '#8B9DC3',
    fontSize: 9,
    marginTop: 3,
    maxWidth: 120,
    textAlign: 'center',
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
  statusScroll: {
    flex: 1,
  },
  statusContent: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 14,
    gap: 8,
  },
  emptyStatusPanel: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyStatusTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyStatusCopy: {
    color: '#8B9DC3',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    textAlign: 'center',
  },
  statusHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  machineIdentity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 9,
  },
  machineCode: {
    backgroundColor: '#0D1117',
    borderColor: '#00BCD4',
    borderRadius: 8,
    borderWidth: 1,
    color: '#00BCD4',
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  machineTitleBlock: {
    flex: 1,
  },
  machineName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  machineSubtitle: {
    color: '#607D8B',
    fontSize: 10,
    marginTop: 1,
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
  metricGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    backgroundColor: '#0D1117',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    padding: 8,
  },
  metricLabel: {
    color: '#607D8B',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 3,
  },
  meterTrack: {
    backgroundColor: '#1C2733',
    borderRadius: 999,
    height: 5,
    marginTop: 7,
    overflow: 'hidden',
  },
  meterFill: {
    borderRadius: 999,
    height: 5,
  },
  liveGraphCard: {
    backgroundColor: '#0D1117',
    borderColor: '#1C2733',
    borderRadius: 10,
    borderWidth: 1,
    padding: 9,
  },
  liveGraphHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  liveTag: {
    color: '#00BCD4',
    fontSize: 9,
    fontWeight: '800',
  },
  sparkRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sparkBlock: {
    flex: 1,
  },
  sparkLabel: {
    color: '#8B9DC3',
    fontSize: 10,
    marginBottom: 4,
  },
  sparkline: {
    alignItems: 'flex-end',
    backgroundColor: '#080B10',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 2,
    height: 42,
    overflow: 'hidden',
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  sparkBar: {
    borderRadius: 999,
    flex: 1,
    minHeight: 3,
  },
  detailRow: {
    alignItems: 'center',
    borderBottomColor: '#1C2733',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  detailLabel: {
    color: '#607D8B',
    fontSize: 11,
    fontWeight: '700',
  },
  detailValue: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 11,
    marginLeft: 10,
    textAlign: 'right',
  },
  boosterSlot: {
    alignItems: 'center',
    backgroundColor: '#0D1117',
    borderColor: '#334155',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
  },
  boosterTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  boosterCopy: {
    color: '#8B9DC3',
    fontSize: 10,
    marginTop: 2,
  },
  boosterSocket: {
    alignItems: 'center',
    borderColor: '#00BCD4',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  boosterPlus: {
    color: '#00BCD4',
    fontSize: 22,
    lineHeight: 24,
  },
  statusActions: {
    flexDirection: 'row',
    gap: 8,
  },
  connectButtonLarge: {
    alignItems: 'center',
    borderColor: '#00BCD4',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 7,
  },
  deleteButtonLarge: {
    alignItems: 'center',
    borderColor: '#F44336',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 7,
  },
  connectButtonText: {
    color: '#00BCD4',
    fontSize: 10,
    fontWeight: '700',
  },
  deleteButtonTextLarge: {
    color: '#F44336',
    fontSize: 10,
    fontWeight: '700',
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
  missionLore: {
    color: '#90A4AE',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 7,
  },
  missionRelay: {
    color: '#80DEEA',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: 7,
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
