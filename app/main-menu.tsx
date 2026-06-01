import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppMenu, { AppIcon } from '../src/components/AppMenu';

export default function MainMenuScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <AppMenu compact />
      </View>
      <View style={styles.content}>
        <AppIcon />
        <Text style={styles.title}>Main Menu</Text>
        <Text style={styles.body}>
          This is the start screen placeholder. The navigation item is wired now, so the full launch menu can be built here later.
        </Text>
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  title: { color: '#FFFFFF', fontSize: 34, fontWeight: '900', marginTop: 18 },
  body: { color: '#C8D4E0', fontSize: 15, lineHeight: 22, marginTop: 12, maxWidth: 360, textAlign: 'center' },
});
