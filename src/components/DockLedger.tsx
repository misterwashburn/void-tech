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
import { placementDragShared } from '../store/placementDragShared';
import { FactoryEdge, FactoryNode, NodeType, PowerEdge, Recipe, ResourceEdge } from '../types';
import { MATERIALS } from '../data/materials';
import { MISSIONS, getCurrentMission, getMissionStepStatuses } from '../data/missions';
import { VOID_TYPES, getVoidTypeForTier } from '../data/progression';
import { getNodeCode, getNodeDisplayName, getNodeFootprintSize } from '../data/nodes';
import { EXTRACTABLE_MATERIAL_IDS, RECIPES, RECIPE_IDS_BY_NODE_TYPE, createExtractionRecipe } from '../data/recipes';
import { getHarvesterOutputRate, getHarvesterTierDefinition } from '../data/harvesters';
import {
  getStorageItemCount,
  getStorageUsedStackCount,
  STORAGE_ITEM_CAPACITY,
  STORAGE_STACK_CAPACITY,
  STORAGE_STACK_SIZE,
} from '../data/storage';

type BuildCategoryId = 'POWER' | 'EXTRACTION' | 'MANUFACTURING' | 'RESOLVING' | 'TRANSPORTING' | 'STORAGE' | 'COMMUNICATIONS' | 'OTHER';

type BuildMenuItem =
  | { kind: 'NODE'; nodeType: NodeType }
  | { kind: 'METHOD'; id: string; code: string; name: string; isUnlocked: boolean };

const BUILD_CATEGORIES: Array<{ id: BuildCategoryId; label: string; description: string; nodeTypes: NodeType[] }> = [
  {
    id: 'POWER',
    label: 'Power',
    description: 'Generators and power connection methods.',
    nodeTypes: ['POWER_GENERATOR'],
  },
  {
    id: 'EXTRACTION',
    label: 'Extraction',
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
    id: 'RESOLVING',
    label: 'Resolving',
    description: 'Convert raw outputs into processed materials.',
    nodeTypes: ['REFINER'],
  },
  {
    id: 'TRANSPORTING',
    label: 'Transporting',
    description: 'Route, merge, and split moving material lines.',
    nodeTypes: ['MERGE_UNIT', 'SPLIT_UNIT'],
  },
  {
    id: 'STORAGE',
    label: 'Storage',
    description: 'Hold material buffers for later routing.',
    nodeTypes: ['STORAGE'],
  },
  {
    id: 'COMMUNICATIONS',
    label: 'Comms',
    description: 'Relay tier discoveries back to Earth to authorize new void work.',
    nodeTypes: ['RELAY'],
  },
  {
    id: 'OTHER',
    label: 'Other',
    description: 'Utility endpoints and support structures.',
    nodeTypes: ['SINK'],
  },
];

const PERF_HISTORY_LIMIT = 18;

