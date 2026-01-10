
import { useState, useEffect, useRef, useCallback } from 'react';
import { Track, PlaybackMode } from '../types';
import { addToHistory } from '../utils/storage';

export const useAudioPlayer = (tracks: Track[], resolveTrackFile: (t: Track) => Promise<Track | null>) => {
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
    if (onComplete) setTimeout(onComplete, (durationSec * 1000) + 50);
  }, []);

  const playWithFade = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || currentTrackIndex === null) return;
    
    const track = tracks[currentTrackIndex];
    
    // 核心优化：播放前才去解析文件对象
    if (!track.url) {
      const resolved = await resolveTrackFile(track);
      if (!resolved || !resolved.url) {
        console.warn("无法定位物理文件，请尝试同步音乐库");
        return;
      }
      audio.src = resolved.url;
    } else if (audio.src !== track.url) {
      audio.src = track.url;
    }

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
      
      await audio.play();
      setIsPlaying(true);
      
      if (track.fingerprint !== lastRecordedTrack.current) {
        addToHistory(track);
        lastRecordedTrack.current = track.fingerprint;
      }
      
      setTimeout(() => fadePhysicalVolume(volume, 0.5), 50);
    } catch (err) {
      console.error("播放失败:", err);
    }
  }, [volume, fadePhysicalVolume, currentTrackIndex, tracks, resolveTrackFile]);

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
    const nextIdx = playbackMode === 'shuffle' 
      ? Math.floor(Math.random() * tracks.length) 
      : (currentTrackIndex + 1) % tracks.length;
    setCurrentTrackIndex(nextIdx);
    setIsPlaying(true);
  }, [tracks.length, currentTrackIndex, playbackMode]);

  const prevTrack = useCallback(() => {
    if (tracks.length === 0 || currentTrackIndex === null) return;
    const prevIdx = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    setCurrentTrackIndex(prevIdx);
    setIsPlaying(true);
  }, [tracks.length, currentTrackIndex]);

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
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => { if (playbackMode === 'loop') { audio.currentTime = 0; audio.play(); } else nextTrack(); };
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [isSeeking, playbackMode, nextTrack]);

  useEffect(() => {
    if (currentTrackIndex !== null && isPlaying) {
      playWithFade();
    }
  }, [currentTrackIndex, isPlaying, playWithFade]);

  return {
    currentTrackIndex, setCurrentTrackIndex, isPlaying, setIsPlaying,
    progress, duration, volume, setVolume, playbackMode, setPlaybackMode,
    audioRef, togglePlay, nextTrack, prevTrack, seek
  };
};
