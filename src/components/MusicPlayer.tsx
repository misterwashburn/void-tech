import { Audio } from 'expo-av';
import Constants from 'expo-constants';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useSettingsStore } from '../store/useSettingsStore';

const MUSIC_SOURCE = require('../../assets/music.mp3');
const VOLUME_UPDATE_INTERVAL_MS = 60;
const VOLUME_EPSILON = 0.001;
const SHOULD_PLAY_MUSIC = !(Platform.OS === 'ios' && !Constants.isDevice);

export default function MusicPlayer() {
  const musicVolume = useSettingsStore((s) => s.musicVolume);
  const soundRef = useRef<Audio.Sound | null>(null);
  const volumeRef = useRef(musicVolume);
  const appliedVolumeRef = useRef(musicVolume);
  const isApplyingVolumeRef = useRef(false);
  const lastVolumeUpdateAtRef = useRef(0);
  const volumeUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearScheduledVolumeUpdate() {
    if (volumeUpdateTimeoutRef.current) {
      clearTimeout(volumeUpdateTimeoutRef.current);
      volumeUpdateTimeoutRef.current = null;
    }
  }

  async function applyLatestVolume() {
    if (isApplyingVolumeRef.current) {
      return;
    }

    const sound = soundRef.current;
    if (!sound) {
      return;
    }

    const nextVolume = volumeRef.current;
    if (Math.abs(appliedVolumeRef.current - nextVolume) < VOLUME_EPSILON) {
      return;
    }

    isApplyingVolumeRef.current = true;
    lastVolumeUpdateAtRef.current = Date.now();

    try {
      await sound.setVolumeAsync(nextVolume);
      appliedVolumeRef.current = nextVolume;
    } catch {
      return;
    } finally {
      isApplyingVolumeRef.current = false;
    }

    if (soundRef.current && Math.abs(appliedVolumeRef.current - volumeRef.current) >= VOLUME_EPSILON) {
      scheduleVolumeUpdate();
    }
  }

  function scheduleVolumeUpdate(immediate = false) {
    if (!soundRef.current || volumeUpdateTimeoutRef.current) {
      return;
    }

    const elapsed = Date.now() - lastVolumeUpdateAtRef.current;
    const delay = immediate ? 0 : Math.max(0, VOLUME_UPDATE_INTERVAL_MS - elapsed);

    volumeUpdateTimeoutRef.current = setTimeout(() => {
      volumeUpdateTimeoutRef.current = null;
      void applyLatestVolume();
    }, delay);
  }

  useEffect(() => {
    volumeRef.current = musicVolume;
    scheduleVolumeUpdate();
  }, [musicVolume]);

  useEffect(() => {
    let isMounted = true;

    async function startMusic() {
      if (!SHOULD_PLAY_MUSIC) {
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      const initialVolume = volumeRef.current;
      const { sound } = await Audio.Sound.createAsync(MUSIC_SOURCE, {
        isLooping: true,
        shouldPlay: true,
        volume: initialVolume,
      });

      if (!isMounted) {
        await sound.unloadAsync();
        return;
      }

      soundRef.current = sound;
      appliedVolumeRef.current = initialVolume;
      scheduleVolumeUpdate(true);
      await sound.playAsync();
    }

    void startMusic();

    return () => {
      isMounted = false;
      clearScheduledVolumeUpdate();
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) {
        void sound.unloadAsync();
      }
    };
  }, []);

  return null;
}