type PerfSample = {
  efficiency: number;
  power: number;
  throughput: number;
};

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
  const setNodeRecipe = useFactoryStore((s) => s.setNodeRecipe);
  const producedTotals = useFactoryStore((s) => s.producedTotals);
  const completedMissionIds = useFactoryStore((s) => s.completedMissionIds);
  const getUnlockedNodeTypes = useFactoryStore((s) => s.getUnlockedNodeTypes);
  const getUnlockedMaterialIds = useFactoryStore((s) => s.getUnlockedMaterialIds);
  const getUnlockedRecipeIds = useFactoryStore((s) => s.getUnlockedRecipeIds);
  const placementNodeType = useUIStore((s) => s.placementNodeType);
  const activeTab = useUIStore((s) => s.activeTab);
  const isDockRaised = useUIStore((s) => s.isDockRaised);
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const setPlacementNodeType = useUIStore((s) => s.setPlacementNodeType);
  const requestPlacementDrop = useUIStore((s) => s.requestPlacementDrop);
  const setSelectedNodeId = useUIStore((s) => s.setSelectedNodeId);
  const setConnectingFromId = useUIStore((s) => s.setConnectingFromId);
  const toggleActiveTab = useUIStore((s) => s.toggleActiveTab);

  const nodeList = Object.values(nodes);
  const edgeList = Object.values(edges);
  const selectedNode = selectedNodeId ? nodes[selectedNodeId] : undefined;
  const unlockedNodeTypes = getUnlockedNodeTypes();
  const unlockedMaterialIds = getUnlockedMaterialIds();
  const unlockedRecipeIds = getUnlockedRecipeIds();
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
        isUnlocked: unlockedNodeTypes.includes('POWER_GENERATOR'),
      }]
      : []),
  ];
  const dockBottomPadding = Math.max(insets.bottom, isDockRaised ? 8 : 10);
  const dockSidePadding = Math.max(insets.left, insets.right, 4);

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
      onSelectRecipe={setNodeRecipe}
      unlockedMaterialIds={unlockedMaterialIds}
      unlockedRecipeIds={unlockedRecipeIds}
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

    if (currentMission.id === 'mission_into_the_void') {
      return (
        <View style={styles.emptyStatusPanel}>
          <Text style={styles.emptyStatusTitle}>Onboarding active</Text>
          <Text style={styles.emptyStatusCopy}>
            Complete Into the Void in the onboarding overlay. Standard missions begin after the station recovers its first Void Ore.
          </Text>
        </View>
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
    const stepStatuses = getMissionStepStatuses(currentMission, { nodes, edges, producedTotals });
    const activeStepStatus = stepStatuses.find((status) => !status.isComplete);

    return (
      <ScrollView style={styles.missionsScroll} contentContainerStyle={styles.missionsContent}>
        <Text style={styles.sectionLabel}>Current Mission</Text>
        <View style={styles.missionCard}>
          <View style={styles.missionHeaderRow}>
            <Text style={styles.missionTitle}>{currentMission.title}</Text>
            <Text style={styles.missionPercent}>{progressPct}%</Text>
          </View>
          <Text style={styles.missionObjective}>{currentMission.objective}</Text>
          {activeStepStatus && (
            <View style={styles.activeStepCard}>
              <Text style={styles.activeStepLabel}>Next Step</Text>
              <Text style={styles.activeStepTitle}>{activeStepStatus.step.title}</Text>
              <Text style={styles.activeStepInstruction}>{activeStepStatus.step.instruction}</Text>
              <Text style={styles.missionLore}>{activeStepStatus.step.narrative}</Text>
            </View>
          )}
          {stepStatuses.length > 0 && (
            <View style={styles.stepList}>
              {stepStatuses.map((status, index) => (
                <View key={status.step.id} style={styles.stepRow}>
                  <Text style={[styles.stepIndex, status.isComplete && styles.stepIndexComplete]}>
                    {status.isComplete ? '✓' : index + 1}
                  </Text>
                  <View style={styles.stepTextBlock}>
                    <Text style={[styles.stepTitle, status.isComplete && styles.stepTitleComplete]}>
                      {status.step.title}
                    </Text>
                    <Text style={styles.stepProgress}>
                      {formatQuantity(status.current)} / {formatQuantity(status.target)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
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
    <View
      style={[
        styles.container,
        {
          paddingBottom: dockBottomPadding,
          paddingLeft: dockSidePadding,
          paddingRight: dockSidePadding,
        },
      ]}
    >
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'PALETTE' && styles.tabButtonActive]}
          onPress={() => toggleActiveTab('PALETTE')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'PALETTE' && styles.tabButtonTextActive]}>
            Build
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'LEDGER' && styles.tabButtonActive]}
          onPress={() => toggleActiveTab('LEDGER')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'LEDGER' && styles.tabButtonTextActive]}>
            Status
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'MISSIONS' && styles.tabButtonActive]}
          onPress={() => toggleActiveTab('MISSIONS')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'MISSIONS' && styles.tabButtonTextActive]}>
            Missions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'VIEW' && styles.tabButtonActive]}
          onPress={() => toggleActiveTab('VIEW')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'VIEW' && styles.tabButtonTextActive]}>
            View
          </Text>
        </TouchableOpacity>
      </View>

      {isDockRaised && activeTab === 'PALETTE' && (
        <View style={styles.buildPanel}>
          <View style={styles.categoryGrid}>
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
          </View>

          <Text style={styles.categoryDescription}>{activeBuildCategory.description}</Text>

          <View style={styles.paletteGrid}>
            {buildMenuItems.map((item) => {
              if (item.kind === 'METHOD') {
                return (
                  <View
                    key={item.id}
                    style={[styles.paletteButton, !item.isUnlocked && styles.paletteButtonLocked]}
                  >
                    <PowerLineIcon isLocked={!item.isUnlocked} />
                    <Text style={[styles.structurePaletteName, !item.isUnlocked && styles.lockedText]}>{item.name}</Text>
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
          </View>
        </View>
      )}

      {isDockRaised && activeTab === 'LEDGER' && renderStatusPanel()}

      {isDockRaised && activeTab === 'MISSIONS' && renderMissionPanel()}
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
  const didDrop = useSharedValue(false);
  const footprintSize = getNodeFootprintSize(type);

  const dragStyle = useAnimatedStyle(() => ({
    opacity: isDragging.value ? 0 : 1,
    transform: [
      { translateX: dragX.value },
      { translateY: dragY.value },
      { scale: isDragging.value ? 1.05 : 1 },
    ],
  }));

  const dragGesture = Gesture.Pan()
    .enabled(isUnlocked)
    .minDistance(6)
    .onBegin((event) => {
      isDragging.value = true;
      didDrop.value = false;
      placementDragShared.isActive.value = true;
      placementDragShared.size.value = footprintSize;
      placementDragShared.absoluteX.value = event.absoluteX;
      placementDragShared.absoluteY.value = event.absoluteY;
      runOnJS(onSelect)(type);
    })
    .onUpdate((event) => {
      dragX.value = event.translationX;
      dragY.value = event.translationY;
      placementDragShared.absoluteX.value = event.absoluteX;
      placementDragShared.absoluteY.value = event.absoluteY;
    })
    .onEnd(() => {
      didDrop.value = true;
      placementDragShared.isActive.value = false;
      runOnJS(onDrop)(type, placementDragShared.absoluteX.value, placementDragShared.absoluteY.value);
    })
    .onFinalize(() => {
      if (!didDrop.value && placementDragShared.isActive.value) {
        runOnJS(onDrop)(type, placementDragShared.absoluteX.value, placementDragShared.absoluteY.value);
      }
      didDrop.value = false;
      isDragging.value = false;
      placementDragShared.isActive.value = false;
      dragX.value = withTiming(0, { duration: 120 });
      dragY.value = withTiming(0, { duration: 120 });
    });

  const tapGesture = Gesture.Tap()
    .enabled(isUnlocked)
    .onEnd(() => {
      runOnJS(onSelect)(isSelected ? null : type);
    });

  const paletteGesture = Gesture.Exclusive(dragGesture, tapGesture);

  return (
    <GestureDetector gesture={paletteGesture}>
      <Animated.View
        style={[
          styles.paletteButton,
          isSelected && styles.paletteButtonSelected,
          !isUnlocked && styles.paletteButtonLocked,
          dragStyle,
        ]}
      >
        <View style={styles.structurePaletteContent}>
          <StructureIcon type={type} isLocked={!isUnlocked} />
          <Text style={[styles.structurePaletteName, !isUnlocked && styles.lockedText]} numberOfLines={2}>
            {getNodeDisplayName(type)}
          </Text>
          {!isUnlocked && <Text style={styles.lockedLabel}>LOCKED</Text>}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

function PowerLineIcon({ isLocked }: { isLocked: boolean }) {
  const accentColor = isLocked ? '#607D8B' : '#00BCD4';
  const accent = { backgroundColor: accentColor };
  const accentBorder = { borderColor: accentColor };

  return (
    <View style={styles.structureIcon}>
      <View style={[styles.structureIconGround, accent]} />
      <View style={[styles.iconPowerLineCableLeft, accentBorder]} />
      <View style={[styles.iconPowerLineCableMiddle, accentBorder]} />
      <View style={[styles.iconPowerLineCableRight, accentBorder]} />
      <View style={[styles.iconPowerPoleLeft, accent]} />
      <View style={[styles.iconPowerPoleRight, accent]} />
      <View style={[styles.iconPowerPoleCrossbarLeft, accent]} />
      <View style={[styles.iconPowerPoleCrossbarRight, accent]} />
      <View style={[styles.iconPowerPoleInsulatorLeft, accent]} />
      <View style={[styles.iconPowerPoleInsulatorRight, accent]} />
    </View>
  );
}

function StructureIcon({ type, isLocked }: { type: NodeType; isLocked: boolean }) {
  const accentColor = isLocked ? '#607D8B' : '#00BCD4';
  const accent = { backgroundColor: accentColor };
  const accentBorder = { borderColor: accentColor };

  const icon = (() => {
    switch (type) {
      case 'POWER_GENERATOR':
        return (
          <>
            <View style={[styles.iconGeneratorTower, accentBorder]} />
            <View style={[styles.iconGeneratorCore, accentBorder]} />
            <View style={[styles.iconGeneratorSparkLeft, accent]} />
            <View style={[styles.iconGeneratorSparkRight, accent]} />
          </>
        );
      case 'HARVESTER':
        return (
          <>
            <View style={[styles.iconHarvesterCab, accentBorder]} />
            <View style={[styles.iconHarvesterBeam, accent]} />
            <View style={[styles.iconHarvesterFootLeft, accent]} />
            <View style={[styles.iconHarvesterFootRight, accent]} />
            <View style={[styles.iconHarvesterDrill, accentBorder]} />
          </>
        );
      case 'REFINER':
        return (
          <>
            <View style={[styles.iconRefinerTankLeft, accentBorder]} />
            <View style={[styles.iconRefinerTankRight, accentBorder]} />
            <View style={[styles.iconRefinerPipe, accent]} />
            <View style={[styles.iconRefinerGauge, accent]} />
          </>
        );
      case 'ASSEMBLER':
        return (
          <>
            <View style={[styles.iconAssemblerBody, accentBorder]} />
            <View style={[styles.iconAssemblerArmLeft, accent]} />
            <View style={[styles.iconAssemblerArmRight, accent]} />
            <View style={[styles.iconAssemblerCore, accentBorder]} />
          </>
        );
      case 'STORAGE':
        return (
          <>
            <View style={[styles.iconStorageTop, accentBorder]} />
            <View style={[styles.iconStorageMiddle, accentBorder]} />
            <View style={[styles.iconStorageBottom, accentBorder]} />
          </>
        );
      case 'SINK':
        return (
          <>
            <View style={[styles.iconSinkMouth, accentBorder]} />
            <View style={[styles.iconSinkNeck, accent]} />
            <View style={[styles.iconSinkBase, accentBorder]} />
          </>
        );
      case 'RELAY':
        return (
          <>
            <View style={[styles.iconRelayMast, accent]} />
            <View style={[styles.iconRelayDish, accentBorder]} />
            <View style={[styles.iconRelaySignalOuter, accentBorder]} />
            <View style={[styles.iconRelaySignalInner, accentBorder]} />
            <View style={[styles.iconRelayBase, accentBorder]} />
          </>
        );
      case 'FEEDBACK_REGULATOR':
        return (
          <>
            <View style={[styles.iconRegulatorRing, accentBorder]} />
            <View style={[styles.iconRegulatorCore, accent]} />
            <View style={[styles.iconRegulatorPortLeft, accentBorder]} />
            <View style={[styles.iconRegulatorPortRight, accentBorder]} />
          </>
        );
      case 'MERGE_UNIT':
        return (
          <>
            <View style={[styles.iconRouteInputTop, accent]} />
            <View style={[styles.iconRouteInputBottom, accent]} />
            <View style={[styles.iconRouteMergeTop, accent]} />
            <View style={[styles.iconRouteMergeBottom, accent]} />
            <View style={[styles.iconRouteOutput, accent]} />
            <View style={[styles.iconRouteCore, accentBorder]} />
          </>
        );
      case 'SPLIT_UNIT':
        return (
          <>
            <View style={[styles.iconRouteInput, accent]} />
            <View style={[styles.iconRouteSplitTop, accent]} />
            <View style={[styles.iconRouteSplitBottom, accent]} />
            <View style={[styles.iconRouteOutputTop, accent]} />
            <View style={[styles.iconRouteOutputBottom, accent]} />
            <View style={[styles.iconRouteCore, accentBorder]} />
          </>
        );
    }
  })();

  return (
    <View style={[styles.structureIcon, accentBorder]}>
      <View style={[styles.structureIconGround, accent]} />
      {icon}
    </View>
  );
}

type StatusRecipeOption = {
  id: string;
  label: string;
  materialId: string;
  ratePerSecond: number;
  recipe: Recipe;
};

function getStatusRecipeOptions(
  node: FactoryNode,
  unlockedMaterialIds: string[],
  unlockedRecipeIds: string[]
): StatusRecipeOption[] {
  if (node.type === 'HARVESTER') {
    return EXTRACTABLE_MATERIAL_IDS
      .filter((materialId) => unlockedMaterialIds.includes(materialId))
      .map((materialId) => {
        const recipe = createExtractionRecipe(materialId);
        const output = recipe.outputs[0];
        return {
          id: `extract_${materialId}`,
          label: MATERIALS[materialId]?.name ?? materialId.replace(/_/g, ' '),
          materialId,
          ratePerSecond: getHarvesterOutputRate(node, materialId),
          recipe,
        };
      });
  }

  const recipeIdsForNode = RECIPE_IDS_BY_NODE_TYPE[node.type as NonNullable<Recipe['nodeType']>] ?? [];
  return recipeIdsForNode
    .filter((recipeId) => unlockedRecipeIds.includes(recipeId))
    .map((recipeId) => {
      const recipe = RECIPES[recipeId];
      const output = recipe.outputs[0];
      return {
        id: recipeId,
        label: MATERIALS[output.materialId]?.name ?? output.materialId.replace(/_/g, ' '),
        materialId: output.materialId,
        ratePerSecond: output.ratePerSecond,
        recipe,
      };
    });
}

function MachineStatusPanel({
  node,
  nodeCount,
  edges,
  onConnect,
  onDelete,
  onSelectRecipe,
  unlockedMaterialIds,
  unlockedRecipeIds,
}: {
  node?: FactoryNode;
  nodeCount: number;
  edges: FactoryEdge[];
  onConnect: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onSelectRecipe: (nodeId: string, recipe?: Recipe) => void;
  unlockedMaterialIds: string[];
  unlockedRecipeIds: string[];
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
  const legacyHarvesterMaterialId = node.type === 'HARVESTER' && !recipeOutput ? 'void_ore' : undefined;
  const activeRecipeMaterialId = recipeOutput?.materialId ?? legacyHarvesterMaterialId;
  const recipeName = activeRecipeMaterialId ? MATERIALS[activeRecipeMaterialId]?.name ?? activeRecipeMaterialId : 'No recipe';
  const recipeOptions = getStatusRecipeOptions(node, unlockedMaterialIds, unlockedRecipeIds);
  const harvesterDefinition = node.type === 'HARVESTER' ? getHarvesterTierDefinition(node.harvesterTier) : undefined;
  const activeBuffer = activeRecipeMaterialId ? node.outputBuffers[activeRecipeMaterialId] : undefined;
  const fallbackBufferEntry = Object.entries(node.outputBuffers)[0];
  const bufferMaterialId = activeRecipeMaterialId ?? fallbackBufferEntry?.[0];
  const buffer = activeBuffer ?? fallbackBufferEntry?.[1];
  const bufferMaterialName = bufferMaterialId ? MATERIALS[bufferMaterialId]?.name ?? bufferMaterialId.replace(/_/g, ' ') : 'Empty';
  const storageInventory = node.type === 'STORAGE'
    ? Object.entries(node.inputBuffers)
      .filter(([, itemBuffer]) => itemBuffer.current > 0)
      .sort(([left], [right]) => left.localeCompare(right))
    : [];
  const storageItemCount = node.type === 'STORAGE' ? getStorageItemCount(node) : 0;
  const storageUsedStacks = node.type === 'STORAGE' ? getStorageUsedStackCount(node) : 0;

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

      {node.type === 'STORAGE' ? (
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Function</Text>
          <Text style={styles.detailValue}>Passive connection storage</Text>
        </View>
      ) : (
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Recipe</Text>
          <Text style={styles.detailValue}>{recipeName}</Text>
        </View>
      )}
      {node.type === 'STORAGE' && (
        <View style={styles.inventoryCard}>
          <View style={styles.inventoryHeader}>
            <Text style={styles.sectionLabel}>Inventory</Text>
            <Text style={styles.inventoryCapacity}>
              {storageUsedStacks} / {STORAGE_STACK_CAPACITY} stacks · {formatQuantity(storageItemCount)} / {STORAGE_ITEM_CAPACITY}
            </Text>
          </View>
          {storageInventory.length === 0 ? (
            <Text style={styles.inventoryEmpty}>No items received.</Text>
          ) : (
            storageInventory.map(([materialId, itemBuffer]) => (
              <View key={materialId} style={styles.inventoryRow}>
                <Text style={styles.inventoryMaterial}>
                  {MATERIALS[materialId]?.name ?? materialId.replace(/_/g, ' ')}
                </Text>
                <Text style={styles.inventoryQuantity}>
                  {formatQuantity(itemBuffer.current)} · {Math.ceil(itemBuffer.current / STORAGE_STACK_SIZE)} stack{Math.ceil(itemBuffer.current / STORAGE_STACK_SIZE) === 1 ? '' : 's'}
                </Text>
              </View>
            ))
          )}
        </View>
      )}
      {harvesterDefinition && (
        <>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Variant</Text>
            <Text style={styles.detailValue}>T{harvesterDefinition.tier} {harvesterDefinition.name}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Internal Inventory</Text>
            <Text style={styles.detailValue}>
              {formatQuantity(buffer?.current ?? 0)} / {formatQuantity(buffer?.max ?? harvesterDefinition.internalInventoryCapacity)} {bufferMaterialName}
            </Text>
          </View>
        </>
      )}
      {recipeOptions.length > 0 && (
        <View style={styles.recipeSelector}>
          <Text style={styles.recipeSelectorLabel}>Select Recipe</Text>
          <View style={styles.recipeOptionGrid}>
            {recipeOptions.map((option) => {
              const isActive = option.materialId === activeRecipeMaterialId;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.recipeOptionButton, isActive && styles.recipeOptionButtonActive]}
                  onPress={() => onSelectRecipe(node.id, option.recipe)}
                >
                  <Text style={[styles.recipeOptionText, isActive && styles.recipeOptionTextActive]} numberOfLines={1}>
                    {option.label}
                  </Text>
                  <Text style={styles.recipeOptionMeta}>{formatQuantity(option.ratePerSecond)}/s</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
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
    alignItems: 'center',
    flex: 1,
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
    paddingHorizontal: 10,
    paddingTop: 4,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 4,
  },
  categoryButton: {
    alignItems: 'center',
    borderColor: '#334155',
    borderRadius: 14,
    borderWidth: 1,
    flexBasis: '23.5%',
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 27,
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  categoryButtonActive: {
    backgroundColor: '#1C2733',
    borderColor: '#00BCD4',
  },
  categoryButtonText: {
    color: '#8B9DC3',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  categoryDescription: {
    color: '#8B9DC3',
    fontSize: 10,
    minHeight: 22,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  paletteGrid: {
    alignContent: 'flex-start',
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 4,
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
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 92,
    minWidth: 0,
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
    textAlign: 'center',
  },
  structurePaletteContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  structurePaletteName: {
    color: '#C7D2E2',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
    marginTop: 4,
    minHeight: 22,
    textAlign: 'center',
  },
  structureIcon: {
    height: 48,
    position: 'relative',
    width: 64,
  },
  structureIconGround: {
    borderRadius: 2,
    bottom: 2,
    height: 2,
    left: 7,
    opacity: 0.55,
    position: 'absolute',
    width: 50,
  },
  iconPowerLineCableLeft: {
    borderBottomWidth: 2,
    borderRadius: 12,
    height: 12,
    left: 14,
    position: 'absolute',
    top: 8,
    transform: [{ rotate: '8deg' }],
    width: 18,
  },
  iconPowerLineCableMiddle: {
    borderBottomWidth: 2,
    borderRadius: 16,
    height: 17,
    left: 23,
    position: 'absolute',
    top: 7,
    width: 18,
  },
  iconPowerLineCableRight: {
    borderBottomWidth: 2,
    borderRadius: 12,
    height: 12,
    position: 'absolute',
    right: 14,
    top: 8,
    transform: [{ rotate: '-8deg' }],
    width: 18,
  },
  iconPowerPoleLeft: {
    bottom: 4,
    height: 34,
    left: 15,
    position: 'absolute',
    width: 3,
  },
  iconPowerPoleRight: {
    bottom: 4,
    height: 34,
    position: 'absolute',
    right: 15,
    width: 3,
  },
  iconPowerPoleCrossbarLeft: {
    height: 3,
    left: 9,
    position: 'absolute',
    top: 10,
    width: 15,
  },
  iconPowerPoleCrossbarRight: {
    height: 3,
    position: 'absolute',
    right: 9,
    top: 10,
    width: 15,
  },
  iconPowerPoleInsulatorLeft: {
    borderRadius: 2,
    height: 5,
    left: 10,
    position: 'absolute',
    top: 7,
    width: 3,
  },
  iconPowerPoleInsulatorRight: {
    borderRadius: 2,
    height: 5,
    position: 'absolute',
    right: 10,
    top: 7,
    width: 3,
  },
  iconGeneratorTower: {
    borderRadius: 4,
    borderWidth: 2,
    bottom: 5,
    height: 31,
    left: 21,
    position: 'absolute',
    width: 22,
  },
  iconGeneratorCore: {
    backgroundColor: '#0D1117',
    borderRadius: 9,
    borderWidth: 2,
    bottom: 13,
    height: 18,
    left: 23,
    position: 'absolute',
    width: 18,
  },
  iconGeneratorSparkLeft: {
    height: 9,
    left: 15,
    position: 'absolute',
    top: 3,
    transform: [{ rotate: '-35deg' }],
    width: 2,
  },
  iconGeneratorSparkRight: {
    height: 9,
    position: 'absolute',
    right: 15,
    top: 3,
    transform: [{ rotate: '35deg' }],
    width: 2,
  },
  iconHarvesterCab: {
    borderRadius: 5,
    borderWidth: 2,
    height: 18,
    left: 17,
    position: 'absolute',
    top: 8,
    width: 30,
  },
  iconHarvesterBeam: {
    height: 12,
    left: 30,
    position: 'absolute',
    top: 25,
    width: 4,
  },
  iconHarvesterFootLeft: {
    bottom: 5,
    height: 13,
    left: 19,
    position: 'absolute',
    transform: [{ rotate: '24deg' }],
    width: 3,
  },
  iconHarvesterFootRight: {
    bottom: 5,
    height: 13,
    position: 'absolute',
    right: 19,
    transform: [{ rotate: '-24deg' }],
    width: 3,
  },
  iconHarvesterDrill: {
    borderRadius: 2,
    borderWidth: 2,
    bottom: 4,
    height: 8,
    left: 27,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: 8,
  },
  iconRefinerTankLeft: {
    borderRadius: 9,
    borderWidth: 2,
    bottom: 5,
    height: 34,
    left: 13,
    position: 'absolute',
    width: 18,
  },
  iconRefinerTankRight: {
    borderRadius: 9,
    borderWidth: 2,
    bottom: 5,
    height: 27,
    position: 'absolute',
    right: 13,
    width: 18,
  },
  iconRefinerPipe: {
    height: 3,
    left: 30,
    position: 'absolute',
    top: 20,
    width: 5,
  },
  iconRefinerGauge: {
    borderRadius: 3,
    height: 6,
    left: 19,
    position: 'absolute',
    top: 14,
    width: 6,
  },
  iconAssemblerBody: {
    borderRadius: 5,
    borderWidth: 2,
    bottom: 5,
    height: 28,
    left: 18,
    position: 'absolute',
    width: 28,
  },
  iconAssemblerArmLeft: {
    height: 4,
    left: 9,
    position: 'absolute',
    top: 17,
    transform: [{ rotate: '-25deg' }],
    width: 14,
  },
  iconAssemblerArmRight: {
    height: 4,
    position: 'absolute',
    right: 9,
    top: 17,
    transform: [{ rotate: '25deg' }],
    width: 14,
  },
  iconAssemblerCore: {
    borderRadius: 4,
    borderWidth: 2,
    height: 9,
    left: 27,
    position: 'absolute',
    top: 24,
    transform: [{ rotate: '45deg' }],
    width: 9,
  },
  iconStorageTop: {
    borderRadius: 5,
    borderWidth: 2,
    height: 11,
    left: 18,
    position: 'absolute',
    top: 7,
    width: 28,
  },
  iconStorageMiddle: {
    borderRadius: 5,
    borderWidth: 2,
    height: 11,
    left: 15,
    position: 'absolute',
    top: 19,
    width: 34,
  },
  iconStorageBottom: {
    borderRadius: 5,
    borderWidth: 2,
    bottom: 5,
    height: 11,
    left: 12,
    position: 'absolute',
    width: 40,
  },
  iconSinkMouth: {
    borderRadius: 4,
    borderWidth: 2,
    height: 17,
    left: 12,
    position: 'absolute',
    top: 7,
    width: 40,
  },
  iconSinkNeck: {
    height: 13,
    left: 29,
    position: 'absolute',
    top: 23,
    width: 6,
  },
  iconSinkBase: {
    borderRadius: 4,
    borderWidth: 2,
    bottom: 5,
    height: 10,
    left: 21,
    position: 'absolute',
    width: 22,
  },
  iconRelayMast: {
    bottom: 5,
    height: 29,
    left: 31,
    position: 'absolute',
    width: 2,
  },
  iconRelayDish: {
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderRadius: 10,
    height: 16,
    left: 19,
    position: 'absolute',
    top: 8,
    transform: [{ rotate: '-35deg' }],
    width: 16,
  },
  iconRelaySignalOuter: {
    borderRadius: 12,
    borderRightWidth: 2,
    borderTopWidth: 2,
    height: 22,
    position: 'absolute',
    right: 12,
    top: 2,
    transform: [{ rotate: '45deg' }],
    width: 22,
  },
  iconRelaySignalInner: {
    borderRadius: 8,
    borderRightWidth: 2,
    borderTopWidth: 2,
    height: 13,
    position: 'absolute',
    right: 18,
    top: 8,
    transform: [{ rotate: '45deg' }],
    width: 13,
  },
  iconRelayBase: {
    borderRadius: 3,
    borderWidth: 2,
    bottom: 5,
    height: 8,
    left: 22,
    position: 'absolute',
    width: 20,
  },
  iconRegulatorRing: {
    borderRadius: 17,
    borderWidth: 3,
    height: 34,
    left: 15,
    position: 'absolute',
    top: 6,
    width: 34,
  },
  iconRegulatorCore: {
    borderRadius: 6,
    height: 12,
    left: 26,
    position: 'absolute',
    top: 17,
    transform: [{ rotate: '45deg' }],
    width: 12,
  },
  iconRegulatorPortLeft: {
    borderRadius: 3,
    borderWidth: 2,
    height: 10,
    left: 8,
    position: 'absolute',
    top: 18,
    width: 9,
  },
  iconRegulatorPortRight: {
    borderRadius: 3,
    borderWidth: 2,
    height: 10,
    position: 'absolute',
    right: 8,
    top: 18,
    width: 9,
  },
  iconRouteCore: {
    borderRadius: 5,
    borderWidth: 2,
    height: 14,
    left: 25,
    position: 'absolute',
    top: 17,
    transform: [{ rotate: '45deg' }],
    width: 14,
  },
  iconRouteInputTop: {
    height: 3,
    left: 7,
    position: 'absolute',
    top: 11,
    width: 15,
  },
  iconRouteInputBottom: {
    bottom: 11,
    height: 3,
    left: 7,
    position: 'absolute',
    width: 15,
  },
  iconRouteMergeTop: {
    height: 3,
    left: 18,
    position: 'absolute',
    top: 15,
    transform: [{ rotate: '35deg' }],
    width: 13,
  },
  iconRouteMergeBottom: {
    bottom: 15,
    height: 3,
    left: 18,
    position: 'absolute',
    transform: [{ rotate: '-35deg' }],
    width: 13,
  },
  iconRouteOutput: {
    height: 3,
    position: 'absolute',
    right: 7,
    top: 23,
    width: 18,
  },
  iconRouteInput: {
    height: 3,
    left: 7,
    position: 'absolute',
    top: 23,
    width: 18,
  },
  iconRouteSplitTop: {
    height: 3,
    position: 'absolute',
    right: 18,
    top: 15,
    transform: [{ rotate: '-35deg' }],
    width: 13,
  },
  iconRouteSplitBottom: {
    bottom: 15,
    height: 3,
    position: 'absolute',
    right: 18,
    transform: [{ rotate: '35deg' }],
    width: 13,
  },
  iconRouteOutputTop: {
    height: 3,
    position: 'absolute',
    right: 7,
    top: 11,
    width: 15,
  },
  iconRouteOutputBottom: {
    bottom: 11,
    height: 3,
    position: 'absolute',
    right: 7,
    width: 15,
  },
  lockedText: {
    color: '#607D8B',
  },
  paletteHint: {
    color: '#8B9DC3',
    fontSize: 8,
    marginTop: 3,
    maxWidth: 130,
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
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 92,
    minWidth: 0,
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
  inventoryCard: {
    backgroundColor: '#0D1117',
    borderColor: '#1C2733',
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
  },
  inventoryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inventoryCapacity: {
    color: '#00BCD4',
    fontSize: 9,
    fontWeight: '700',
  },
  inventoryEmpty: {
    color: '#607D8B',
    fontSize: 10,
    marginTop: 8,
  },
  inventoryRow: {
    alignItems: 'center',
    borderTopColor: '#1C2733',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
    paddingTop: 7,
  },
  inventoryMaterial: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  inventoryQuantity: {
    color: '#8B9DC3',
    fontSize: 10,
  },
  recipeSelector: {
    backgroundColor: '#0D1117',
    borderColor: '#1C2733',
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
  },
  recipeSelectorLabel: {
    color: '#607D8B',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  recipeOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 7,
  },
  recipeOptionButton: {
    borderColor: '#334155',
    borderRadius: 7,
    borderWidth: 1,
    flexBasis: '31%',
    flexGrow: 1,
    minWidth: 0,
    paddingHorizontal: 7,
    paddingVertical: 6,
  },
  recipeOptionButtonActive: {
    backgroundColor: '#12303A',
    borderColor: '#00BCD4',
  },
  recipeOptionText: {
    color: '#C8D4E0',
    fontSize: 10,
    fontWeight: '700',
  },
  recipeOptionTextActive: {
    color: '#FFFFFF',
  },
  recipeOptionMeta: {
    color: '#00BCD4',
    fontSize: 9,
    marginTop: 2,
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
  activeStepCard: {
    backgroundColor: '#0D1117',
    borderColor: '#00BCD4',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    padding: 10,
  },
  activeStepLabel: {
    color: '#00BCD4',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  activeStepTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  activeStepInstruction: {
    color: '#D0D7DE',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  stepList: {
    gap: 6,
    marginTop: 10,
  },
  stepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  stepIndex: {
    borderColor: '#334155',
    borderRadius: 12,
    borderWidth: 1,
    color: '#8B9DC3',
    fontSize: 11,
    fontWeight: '700',
    height: 24,
    lineHeight: 22,
    textAlign: 'center',
    width: 24,
  },
  stepIndexComplete: {
    backgroundColor: '#00BCD4',
    borderColor: '#00BCD4',
    color: '#0A0E14',
  },
  stepTextBlock: {
    flex: 1,
  },
  stepTitle: {
    color: '#D0D7DE',
    fontSize: 12,
    fontWeight: '700',
  },
  stepTitleComplete: {
    color: '#8B9DC3',
  },
  stepProgress: {
    color: '#607D8B',
    fontSize: 10,
    marginTop: 1,
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
