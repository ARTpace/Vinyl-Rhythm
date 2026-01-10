
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
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoPlayRef = useRef(false);

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
    if (onComplete) setTimeout(onComplete, (durationSec * 1000) + 50);
  }, []);

  const playWithFade = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    
    // 检查当前曲目是否在逻辑上就不支持
    if (currentTrackIndex !== null && tracks[currentTrackIndex]?.isUnsupported) {
       setPlaybackError("浏览器无法直接播放此格式（如 DSD），请将其转换为 FLAC 或 WAV。");
       setIsPlaying(false);
       return;
    }

    try {
      let ctx = getAudioCtx();
      let gainNode = getGainNode();
      if (ctx && ctx.state === 'suspended') await ctx.resume();
      if (gainNode && ctx) {
        gainNode.gain.cancelScheduledValues(ctx.currentTime);
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
      }
      audio.volume = 1; 
      await audio.play();
      setPlaybackError(null);
      setIsPlaying(true);
      autoPlayRef.current = false;
      fadePhysicalVolume(volume, 0.5);
    } catch (err) {
      console.warn("播放失败:", err);
      // 如果错误是由于不支持源导致的
      if (audio.error?.code === 4) {
        setPlaybackError("播放器不支持此文件编码。");
      }
      setIsPlaying(false);
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
    if (isPlaying) pauseWithFade(); else playWithFade();
  }, [isPlaying, pauseWithFade, playWithFade]);

  const nextTrack = useCallback(() => {
    if (tracks.length === 0 || currentTrackIndex === null) return;
    let nextIdx = playbackMode === 'shuffle' ? Math.floor(Math.random() * tracks.length) : (currentTrackIndex + 1) % tracks.length;
    autoPlayRef.current = isPlaying;
    setPlaybackError(null);
    setCurrentTrackIndex(nextIdx);
  }, [tracks.length, currentTrackIndex, playbackMode, isPlaying]);

  const prevTrack = useCallback(() => {
    if (tracks.length === 0 || currentTrackIndex === null) return;
    const prevIdx = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    autoPlayRef.current = isPlaying;
    setPlaybackError(null);
    setCurrentTrackIndex(prevIdx);
  }, [tracks.length, currentTrackIndex, isPlaying]);

  const seek = useCallback((val: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setProgress(val);
      setIsSeeking(true);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => { if (!isSeeking) setProgress(audio.currentTime); };
    const handleLoadedMetadata = () => { setDuration(audio.duration); };
    const handleCanPlay = () => { if (autoPlayRef.current) playWithFade(); };
    const handleEnded = () => { if (playbackMode === 'loop') { audio.currentTime = 0; playWithFade(); } else nextTrack(); };
    const handleSeeked = () => { setIsSeeking(false); };
    const handleError = () => {
      setPlaybackError("音频加载失败：格式可能不受支持。");
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('seeked', handleSeeked);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('seeked', handleSeeked);
      audio.removeEventListener('error', handleError);
    };
  }, [isSeeking, playbackMode, nextTrack, playWithFade]);

  useEffect(() => {
    if (currentTrackIndex !== null && tracks[currentTrackIndex]) {
      const audio = audioRef.current;
      if (audio) {
        const track = tracks[currentTrackIndex];
        if (audio.src !== track.url) {
          audio.src = track.url;
          audio.load();
        }
      }
    }
  }, [currentTrackIndex, tracks]);

  return {
    currentTrackIndex, setCurrentTrackIndex, isPlaying, setIsPlaying,
    progress, duration, volume, setVolume, playbackMode, setPlaybackMode,
    audioRef, togglePlay, nextTrack, prevTrack, seek, playbackError
  };
};
