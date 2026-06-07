import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import MusicPlayer from '../src/components/MusicPlayer';

type RouterSplashScreen = typeof SplashScreen & {
  _internal_preventAutoHideAsync?: () => Promise<boolean>;
};

// Expo Router SDK 51 does not handle this promise when the iOS dev client has
// already replaced its initial view controller.
(SplashScreen as RouterSplashScreen)._internal_preventAutoHideAsync?.().catch((error: unknown) => {
  if (!(error instanceof Error && error.message.includes('No native splash screen registered for '))) {
    console.error(error);
  }
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <MusicPlayer />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
