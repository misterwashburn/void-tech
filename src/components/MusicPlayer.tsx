import { Audio } from 'expo-av';
import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';

const MUSIC_SOURCE = require('../../assets/music.mp3');

export default function MusicPlayer() {
  const musicVolume = useSettingsStore((s) => s.musicVolume);
  const soundRef = useRef<Audio.Sound | null>(null);
  const volumeRef = useRef(musicVolume);

  useEffect(() => {
    volumeRef.current = musicVolume;
  }, [musicVolume]);

  useEffect(() => {
    let isMounted = true;

    async function startMusic() {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync(MUSIC_SOURCE, {
        isLooping: true,
        shouldPlay: true,
        volume: volumeRef.current,
      });

      if (!isMounted) {
        await sound.unloadAsync();
        return;
      }

      soundRef.current = sound;
      await sound.setVolumeAsync(volumeRef.current);
      await sound.playAsync();
    }

    void startMusic();

    return () => {
      isMounted = false;
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) {
        void sound.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    const sound = soundRef.current;
    if (sound) {
      void sound.setVolumeAsync(musicVolume);
    }
  }, [musicVolume]);

  return null;
}
