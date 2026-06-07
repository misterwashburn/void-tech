import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppMenu from '../src/components/AppMenu';
import { MATERIALS } from '../src/data/materials';
import { POWER_TIERS, getDefaultPowerRequirement } from '../src/data/power';
import { RECIPES } from '../src/data/recipes';
import { VOID_TYPES } from '../src/data/progression';
import { NodeType } from '../src/types';

const STRUCTURES: Array<{ type: NodeType; name: string; role: string }> = [
  { type: 'POWER_GENERATOR', name: 'Power Generator', role: 'Produces station energy and feeds powered structures.' },
  { type: 'HARVESTER', name: 'Void Harvester', role: 'Extracts baseline void resources from the field.' },
  { type: 'REFINER', name: 'Resolver', role: 'Transforms raw inputs into stronger industrial materials.' },
  { type: 'ASSEMBLER', name: 'Assembler', role: 'Combines multiple materials into advanced components.' },
  { type: 'STORAGE', name: 'Storage', role: 'Buffers materials so production spikes do not stall lines.' },
  { type: 'MERGE_UNIT', name: 'Merge Unit', role: 'Combines matching transported material into one line.' },
  { type: 'SPLIT_UNIT', name: 'Split Unit', role: 'Divides matching transported material across multiple lines.' },
  { type: 'SINK', name: 'Sink', role: 'Consumes delivered outputs and advances station objectives.' },
  { type: 'RELAY', name: 'Relay', role: 'Handles Earth communication and future progression systems.' },
  { type: 'FEEDBACK_REGULATOR', name: 'Feedback Regulator', role: 'Future high-tier stabilizer for volatile feedback loops.' },
];

function formatMaterialId(id: string) {
  return MATERIALS[id]?.name ?? id.replace(/_/g, ' ');
}

function formatRates(items: Array<{ materialId: string; ratePerSecond: number }>) {
  return items.map((item) => `${formatMaterialId(item.materialId)} ${item.ratePerSecond}/s`).join(', ');
}

export default function GuideScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <AppMenu compact />
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Appendix</Text>
          <Text style={styles.title}>Guide</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Structures</Text>
        {STRUCTURES.map((structure) => (
          <View key={structure.type} style={styles.card}>
            <Text style={styles.cardTitle}>{structure.name}</Text>
            <Text style={styles.cardMeta}>{structure.type} · {getDefaultPowerRequirement(structure.type)} MW draw</Text>
            <Text style={styles.body}>{structure.role}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Materials</Text>
        {Object.values(MATERIALS).map((material) => (
          <View key={material.id} style={styles.card}>
            <Text style={styles.cardTitle}>{material.name}</Text>
            <Text style={styles.cardMeta}>{material.id}</Text>
            <Text style={styles.body}>
              {material.isVolatile
                ? `Volatile material. Trigger: ${material.volatilityTrigger.toLowerCase()}.`
                : 'Stable material with no volatility trigger.'}
            </Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Recipes</Text>
        {Object.entries(RECIPES).map(([id, recipe]) => (
          <View key={id} style={styles.card}>
            <Text style={styles.cardTitle}>{id.replace(/_/g, ' ')}</Text>
            <Text style={styles.cardMeta}>{recipe.nodeType ?? 'Universal'} · {recipe.energyCost} MW</Text>
            <Text style={styles.body}>Inputs: {recipe.inputs.length ? formatRates(recipe.inputs) : 'none'}</Text>
            <Text style={styles.body}>Outputs: {formatRates(recipe.outputs)}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Power Tiers</Text>
        {POWER_TIERS.map((tier) => (
          <View key={tier.tier} style={styles.card}>
            <Text style={styles.cardTitle}>T{tier.tier} {tier.name}</Text>
            <Text style={styles.body}>{tier.powerOutput} MW output · {tier.maxTransferRate} MW max transfer</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Void Types</Text>
        {VOID_TYPES.map((voidType) => (
          <View key={voidType.id} style={styles.card}>
            <Text style={styles.cardTitle}>T{voidType.tier} {voidType.name}</Text>
            <Text style={styles.cardMeta}>{voidType.baseType} · Codename: {voidType.codename}</Text>
            <Text style={styles.body}>{voidType.discoverySummary}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#0D1117', flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomColor: '#1C2733',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerCopy: { flex: 1 },
  kicker: { color: '#7DDCE8', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  content: { gap: 12, padding: 16, paddingBottom: 32 },
  sectionTitle: { color: '#00BCD4', fontSize: 19, fontWeight: '900', marginTop: 8 },
  card: {
    backgroundColor: '#101A26',
    borderColor: '#1C3B4C',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  cardTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', textTransform: 'capitalize' },
  cardMeta: { color: '#7DDCE8', fontSize: 12, marginTop: 4 },
  body: { color: '#C8D4E0', fontSize: 13, lineHeight: 19, marginTop: 8 },
});
