import React, { useState } from 'react';
import { Alert, GestureResponderEvent, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DimensionValue } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppIcon } from '../src/components/AppMenu';
import { useSettingsStore } from '../src/store/useSettingsStore';

const SECONDARY_ACTIONS = [
  { label: 'New Game', eyebrow: 'Start on a new station', code: 'NEW', route: '/' as const },
  { label: 'Achievements', eyebrow: 'Review milestones', code: 'ACH', route: '/stats' as const },
  { label: 'Settings', eyebrow: 'Tune audio, video & haptics', code: 'CFG', route: 'settings' as const },
  { label: 'Account', eyebrow: 'Profile & sync', code: 'USR', route: null },
];

const GRID_DOTS: Array<{ key: string; left: DimensionValue; top: DimensionValue }> = Array.from(
  { length: 110 },
  (_, index) => ({
    key: `grid-dot-${index}`,
    left: `${(index % 10) * 10 + 2}%` as DimensionValue,
    top: `${Math.floor(index / 10) * 9 + 2}%` as DimensionValue,
  })
);

export default function MainMenuScreen() {
  const router = useRouter();
  const [isSettingsVisible, setSettingsVisible] = useState(false);

  function handleMenuPress(action: (typeof SECONDARY_ACTIONS)[number]) {
    if (action.route === 'settings') {
      setSettingsVisible(true);
      return;
    }

    if (action.route) {
      router.push(action.route);
      return;
    }

    Alert.alert('Account Console', 'Account services are coming online in a future update.');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.phoneShell}>
        <View style={styles.dottedGrid} pointerEvents="none">
          {GRID_DOTS.map((dot) => (
            <View key={dot.key} style={[styles.gridDot, { left: dot.left, top: dot.top }]} />
          ))}
        </View>
        <View style={styles.topGlow} />
        <View style={styles.bottomGlow} />

        <ScrollView
          bounces={false}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.microLogo}>
              <AppIcon size={60} />
            </View>
            <Text accessibilityRole="header" style={styles.wordMark}>VOID-TECH</Text>
            <Text style={styles.subtitle}>DISCOVER  ·  BUILD  ·  PLAN</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/')}
            style={({ pressed }) => [styles.continueCard, pressed && styles.continueCardPressed]}
          >
            <View style={styles.continueHeader}>
              <View style={styles.continueCopy}>
                <Text style={styles.cardEyebrow}>RESUME ACTIVE STATION</Text>
                <Text style={styles.continueTitle}>Continue</Text>
              </View>
              <View style={styles.playButton}>
                <Text style={styles.playGlyph}>▶</Text>
              </View>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.stationMeta}>
              <Text style={styles.metaText}>SECTOR ALPHA · 14 NODES</Text>
              <Text style={styles.energyText}>⚡ 128.4 GJ</Text>
            </View>
            <View style={styles.badgeRow}>
              <Text style={[styles.badge, styles.operationalBadge]}>OPERATIONAL</Text>
              <Text style={[styles.badge, styles.starvedBadge]}>STARVED</Text>
              <Text style={styles.nominalText}>+12 nominal</Text>
            </View>
          </Pressable>

          <View style={styles.buttonStack}>
            {SECONDARY_ACTIONS.map((action) => (
              <Pressable
                accessibilityRole="button"
                key={action.label}
                onPress={() => handleMenuPress(action)}
                style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
              >
                <View style={styles.actionCodeBox}>
                  <Text style={styles.actionCode}>{action.code}</Text>
                </View>
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonEyebrow}>{action.eyebrow}</Text>
                  <Text style={styles.buttonLabel}>{action.label}</Text>
                </View>
                <Text style={styles.buttonChevron}>›</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.version}>v0.1.0</Text>
        </ScrollView>
      </View>

      <SettingsModal visible={isSettingsVisible} onClose={() => setSettingsVisible(false)} />
    </SafeAreaView>
  );
}

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const musicVolume = useSettingsStore((s) => s.musicVolume);
  const effectsVolume = useSettingsStore((s) => s.effectsVolume);
  const setMusicVolume = useSettingsStore((s) => s.setMusicVolume);
  const setEffectsVolume = useSettingsStore((s) => s.setEffectsVolume);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalScrim}>
        <View style={styles.settingsPanel}>
          <Text accessibilityRole="header" style={styles.settingsTitle}>Settings</Text>
          <Text style={styles.settingsSubtitle}>Sound</Text>

          <VolumeSlider label="Music" value={musicVolume} onChange={setMusicVolume} />
          <VolumeSlider label="Effects" value={effectsVolume} onChange={setEffectsVolume} />

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

