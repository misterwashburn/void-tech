import React, { useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Canvas,
  Circle,
  Group,
  Line,
  RadialGradient,
  RoundedRect,
  vec,
} from '@shopify/react-native-skia';

interface AppMenuProps {
  compact?: boolean;
}

type MenuRoute = '/' | '/guide' | '/main-menu' | '/stats';

const MENU_ITEMS: Array<{ label: string; description: string; route: MenuRoute }> = [
  {
    label: 'Guide',
    description: 'Appendix of structures, materials, recipes, and void lore.',
    route: '/guide',
  },
  {
    label: 'Main Menu',
    description: 'Return to the Void-Tech start screen.',
    route: '/main-menu',
  },
  {
    label: 'Stats',
    description: 'Fun factory-wide numbers tracked across plays.',
    route: '/stats',
  },
];

export function AppIcon({ size = 36 }: { size?: number }) {
  const iconSize = { height: size, width: size };
  const iconScale = size / 36;

  return (
    <View style={[styles.iconShell, iconSize]}>
      <Canvas style={[styles.iconCanvas, iconSize]}>
        <Group transform={[{ scale: iconScale }]}>
          <RoundedRect x={1.2} y={1.2} width={33.6} height={33.6} r={7.8}>
          <RadialGradient
            c={vec(18, 13.68)}
            r={22.32}
            colors={['#0E2630', '#0D1117', '#0A0E14']}
            positions={[0, 0.55, 1]}
          />
        </RoundedRect>

        <Group color="rgba(0,188,212,0.18)">
          <Circle cx={6} cy={6} r={0.3} />
          <Circle cx={12} cy={6} r={0.3} />
          <Circle cx={24} cy={6} r={0.3} />
          <Circle cx={30} cy={6} r={0.3} />
          <Circle cx={6} cy={18} r={0.3} />
          <Circle cx={30} cy={18} r={0.3} />
          <Circle cx={6} cy={30} r={0.3} />
          <Circle cx={12} cy={30} r={0.3} />
          <Circle cx={24} cy={30} r={0.3} />
          <Circle cx={30} cy={30} r={0.3} />
        </Group>

        <Group strokeCap="round">
          <Line p1={vec(11.7, 12.6)} p2={vec(24.3, 12.6)} color="rgba(0,188,212,0.25)" strokeWidth={1.35} />
          <Line p1={vec(11.7, 12.6)} p2={vec(18, 25.2)} color="rgba(0,188,212,0.28)" strokeWidth={1.5} />
          <Line p1={vec(24.3, 12.6)} p2={vec(18, 25.2)} color="rgba(0,188,212,0.28)" strokeWidth={1.5} />
          <Line p1={vec(11.7, 12.6)} p2={vec(24.3, 12.6)} color="rgba(0,188,212,0.55)" strokeWidth={0.45} />
          <Line p1={vec(11.7, 12.6)} p2={vec(18, 25.2)} color="#00BCD4" strokeWidth={0.6} />
          <Line p1={vec(24.3, 12.6)} p2={vec(18, 25.2)} color="#00BCD4" strokeWidth={0.6} />
        </Group>

        <RoundedRect x={9.15} y={10.05} width={5.1} height={5.1} r={1.35} color="#0D1117" />
        <RoundedRect x={9.15} y={10.05} width={5.1} height={5.1} r={1.35} color="#00BCD4" style="stroke" strokeWidth={0.6} />
        <RoundedRect x={21.75} y={10.05} width={5.1} height={5.1} r={1.35} color="#0D1117" />
        <RoundedRect x={21.75} y={10.05} width={5.1} height={5.1} r={1.35} color="#00BCD4" style="stroke" strokeWidth={0.6} />
        <RoundedRect x={15.45} y={22.65} width={5.1} height={5.1} r={1.35} color="#0D1117" />
        <RoundedRect x={15.45} y={22.65} width={5.1} height={5.1} r={1.35} color="#FFD700" style="stroke" strokeWidth={0.6} />
        </Group>
      </Canvas>
    </View>
  );
}

export default function AppMenu({ compact = false }: AppMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;

  function animateIcon() {
    spinValue.setValue(0);
    Animated.timing(spinValue, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }

  function openMenu() {
    animateIcon();
    setIsOpen(true);
  }

  function closeMenu() {
    animateIcon();
    setIsOpen(false);
  }

  function navigate(route: MenuRoute) {
    closeMenu();
    router.push(route);
  }

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <>
      <TouchableOpacity
        accessibilityLabel="Open Void-Tech navigation menu"
        accessibilityRole="button"
        activeOpacity={0.78}
        onPress={openMenu}
        style={[styles.iconButton, compact && styles.compactButton]}
      >
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <AppIcon />
        </Animated.View>
      </TouchableOpacity>

      <Modal transparent visible={isOpen} animationType="fade" onRequestClose={closeMenu}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityLabel="Close navigation menu" style={styles.scrim} onPress={closeMenu} />
          <Animated.View style={styles.sidebar}>
            <View style={styles.sidebarHeader}>
              <AppIcon />
              <View style={styles.sidebarTitleGroup}>
                <Text style={styles.sidebarTitle}>Void-Tech</Text>
                <Text style={styles.sidebarSubtitle}>Station Console</Text>
              </View>
            </View>

            <View style={styles.menuList}>
              {MENU_ITEMS.map((item) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.76}
                  key={item.route}
                  onPress={() => navigate(item.route)}
                  style={styles.menuItem}
                >
                  <Text style={styles.menuItemLabel}>{item.label}</Text>
                  <Text style={styles.menuItemDescription}>{item.description}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity activeOpacity={0.76} onPress={() => navigate('/')} style={styles.returnButton}>
              <Text style={styles.returnButtonText}>Return to Factory</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
  compactButton: {
    minHeight: 38,
    minWidth: 38,
  },
  iconShell: {
    height: 36,
    width: 36,
  },
  iconCanvas: {
    height: 36,
    width: 36,
  },
  modalRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  scrim: {
    backgroundColor: 'rgba(1, 6, 12, 0.64)',
    flex: 1,
  },
  sidebar: {
    backgroundColor: '#0A0E14',
    borderLeftColor: '#20364A',
    borderLeftWidth: 1,
    elevation: 8,
    paddingBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 56,
    shadowColor: '#000',
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    width: 286,
  },
  sidebarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  sidebarTitleGroup: {
    flex: 1,
  },
  sidebarTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sidebarSubtitle: {
    color: '#7DDCE8',
    fontSize: 12,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  menuList: {
    gap: 12,
  },
  menuItem: {
    backgroundColor: '#101A26',
    borderColor: '#1C3B4C',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  menuItemLabel: {
    color: '#00BCD4',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  menuItemDescription: {
    color: '#C8D4E0',
    fontSize: 12,
    lineHeight: 17,
  },
  returnButton: {
    alignItems: 'center',
    borderColor: '#30465C',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 'auto',
    paddingVertical: 12,
  },
  returnButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
