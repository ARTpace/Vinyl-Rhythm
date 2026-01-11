
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
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('normal');
  const [isSeeking, setIsSeeking] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentFingerprintRef = useRef<string | null>(null);

  // 同步当前播放曲目的唯一标识，用于在列表变动时追踪位置
  useEffect(() => {
    if (currentTrackIndex !== null && tracks[currentTrackIndex]) {
      currentFingerprintRef.current = tracks[currentTrackIndex].fingerprint;
    } else {
      currentFingerprintRef.current = null;
    }
  }, [currentTrackIndex, tracks]);

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
    if (!audio || currentTrackIndex === null || tracks.length === 0) return;
    
    const track = tracks[currentTrackIndex];
    if (!track) return;
    
    // 检查是否是同一首歌
    const isSameSource = track.url && audio.src === track.url;
    if (isSameSource && !audio.paused) {
      return; 
    }

    // 处理路径解析
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
      
      // 切歌时的物理重置
      if (audio.src !== sourceUrl) {
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
      
      // 通知外部记录历史
      if (onTrackStart) {
        onTrackStart(track);
      }
      
      setTimeout(() => fadePhysicalVolume(volume, 0.5), 50);
    } catch (err) {
      console.error("播放失败:", err);
    }
  }, [volume, fadePhysicalVolume, currentTrackIndex, tracks, resolveTrackFile, onTrackStart]);

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
