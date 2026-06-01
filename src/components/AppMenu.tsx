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
    description: 'Return to the start screen placeholder.',
    route: '/main-menu',
  },
  {
    label: 'Stats',
    description: 'Fun factory-wide numbers tracked across plays.',
    route: '/stats',
  },
];

export function AppIcon() {
  return (
    <View style={styles.iconShell}>
      <View style={styles.iconCore}>
        <Text style={styles.iconGlyph}>V</Text>
      </View>
      <View style={[styles.iconOrbit, styles.iconOrbitTop]} />
      <View style={[styles.iconOrbit, styles.iconOrbitBottom]} />
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
    alignItems: 'center',
    backgroundColor: '#101A26',
    borderColor: '#00BCD4',
    borderRadius: 16,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 36,
  },
  iconCore: {
    alignItems: 'center',
    backgroundColor: '#00BCD4',
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  iconGlyph: {
    color: '#071018',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 16,
  },
  iconOrbit: {
    backgroundColor: '#9AF6FF',
    height: 2,
    opacity: 0.72,
    position: 'absolute',
    width: 30,
  },
  iconOrbitTop: {
    transform: [{ rotate: '31deg' }],
  },
  iconOrbitBottom: {
    transform: [{ rotate: '-31deg' }],
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
