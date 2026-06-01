import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AppMenu, { AppIcon } from '../src/components/AppMenu';

const MENU_ACTIONS = [
  { label: 'Continue', eyebrow: 'Resume active factory', route: '/' as const },
  { label: 'New Game', eyebrow: 'Start a fresh void run', route: '/' as const },
  { label: 'Achievements', eyebrow: 'Review factory milestones', route: '/stats' as const },
  { label: 'Account', eyebrow: 'Pilot profile and sync', route: null },
];

export default function MainMenuScreen() {
  const router = useRouter();

  function handleMenuPress(action: (typeof MENU_ACTIONS)[number]) {
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
    </SafeAreaView>
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
});
