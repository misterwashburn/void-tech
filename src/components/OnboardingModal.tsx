import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getCurrentMission, getMissionStepStatuses } from '../data/missions';
import { MATERIALS } from '../data/materials';
import { useFactoryStore } from '../store/useFactoryStore';
import { useUIStore } from '../store/useUIStore';

const SPEAKER_NAME = 'Mara Voss';
const SPEAKER_ROLE = 'Mission Control';

export default function OnboardingModal() {
  const nodes = useFactoryStore((s) => s.nodes);
  const edges = useFactoryStore((s) => s.edges);
  const producedTotals = useFactoryStore((s) => s.producedTotals);
  const completedMissionIds = useFactoryStore((s) => s.completedMissionIds);
  const acknowledgeOnboarding = useFactoryStore((s) => s.acknowledgeOnboarding);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const currentMission = getCurrentMission(completedMissionIds);
  const [revealedChars, setRevealedChars] = useState(0);

  const stepStatuses = useMemo(() => {
    if (!currentMission || currentMission.id !== 'mission_into_the_void') {
      return [];
    }

    return getMissionStepStatuses(currentMission, { nodes, edges, producedTotals });
  }, [currentMission, edges, nodes, producedTotals]);

  const activeStepStatus = stepStatuses.find((status) => !status.isComplete);
  const isReadyToContinue = stepStatuses.length > 0 && !activeStepStatus;
  const completedSteps = stepStatuses.filter((status) => status.isComplete).length;
  const progressPct = Math.round((completedSteps / Math.max(stepStatuses.length, 1)) * 100);
  const activeMessage = activeStepStatus
    ? `${activeStepStatus.step.narrative} ${activeStepStatus.step.instruction}`
    : currentMission?.narrativeBeat ?? '';
  const visibleMessage = activeMessage.slice(0, revealedChars);
  const activeTask = activeStepStatus?.step.title ?? 'Mission briefing complete';
  const hasStorage = Object.values(nodes).some((node) => node.type === 'STORAGE');
  const shouldOpenBuild = activeStepStatus?.step.kind === 'BUILD_NODE'
    || (activeStepStatus?.step.kind === 'STORE_MATERIAL' && !hasStorage);
  const actionLabel = isReadyToContinue ? 'Onward!' : shouldOpenBuild ? 'Open Build' : 'View Grid';

  useEffect(() => {
    setRevealedChars(0);
  }, [activeMessage]);

  useEffect(() => {
    if (!currentMission || currentMission.id !== 'mission_into_the_void') {
      return;
    }

    if (revealedChars >= activeMessage.length) {
      return;
    }

    const timerId = setTimeout(() => {
      setRevealedChars((value) => Math.min(activeMessage.length, value + 2));
    }, 24);

    return () => clearTimeout(timerId);
  }, [activeMessage, currentMission, revealedChars]);

  if (!currentMission || currentMission.id !== 'mission_into_the_void') {
    return null;
  }

  function handleActionPress() {
    if (isReadyToContinue) {
      acknowledgeOnboarding();
      setActiveTab('VIEW');
      return;
    }

    setActiveTab(shouldOpenBuild ? 'PALETTE' : 'VIEW');
  }

  return (
    <View style={styles.panel}>
      <View style={styles.transmissionHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>MV</Text>
        </View>
        <View style={styles.speakerBlock}>
          <Text style={styles.speakerName}>{SPEAKER_NAME}</Text>
          <Text style={styles.speakerRole}>{SPEAKER_ROLE} · Remote uplink</Text>
        </View>
        <Text style={styles.progressText}>{progressPct}%</Text>
      </View>

      <View style={styles.messageBubble}>
        <Text style={styles.messageText}>
          {visibleMessage}
          {revealedChars < activeMessage.length ? <Text style={styles.cursor}>▌</Text> : null}
        </Text>
      </View>

      <View style={styles.taskRow}>
        <View style={styles.taskBlock}>
          <Text style={styles.taskLabel}>Current task</Text>
          <Text style={styles.taskTitle}>{activeTask}</Text>
          {activeStepStatus ? (
            <Text style={styles.taskProgress}>
              {activeStepStatus.current.toFixed(activeStepStatus.current >= 10 ? 0 : 1)} / {activeStepStatus.target}
              {activeStepStatus.step.kind === 'PRODUCE_MATERIAL' || activeStepStatus.step.kind === 'STORE_MATERIAL'
                ? ` ${MATERIALS[activeStepStatus.step.materialId]?.name ?? activeStepStatus.step.materialId}`
                : ''}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={handleActionPress}
          style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
        >
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </Pressable>
      </View>

      <View style={styles.stepRail}>
        {stepStatuses.map((status, index) => (
          <View key={status.step.id} style={[styles.stepDot, status.isComplete && styles.stepDotComplete]}>
            <Text style={[styles.stepDotText, status.isComplete && styles.stepDotTextComplete]}>
              {status.isComplete ? '✓' : index + 1}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#0A0E14',
    borderBottomColor: '#1C2733',
    borderBottomWidth: 1,
    gap: 6,
    paddingBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 7,
    flexShrink: 0,
  },
  transmissionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#0D1117',
    borderColor: '#00BCD4',
    borderRadius: 15,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  avatarText: {
    color: '#00BCD4',
    fontSize: 11,
    fontWeight: '800',
  },
  speakerBlock: {
    flex: 1,
  },
  speakerName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  speakerRole: {
    color: '#8B9DC3',
    fontSize: 9,
    marginTop: 1,
  },
  progressText: {
    color: '#00BCD4',
    fontSize: 12,
    fontWeight: '800',
  },
  messageBubble: {
    backgroundColor: '#101923',
    borderColor: '#20364A',
    borderRadius: 10,
    borderTopLeftRadius: 3,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  messageText: {
    color: '#D0D7DE',
    fontSize: 11,
    lineHeight: 15,
  },
  cursor: {
    color: '#00BCD4',
  },
  taskRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  taskBlock: {
    flex: 1,
  },
  taskLabel: {
    color: '#00BCD4',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  taskTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  taskProgress: {
    color: '#8B9DC3',
    fontSize: 9,
    marginTop: 1,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#00BCD4',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 84,
    paddingHorizontal: 12,
  },
  actionButtonPressed: {
    opacity: 0.75,
  },
  actionButtonText: {
    color: '#0A0E14',
    fontSize: 11,
    fontWeight: '800',
  },
  stepRail: {
    flexDirection: 'row',
    gap: 5,
  },
  stepDot: {
    alignItems: 'center',
    borderColor: '#334155',
    borderRadius: 9,
    borderWidth: 1,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  stepDotComplete: {
    backgroundColor: '#00BCD4',
    borderColor: '#00BCD4',
  },
  stepDotText: {
    color: '#8B9DC3',
    fontSize: 10,
    fontWeight: '800',
  },
  stepDotTextComplete: {
    color: '#0A0E14',
  },
});
