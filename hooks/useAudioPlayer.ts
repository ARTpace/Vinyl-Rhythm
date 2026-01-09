
import { useState, useEffect, useRef, useCallback } from 'react';
import { Track, PlaybackMode } from '../types';

export const useAudioPlayer = (tracks: Track[]) => {
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('normal');
  const [isSeeking, setIsSeeking] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRequestIdRef = useRef<number | null>(null);

  const clearFade = useCallback(() => {
    if (fadeRequestIdRef.current !== null) {
      cancelAnimationFrame(fadeRequestIdRef.current);
      fadeRequestIdRef.current = null;
    }
  }, []);

  // 使用 requestAnimationFrame 实现更丝滑的音量渐变
  const fadeVolume = useCallback((target: number, durationMs: number, onComplete?: () => void) => {
    clearFade();
    const audio = audioRef.current;
    if (!audio) return;

    const startVol = audio.volume;
    const startTime = performance.now();

    const update = (now: number) => {
      const elapsed = now - startTime;
      const p = Math.min(elapsed / durationMs, 1);
      
      // 设置音量
      audio.volume = startVol + (target - startVol) * p;

      if (p < 1) {
        fadeRequestIdRef.current = requestAnimationFrame(update);
      } else {
        audio.volume = target;
        fadeRequestIdRef.current = null;
        onComplete?.();
      }
    };

    fadeRequestIdRef.current = requestAnimationFrame(update);
  }, [clearFade]);

  const playWithFade = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    try {
      // 如果当前是静音或暂停状态，从0开始淡入
      if (audio.paused || audio.volume < 0.05) {
        audio.volume = 0;
      }
      
      await audio.play();
      setIsPlaying(true);
      fadeVolume(volume, 400);
    } catch (err) {
      console.error("播放请求被拦截:", err);
      setIsPlaying(false);
    }
  }, [volume, fadeVolume]);

  const pauseWithFade = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    fadeVolume(0, 300, () => {
      audio.pause();
      setIsPlaying(false);
    });
  }, [fadeVolume]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    // 关键修复：在用户交互的第一时间恢复 AudioContext
    const ctx = (window as any).audioContextInstance;
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (isPlaying) {
      pauseWithFade();
    } else {
      playWithFade();
    }
  }, [isPlaying, pauseWithFade, playWithFade]);

  const transitionToTrack = useCallback((index: number) => {
    if (isPlaying) {
      fadeVolume(0, 200, () => {
        setCurrentTrackIndex(index);
      });
    } else {
      setCurrentTrackIndex(index);
    }
  }, [isPlaying, fadeVolume]);

  const nextTrack = useCallback(() => {
    if (tracks.length === 0 || currentTrackIndex === null) return;
    const nextIdx = (currentTrackIndex + 1) % tracks.length;
    transitionToTrack(nextIdx);
  }, [tracks.length, currentTrackIndex, transitionToTrack]);

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
      setTimeout(() => setIsSeeking(false), 500);
    }
  }, []);

  // 处理切歌后的自动播放
  useEffect(() => {
    if (currentTrackIndex !== null && isPlaying) {
      playWithFade();
    }
  }, [currentTrackIndex]);

  // 响应手动音量调节（仅当不在执行渐变时）
  useEffect(() => {
    if (audioRef.current && fadeRequestIdRef.current === null) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isSeeking) setProgress(audio.currentTime);
    };
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      if (playbackMode === 'loop') {
        audio.currentTime = 0;
        audio.play();
      } else {
        nextTrack();
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      clearFade();
    };
  }, [playbackMode, nextTrack, isSeeking, clearFade]);

  return {
    audioRef, currentTrackIndex, setCurrentTrackIndex: transitionToTrack, isPlaying, setIsPlaying,
    progress, setProgress, duration, setDuration, volume, setVolume,
    playbackMode, setPlaybackMode, nextTrack, prevTrack, seek, togglePlay
  };
};
