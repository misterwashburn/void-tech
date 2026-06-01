import React, { useState } from 'react';
import { Alert, GestureResponderEvent, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AppMenu, { AppIcon } from '../src/components/AppMenu';
import { useSettingsStore } from '../src/store/useSettingsStore';

const MENU_ACTIONS = [
  { label: 'Continue', eyebrow: 'Resume active factory', route: '/' as const },
  { label: 'New Game', eyebrow: 'Start a fresh void run', route: '/' as const },
  { label: 'Achievements', eyebrow: 'Review factory milestones', route: '/stats' as const },
  { label: 'Settings', eyebrow: 'Tune audio levels', route: 'settings' as const },
  { label: 'Account', eyebrow: 'Pilot profile and sync', route: null },
];

export default function MainMenuScreen() {
  const router = useRouter();
  const [isSettingsVisible, setSettingsVisible] = useState(false);

  function handleMenuPress(action: (typeof MENU_ACTIONS)[number]) {
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
      <View style={styles.backgroundOrbTop} />
      <View style={styles.backgroundOrbBottom} />
      <View style={styles.gridLayer}>
        {Array.from({ length: 8 }).map((_, index) => (
          <View key={`scanline-${index}`} style={[styles.scanLine, { top: `${index * 14}%` }]} />
        ))}
      </View>

      <View style={styles.header}>
        <AppMenu compact />
      </View>

      <View style={styles.content}>
        <View style={styles.heroPanel}>
          <View style={styles.wordMarkWrap}>
            <Text accessibilityRole="header" style={[styles.wordMark, styles.wordMarkShadow]}>
              Void-Tech
            </Text>
            <Text style={styles.wordMark}>Void-Tech</Text>
          </View>

          <View style={styles.subtitlePill}>
            <View style={styles.subtitleDash} />
            <Text style={styles.subtitle}>Discover. Build. Plan.</Text>
            <View style={styles.subtitleDash} />
          </View>

          <View style={styles.logoPedestal}>
            <View style={styles.logoGlow} />
            <AppIcon size={116} />
            <Text style={styles.logoCaption}>Station Console</Text>
          </View>
        </View>

        <View style={styles.buttonStack}>
          {MENU_ACTIONS.map((action) => (
            <Pressable
              accessibilityRole="button"
              key={action.label}
              onPress={() => handleMenuPress(action)}
              style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
            >
              <View style={styles.buttonLeftRail} />
              <View style={styles.buttonContent}>
                <Text style={styles.buttonEyebrow}>{action.eyebrow}</Text>
                <Text style={styles.buttonLabel}>{action.label}</Text>
              </View>
              <View style={styles.buttonGlyph}>
                <Text style={styles.buttonGlyphText}>⌁</Text>
              </View>
            </Pressable>
          ))}
        </View>
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
  container: { backgroundColor: '#070B12', flex: 1, overflow: 'hidden' },
  backgroundOrbTop: {
    backgroundColor: 'rgba(0,188,212,0.16)',
    borderRadius: 180,
    height: 360,
    position: 'absolute',
    right: -140,
    top: -120,
    width: 360,
  },
  backgroundOrbBottom: {
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderRadius: 150,
    bottom: -90,
    height: 300,
    left: -120,
    position: 'absolute',
    width: 300,
  },
  gridLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  scanLine: {
    backgroundColor: 'rgba(0,188,212,0.08)',
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 36,
    paddingHorizontal: 24,
  },
  heroPanel: {
    alignItems: 'center',
    backgroundColor: 'rgba(10,14,20,0.82)',
    borderColor: 'rgba(0,188,212,0.28)',
    borderRadius: 32,
    borderWidth: 1,
    maxWidth: 440,
    paddingHorizontal: 28,
    paddingVertical: 32,
    shadowColor: '#00BCD4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    width: '100%',
  },
  wordMarkWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 78,
  },
  wordMark: {
    color: '#F8FCFF',
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: 1.8,
    textShadowColor: '#00BCD4',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
    textTransform: 'uppercase',
  },
  wordMarkShadow: {
    color: '#071018',
    position: 'absolute',
    marginLeft: 4,
    marginTop: 5,
    textShadowColor: '#FFD700',
    textShadowRadius: 7,
  },
  subtitlePill: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,188,212,0.08)',
    borderColor: 'rgba(125,220,232,0.28)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  subtitle: {
    color: '#BEEFF5',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  subtitleDash: {
    backgroundColor: '#FFD700',
    borderRadius: 2,
    height: 3,
    width: 22,
  },
  logoPedestal: {
    alignItems: 'center',
    marginTop: 26,
  },
  logoGlow: {
    backgroundColor: 'rgba(0,188,212,0.22)',
    borderRadius: 74,
    height: 148,
    position: 'absolute',
    top: -16,
    width: 148,
  },
  logoCaption: {
    color: '#6DE4F2',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.2,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  buttonStack: {
    gap: 14,
    marginTop: 26,
    maxWidth: 440,
    width: '100%',
  },
  menuButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(16,26,38,0.94)',
    borderColor: 'rgba(0,188,212,0.38)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 68,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
  },
  menuButtonPressed: {
    backgroundColor: 'rgba(0,188,212,0.16)',
    borderColor: '#FFD700',
    transform: [{ scale: 0.985 }],
  },
  buttonLeftRail: {
    alignSelf: 'stretch',
    backgroundColor: '#00BCD4',
    width: 6,
  },
  buttonContent: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonEyebrow: {
    color: '#7DDCE8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  buttonGlyph: {
    alignItems: 'center',
    borderColor: 'rgba(255,215,0,0.34)',
    borderRadius: 14,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    marginRight: 14,
    width: 42,
  },
  buttonGlyphText: {
    color: '#FFD700',
    fontSize: 25,
    fontWeight: '900',
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
