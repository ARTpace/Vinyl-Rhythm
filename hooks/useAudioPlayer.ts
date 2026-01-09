
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

  const getGainNode = () => (window as any).gainNodeInstance as GainNode | undefined;
  const getAudioCtx = () => (window as any).audioContextInstance as AudioContext | undefined;

  /**
   * 物理渐变核心
   * @param target 目标音量 (0.0 - 1.0)
   * @param durationSec 渐变时长（秒）
   */
  const fadePhysicalVolume = useCallback((target: number, durationSec: number, onComplete?: () => void) => {
    const gainNode = getGainNode();
    const ctx = getAudioCtx();
    
    if (!gainNode || !ctx) {
      if (audioRef.current) audioRef.current.volume = target;
      onComplete?.();
      return;
    }

    const now = ctx.currentTime;
    
    // 关键修复 1: 先取消之前的所有调度，并立即“锚定”当前音量
    // setValueAtTime(gain.value, now) 告诉浏览器从这一刻、这个值开始变化
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    
    // 关键修复 2: 使用 linearRamp 渐变。注意：如果目标是 0，可以考虑 linearRamp
    gainNode.gain.linearRampToValueAtTime(target, now + durationSec);

    if (onComplete) {
      // 稍微多给 50ms 延迟，确保 Web Audio 线程完成处理
      setTimeout(onComplete, (durationSec * 1000) + 50);
    }
  }, []);

  const playWithFade = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    try {
      const ctx = getAudioCtx();
      const gainNode = getGainNode();

      // 确保上下文恢复
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
      }

      // 播放前确保物理层是静音的
      if (gainNode && ctx) {
        gainNode.gain.cancelScheduledValues(ctx.currentTime);
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
      }

      // HTML5 音频自身音量锁定为 1
      audio.volume = 1; 
      
      await audio.play();
      setIsPlaying(true);

      // 执行物理淡入
      fadePhysicalVolume(volume, 0.5);
    } catch (err) {
      console.error("播放失败:", err);
      setIsPlaying(false);
    }
  }, [volume, fadePhysicalVolume]);

  const pauseWithFade = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // 先物理淡出到 0，再暂停
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
    if (isPlaying) {
      fadePhysicalVolume(0, 0.3, () => {
        setCurrentTrackIndex(index);
      });
    } else {
      setCurrentTrackIndex(index);
    }
  }, [isPlaying, fadePhysicalVolume]);

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

  // 监听切歌后自动播放
  useEffect(() => {
    if (currentTrackIndex !== null && isPlaying) {
      playWithFade();
    }
  }, [currentTrackIndex]);

  // 当用户拖动 UI 上的音量滑块时
  useEffect(() => {
    const gainNode = getGainNode();
    const ctx = getAudioCtx();
    if (gainNode && ctx) {
      // 使用 setTargetAtTime 让音量调节更平滑，且不冲突
      gainNode.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
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
    };
  }, [playbackMode, nextTrack, isSeeking]);

  return {
    audioRef, currentTrackIndex, setCurrentTrackIndex: transitionToTrack, isPlaying, setIsPlaying,
    progress, setProgress, duration, setDuration, volume, setVolume,
    playbackMode, setPlaybackMode, nextTrack, prevTrack, seek, togglePlay
  };
};
