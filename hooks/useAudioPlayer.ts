
import { useState, useEffect, useRef, useCallback } from 'react';
import { Track, PlaybackMode } from '../types';
import { addToHistory } from '../utils/storage';

export const useAudioPlayer = (tracks: Track[]) => {
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(() => {
    const saved = localStorage.getItem('vinyl_volume');
    return saved ? parseFloat(saved) : 0.8;
  });
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('normal');
  const [isSeeking, setIsSeeking] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastRecordedTrack = useRef<string | null>(null);

  const setVolume = useCallback((val: number) => {
    setVolumeState(val);
    localStorage.setItem('vinyl_volume', val.toString());
  }, []);

  const getGainNode = () => (window as any).gainNodeInstance as GainNode | undefined;
  const getAudioCtx = () => (window as any).audioContextInstance as AudioContext | undefined;

  const fadePhysicalVolume = useCallback((target: number, durationSec: number, onComplete?: () => void) => {
    const gainNode = getGainNode();
    const ctx = getAudioCtx();
    
    if (!gainNode || !ctx) {
      if (audioRef.current) audioRef.current.volume = target;
      onComplete?.();
      return;
    }

    const now = ctx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(target, now + durationSec);

    if (onComplete) {
      setTimeout(onComplete, (durationSec * 1000) + 50);
    }
  }, []);

  const playWithFade = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    
    try {
      let ctx = getAudioCtx();
      let gainNode = getGainNode();

      if (ctx && (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted')) {
        await ctx.resume();
      }

      if (gainNode && ctx) {
        gainNode.gain.cancelScheduledValues(ctx.currentTime);
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
      }

      audio.volume = 1; 
      await audio.play();
      setIsPlaying(true);

      // 记录到历史记录（如果是新曲目）
      const currentTrack = currentTrackIndex !== null ? tracks[currentTrackIndex] : null;
      if (currentTrack && currentTrack.fingerprint !== lastRecordedTrack.current) {
        addToHistory(currentTrack);
        lastRecordedTrack.current = currentTrack.fingerprint;
      }

      setTimeout(() => {
        fadePhysicalVolume(volume, 0.5);
      }, 50);
      
    } catch (err) {
      console.error("播放请求失败:", err);
      if (audio.readyState === 0) {
        audio.load();
      }
    }
  }, [volume, fadePhysicalVolume, currentTrackIndex, tracks]);

  const pauseWithFade = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    fadePhysicalVolume(0, 0.4, () => {
      audio.pause();
      setIsPlaying(false);
    });
  }, [fadePhysicalVolume]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pauseWithFade();
    } else {
      playWithFade();
    }
  }, [isPlaying, pauseWithFade, playWithFade]);

  const transitionToTrack = useCallback((index: number) => {
    if (currentTrackIndex === index) {
      setIsPlaying(true);
      playWithFade();
      return;
    }

    if (isPlaying) {
      fadePhysicalVolume(0, 0.3, () => {
        setCurrentTrackIndex(index);
        setIsPlaying(true);
      });
    } else {
      setCurrentTrackIndex(index);
      setIsPlaying(true);
    }
  }, [isPlaying, currentTrackIndex, fadePhysicalVolume, playWithFade]);

  const nextTrack = useCallback(() => {
    if (tracks.length === 0 || currentTrackIndex === null) return;
    let nextIdx;
    if (playbackMode === 'shuffle') {
      nextIdx = Math.floor(Math.random() * tracks.length);
    } else {
      nextIdx = (currentTrackIndex + 1) % tracks.length;
    }
    transitionToTrack(nextIdx);
  }, [tracks.length, currentTrackIndex, transitionToTrack, playbackMode]);

  const prevTrack = useCallback(() => {
    if (tracks.length === 0 || currentTrackIndex === null) return;
    const prevIdx = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    transitionToTrack(prevIdx);
  }, [tracks.length, currentTrackIndex, transitionToTrack]);

  const seek = useCallback((val: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setProgress(val);
      setIsSeeking(true);
    }
  }, []);

  useEffect(() => {
    const gainNode = getGainNode();
    const ctx = getAudioCtx();
    if (gainNode && ctx && isPlaying) {
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    } else if (audioRef.current && !gainNode) {
      audioRef.current.volume = volume;
    }
  }, [volume, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isSeeking) {
        setProgress(audio.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      if (playbackMode === 'loop') {
        audio.currentTime = 0;
        audio.play();
      } else {
        nextTrack();
      }
    };

    const handleSeeked = () => {
      setIsSeeking(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('seeked', handleSeeked);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('seeked', handleSeeked);
    };
  }, [isSeeking, playbackMode, nextTrack]);

  useEffect(() => {
    if (currentTrackIndex !== null && tracks[currentTrackIndex]) {
      const audio = audioRef.current;
      if (audio) {
        const nextSrc = tracks[currentTrackIndex].url;
        if (audio.src !== nextSrc) {
          audio.src = nextSrc;
          audio.load();
        }
        if (isPlaying && audio.paused) {
          playWithFade();
        }
      }
    }
  }, [currentTrackIndex, tracks, isPlaying, playWithFade]);

  return {
    currentTrackIndex,
    setCurrentTrackIndex,
    isPlaying,
    setIsPlaying,
    progress,
    duration,
    volume,
    setVolume,
    playbackMode,
    setPlaybackMode,
    audioRef,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    playWithFade,
    pauseWithFade
  };
};
