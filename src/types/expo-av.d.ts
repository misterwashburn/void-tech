declare module 'expo-av' {
  export namespace Audio {
    function setAudioModeAsync(mode: {
      allowsRecordingIOS?: boolean;
      playsInSilentModeIOS?: boolean;
      shouldDuckAndroid?: boolean;
      playThroughEarpieceAndroid?: boolean;
      staysActiveInBackground?: boolean;
    }): Promise<void>;

    class Sound {
      static createAsync(
        source: unknown,
        initialStatus?: {
          isLooping?: boolean;
          shouldPlay?: boolean;
          volume?: number;
        }
      ): Promise<{ sound: Sound }>;

      playAsync(): Promise<unknown>;
      setVolumeAsync(volume: number): Promise<unknown>;
      unloadAsync(): Promise<unknown>;
    }
  }
}