interface VolumeSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function VolumeSlider({ label, value, onChange }: VolumeSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const percentage = Math.round(value * 100);

  function stepVolume(direction: -1 | 1) {
    onChange(value + direction * 0.1);
  }

  function updateFromGesture(event: GestureResponderEvent) {
    if (trackWidth === 0) {
      return;
    }

    onChange(event.nativeEvent.locationX / trackWidth);
  }

  return (
    <View style={styles.sliderGroup}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{percentage}%</Text>
      </View>
      <View style={styles.sliderControls}>
        <Pressable
          accessibilityLabel={`Lower ${label} volume`}
          accessibilityRole="button"
          onPress={() => stepVolume(-1)}
          style={styles.sliderStepButton}
        >
          <Text style={styles.sliderStepText}>−</Text>
        </Pressable>
        <View
          accessibilityLabel={`${label} volume`}
          accessibilityRole="adjustable"
          accessibilityValue={{ min: 0, max: 100, now: percentage }}
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={updateFromGesture}
          onResponderMove={updateFromGesture}
          onStartShouldSetResponder={() => true}
          style={styles.sliderTrack}
        >
          <View style={[styles.sliderFill, { width: `${percentage}%` }]} />
          <View style={[styles.sliderThumb, { left: `${percentage}%` }]} />
        </View>
        <Pressable
          accessibilityLabel={`Raise ${label} volume`}
          accessibilityRole="button"
          onPress={() => stepVolume(1)}
          style={styles.sliderStepButton}
        >
          <Text style={styles.sliderStepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#02050A',
    flex: 1,
  },
  phoneShell: {
    backgroundColor: '#070C13',
    borderColor: 'rgba(18, 37, 52, 0.9)',
    borderRadius: 52,
    borderWidth: 1,
    flex: 1,
    margin: 7,
    overflow: 'hidden',
  },
  dottedGrid: {
    ...StyleSheet.absoluteFillObject,
  },
  gridDot: {
    backgroundColor: 'rgba(0, 188, 212, 0.18)',
    borderRadius: 2,
    height: 4,
    position: 'absolute',
    width: 4,
  },
  topGlow: {
    backgroundColor: 'rgba(0, 188, 212, 0.08)',
    borderRadius: 180,
    height: 260,
    left: 60,
    position: 'absolute',
    right: 60,
    top: 96,
  },
  bottomGlow: {
    backgroundColor: 'rgba(0, 188, 212, 0.06)',
    borderRadius: 220,
    bottom: -120,
    height: 320,
    left: -24,
    position: 'absolute',
    right: -24,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingBottom: 34,
    paddingHorizontal: 26,
    paddingTop: 88,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 126,
  },
  microLogo: {
    alignItems: 'center',
    height: 72,
    justifyContent: 'center',
    marginBottom: 14,
    opacity: 0.98,
    width: 72,
  },
  wordMark: {
    color: '#00BCD4',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 4,
    lineHeight: 44,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 188, 212, 0.32)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  subtitle: {
    color: '#9EACC7',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 6,
    marginTop: 12,
    textAlign: 'center',
  },
  continueCard: {
    backgroundColor: 'rgba(6, 32, 41, 0.78)',
    borderColor: '#00BCD4',
    borderRadius: 14,
    borderWidth: 1.5,
    minHeight: 206,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingVertical: 24,
    shadowColor: '#00BCD4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  continueCardPressed: {
    backgroundColor: 'rgba(0, 188, 212, 0.16)',
    transform: [{ scale: 0.99 }],
  },
  continueHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  continueCopy: {
    flex: 1,
  },
  cardEyebrow: {
    color: '#00BCD4',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 4,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  continueTitle: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 42,
  },
  playButton: {
    alignItems: 'center',
    borderColor: '#FFE100',
    borderRadius: 36,
    borderWidth: 2.5,
    height: 72,
    justifyContent: 'center',
    marginLeft: 18,
    shadowColor: '#FFE100',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    width: 72,
  },
  playGlyph: {
    color: '#FFE100',
    fontSize: 25,
    marginLeft: 4,
  },
  cardDivider: {
    backgroundColor: 'rgba(132, 161, 184, 0.18)',
    height: 1,
    marginBottom: 24,
    marginTop: 27,
  },
  stationMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    color: '#8FA2BF',
    flex: 1,
    fontSize: 15,
    letterSpacing: 0.8,
  },
  energyText: {
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 1,
    marginLeft: 12,
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 18,
  },
  badge: {
    borderRadius: 4,
    borderWidth: 2,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  operationalBadge: {
    borderColor: '#00BCD4',
    color: '#00BCD4',
  },
  starvedBadge: {
    borderColor: '#FFB000',
    color: '#FFB000',
  },
  nominalText: {
    color: '#6F8399',
    fontSize: 15,
    letterSpacing: 1.3,
  },
  buttonStack: {
    gap: 13,
    marginTop: 18,
  },
  menuButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(11, 17, 25, 0.94)',
    borderColor: '#223648',
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    minHeight: 88,
    paddingHorizontal: 23,
  },
  menuButtonPressed: {
    backgroundColor: 'rgba(0, 188, 212, 0.1)',
    borderColor: 'rgba(0, 188, 212, 0.7)',
    transform: [{ scale: 0.99 }],
  },
  actionCodeBox: {
    alignItems: 'center',
    backgroundColor: '#0B222C',
    borderColor: '#1B4052',
    borderRadius: 10,
    borderWidth: 1.5,
    height: 64,
    justifyContent: 'center',
    width: 66,
  },
  actionCode: {
    color: '#00BCD4',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  buttonContent: {
    flex: 1,
    paddingLeft: 20,
  },
  buttonEyebrow: {
    color: '#6F8399',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3.8,
    marginBottom: 7,
    textTransform: 'uppercase',
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  buttonChevron: {
    color: '#7293A9',
    fontSize: 32,
    fontWeight: '300',
    marginLeft: 12,
  },
  version: {
    color: '#6F8399',
    fontSize: 12,
    letterSpacing: 4,
    marginTop: 26,
    textAlign: 'center',
  },
  modalScrim: {
    alignItems: 'center',
    backgroundColor: 'rgba(3,6,10,0.78)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  settingsPanel: {
    backgroundColor: 'rgba(10,14,20,0.98)',
    borderColor: 'rgba(0,188,212,0.44)',
    borderRadius: 28,
    borderWidth: 1,
    maxWidth: 420,
    padding: 24,
    shadowColor: '#00BCD4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    width: '100%',
  },
  settingsTitle: {
    color: '#F8FCFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  settingsSubtitle: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 20,
    marginTop: 8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  sliderGroup: {
    marginBottom: 22,
  },
  sliderHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sliderLabel: {
    color: '#BEEFF5',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  sliderValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  sliderControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  sliderStepButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,188,212,0.12)',
    borderColor: 'rgba(0,188,212,0.5)',
    borderRadius: 14,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  sliderStepText: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: '900',
  },
  sliderTrack: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(125,220,232,0.24)',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    height: 18,
    justifyContent: 'center',
    overflow: 'visible',
  },
  sliderFill: {
    backgroundColor: '#00BCD4',
    borderRadius: 999,
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  sliderThumb: {
    backgroundColor: '#FFD700',
    borderColor: '#FFFFFF',
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    marginLeft: -11,
    position: 'absolute',
    width: 22,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderColor: 'rgba(255,215,0,0.55)',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
    paddingVertical: 14,
  },
  closeButtonPressed: {
    backgroundColor: 'rgba(255,215,0,0.26)',
    transform: [{ scale: 0.985 }],
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
