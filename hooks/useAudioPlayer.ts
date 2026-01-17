
import { useState, useEffect, useRef, useCallback } from 'react';
import { Track, PlaybackMode } from '../types';

export const useAudioPlayer = (
  tracks: Track[], 
  resolveTrackFile: (t: Track) => Promise<Track | null>,
  onTrackStart?: (track: Track) => void
) => {
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(() => {
    const saved = localStorage.getItem('vinyl_volume');
    return saved ? parseFloat(saved) : 0.8;
  });
  const volumeRef = useRef(volume);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('normal');
  const [isSeeking, setIsSeeking] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  // 同步当前播放曲目的唯一标识，用于在列表变动时追踪位置
  useEffect(() => {
    if (currentTrackIndex !== null && tracks[currentTrackIndex]) {
      currentFingerprintRef.current = tracks[currentTrackIndex].fingerprint;
    } else {
      currentFingerprintRef.current = null;
    }
  }, [currentTrackIndex, tracks]);

  const getGainNode = useCallback(() => (window as any).gainNodeInstance as GainNode | undefined, []);
  const getAudioCtx = useCallback(() => (window as any).audioContextInstance as AudioContext | undefined, []);

  const clampVolume = useCallback((val: number) => {
    if (!Number.isFinite(val)) return 0;
    return Math.min(1, Math.max(0, val));
  }, []);

  const setPhysicalVolumeImmediate = useCallback((target: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = clampVolume(target);
    const gainNode = getGainNode();
    const ctx = getAudioCtx();
    if (gainNode && ctx) {
      gainNode.gain.cancelScheduledValues(ctx.currentTime);
      gainNode.gain.setValueAtTime(next, ctx.currentTime);
      audio.volume = 1;
      return;
    }
    audio.volume = next;
  }, [clampVolume, getAudioCtx, getGainNode]);

  const setVolume = useCallback((val: number) => {
    const next = clampVolume(val);
    volumeRef.current = next;
    setVolumeState(next);
    localStorage.setItem('vinyl_volume', next.toString());
    setPhysicalVolumeImmediate(next);
  }, [clampVolume, setPhysicalVolumeImmediate]);

  const fadePhysicalVolume = useCallback((target: number, durationSec: number, onComplete?: () => void) => {
    const next = clampVolume(target);
    const gainNode = getGainNode();
    const ctx = getAudioCtx();
    if (!gainNode || !ctx) {
      if (audioRef.current) audioRef.current.volume = next;
      onComplete?.();
      return;
    }
    if (audioRef.current) audioRef.current.volume = 1;
    const now = ctx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(next, now + durationSec);
    if (onComplete) setTimeout(onComplete, (durationSec * 1000) + 50);
  }, [clampVolume, getAudioCtx, getGainNode]);

  const playWithFade = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || currentTrackIndex === null || tracks.length === 0) return;

    const track = tracks[currentTrackIndex];
    if (!track) return;

    let sourceUrl = track.url;
    if (!sourceUrl) {
      const resolved = await resolveTrackFile(track);
      if (!resolved || !resolved.url) {
        console.warn("无法定位物理文件");
        return;
      }
      sourceUrl = resolved.url;
    }

    try {
      let ctx = getAudioCtx();
      let gainNode = getGainNode();

      if (ctx && (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted')) {
        await ctx.resume();
      }

      const normalizeUrl = (u: string) => {
        try {
          return new URL(u).href;
        } catch {
          return u;
        }
      };

      const currentSrc = audio.currentSrc || audio.src || '';
      const normalizedCurrentSrc = normalizeUrl(currentSrc);
      const normalizedSourceUrl = normalizeUrl(sourceUrl);
      const isSameSource = !!currentSrc && normalizedCurrentSrc === normalizedSourceUrl;

      if (isSameSource && !audio.paused) {
        return;
      }

      if (!isSameSource) {
        audio.pause();
        audio.src = sourceUrl;
        audio.load();
        audio.currentTime = 0;
        setProgress(0);
        setDuration(0);
      }

      if (gainNode && ctx) {
        gainNode.gain.cancelScheduledValues(ctx.currentTime);
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
      }

      await audio.play();
      setIsPlaying(true);

      if (onTrackStart) {
        onTrackStart(track);
      }
      
      setTimeout(() => fadePhysicalVolume(volumeRef.current, 0.5), 50);
    } catch (err) {
      console.error("播放失败:", err);
    }
  }, [currentTrackIndex, fadePhysicalVolume, getAudioCtx, getGainNode, onTrackStart, resolveTrackFile, tracks]);

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
      if (currentTrackIndex === null && tracks.length > 0) {
        setCurrentTrackIndex(0);
        return;
      }
      playWithFade();
    }
  }, [isPlaying, pauseWithFade, playWithFade, currentTrackIndex, tracks.length]);

  const nextTrack = useCallback(() => {
    if (tracks.length === 0 || currentTrackIndex === null) return;
    const nextIdx = playbackMode === 'shuffle' 
      ? Math.floor(Math.random() * tracks.length) 
      : (currentTrackIndex + 1) % tracks.length;
    
    setProgress(0);
    setDuration(0);
    setCurrentTrackIndex(nextIdx);
    setIsPlaying(true);
  }, [tracks.length, currentTrackIndex, playbackMode]);

  const prevTrack = useCallback(() => {
    if (tracks.length === 0 || currentTrackIndex === null) return;
    const prevIdx = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    
    setProgress(0);
    setDuration(0);
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
    if (tracks.length === 0) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      setIsPlaying(false);
      setCurrentTrackIndex(null);
      setProgress(0);
      setDuration(0);
      return;
    }

    if (currentFingerprintRef.current) {
      const newIndex = tracks.findIndex(t => t.fingerprint === currentFingerprintRef.current);
      if (newIndex !== -1) {
        if (newIndex !== currentTrackIndex) {
          setCurrentTrackIndex(newIndex); 
        }
      } else {
        if (currentTrackIndex !== null) {
          const nextIdx = Math.min(currentTrackIndex, tracks.length - 1);
          setProgress(0);
          setDuration(0);
          setCurrentTrackIndex(nextIdx);
        }
      }
    }
  }, [tracks]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => { 
      if (!isDraggingProgress.current) {
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
      } else nextTrack(); 
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [playbackMode, nextTrack]);

  const isDraggingProgress = useRef(false);
  useEffect(() => {
    isDraggingProgress.current = isSeeking;
    if (!isSeeking) setIsSeeking(false); 
  }, [isSeeking]);

  const currentTrackFingerprint = currentTrackIndex !== null ? tracks[currentTrackIndex]?.fingerprint : null;

  useEffect(() => {
    if (currentTrackIndex !== null && isPlaying && tracks.length > 0) {
      playWithFade();
    }
  }, [currentTrackFingerprint, isPlaying, playWithFade]);

  return {
    currentTrackIndex, setCurrentTrackIndex, isPlaying, setIsPlaying,
    progress, duration, volume, setVolume, playbackMode, setPlaybackMode,
    audioRef, togglePlay, nextTrack, prevTrack, seek
  };
};
