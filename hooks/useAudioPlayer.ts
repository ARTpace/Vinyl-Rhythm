
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
    
    // 核心优化 1：如果当前已经在播放这首歌，且没有暂停，不要重新加载 src 导致卡顿
    const isSameSource = track.url && audio.src === track.url;
    if (isSameSource && !audio.paused) {
      return; 
    }

    // 处理未解析的文件
    if (!track.url) {
      const resolved = await resolveTrackFile(track);
      if (!resolved || !resolved.url) {
        console.warn("无法定位物理文件，请尝试同步音乐库");
        return;
      }
      // 只有在 src 确实不同时才赋值
      if (audio.src !== resolved.url) {
        audio.src = resolved.url;
      }
    } else if (audio.src !== track.url) {
      audio.src = track.url;
    }

    try {
      let ctx = getAudioCtx();
      let gainNode = getGainNode();
      if (ctx && (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted')) {
        await ctx.resume();
      }
      
      // 如果不是同一首歌，或者已经停止了，才执行淡入
      if (!isSameSource || audio.paused) {
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
      }
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

  // 核心变更：监听列表变化并处理增删导致的索引偏移，确保不中断当前播放
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
      lastRecordedTrack.current = null;
      return;
    }

    // 尝试在新的列表中寻找原来正在播放的歌曲
    if (currentFingerprintRef.current) {
      const newIndex = tracks.findIndex(t => t.fingerprint === currentFingerprintRef.current);
      if (newIndex !== -1) {
        if (newIndex !== currentTrackIndex) {
          // 歌曲位置发生了变化（例如前面的歌被删了，或列表发生了重排）
          // 静默更新索引，由于 fingerprint 没变，不会触发下方的 playWithFade 重载逻辑
          setCurrentTrackIndex(newIndex);
        }
      } else {
        // 当前播放的歌本身被从队列中删除了
        if (currentTrackIndex !== null) {
          const nextIdx = Math.min(currentTrackIndex, tracks.length - 1);
          setCurrentTrackIndex(nextIdx);
          // 此时 index 指向了新歌曲，fingerprint 变化会触发下方的播放逻辑
        }
      }
    } else if (currentTrackIndex !== null && currentTrackIndex >= tracks.length) {
      setCurrentTrackIndex(tracks.length - 1);
    }
  }, [tracks]);

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

  // 精准监听当前播放歌曲的唯一标识变更。
  // 只有当标识（fingerprint）真正改变时，才触发重新加载和播放。
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
