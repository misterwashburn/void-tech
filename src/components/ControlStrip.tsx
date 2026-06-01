import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AppMenu from './AppMenu';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFactoryStore } from '../store/useFactoryStore';

export default function ControlStrip() {
  const availableEnergy = useFactoryStore((s) => s.availableEnergy);
  const consumedEnergy  = useFactoryStore((s) => s.consumedEnergy);
  const netEnergy = availableEnergy - consumedEnergy;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.row}>
        <AppMenu />
        <Text style={styles.energy}>⚡ {netEnergy.toFixed(1)} MW ({consumedEnergy.toFixed(1)} / {availableEnergy.toFixed(1)})</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#0A0E14' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1C2733',
  },
  energy: { color: '#FFFFFF', fontSize: 13 },
});
