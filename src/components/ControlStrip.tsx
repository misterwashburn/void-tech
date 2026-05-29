import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFactoryStore } from '../store/useFactoryStore';

export default function ControlStrip() {
  const availableEnergy = useFactoryStore((s) => s.availableEnergy);
  const consumedEnergy  = useFactoryStore((s) => s.consumedEnergy);
  const netEnergy = availableEnergy - consumedEnergy;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.row}>
        <Text style={styles.title}>VOID-TECH</Text>
        <Text style={styles.energy}>⚡ {netEnergy.toFixed(1)} GJ</Text>
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
  title: { color: '#00BCD4', fontSize: 16, fontWeight: 'bold', letterSpacing: 2 },
  energy: { color: '#FFFFFF', fontSize: 13 },
});
