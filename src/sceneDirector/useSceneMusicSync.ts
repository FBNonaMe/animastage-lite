import { useEffect, useRef } from 'react';
import type { AppState } from '../types';
import { MMD_FPS } from '../utils/playhead';

/**
 * Keeps optional Director music track aligned with timeline playhead.
 */
export function useSceneMusicSync(appState: AppState): void {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const music = appState.sceneDirector?.music;

  useEffect(() => {
    if (!music?.blobUrl) {
      audioRef.current?.pause();
      audioRef.current = null;
      return;
    }

    let audio = audioRef.current;
    if (!audio || audio.src !== music.blobUrl) {
      audio?.pause();
      audio = new Audio(music.blobUrl);
      audio.loop = music.loop;
      audio.volume = music.volume;
      audioRef.current = audio;
    }

    audio.loop = music.loop;
    audio.volume = music.volume;

    return () => {
      audio.pause();
    };
  }, [music?.blobUrl, music?.loop, music?.volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !music?.enabled || !music.blobUrl) {
      audioRef.current?.pause();
      return;
    }

    const targetSec = appState.currentFrame / MMD_FPS + music.offsetSec;

    if (appState.isPlaying) {
      if (audio.paused) {
        audio.currentTime = Math.max(0, targetSec);
        void audio.play().catch(() => undefined);
      } else {
        const drift = Math.abs(audio.currentTime - targetSec);
        if (drift > 0.25) audio.currentTime = Math.max(0, targetSec);
      }
    } else {
      audio.pause();
      audio.currentTime = Math.max(0, targetSec);
    }
  }, [
    appState.currentFrame,
    appState.isPlaying,
    music?.enabled,
    music?.blobUrl,
    music?.offsetSec,
  ]);
}
