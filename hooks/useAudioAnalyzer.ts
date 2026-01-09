
import { useState, useEffect, useRef, useCallback } from 'react';

export const useAudioAnalyzer = (audioRef: React.RefObject<HTMLAudioElement | null>, isPlaying: boolean) => {
  const [audioIntensity, setAudioIntensity] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const initAnalyzer = useCallback(() => {
    if (!audioRef.current) return null;
    
    if (audioContextRef.current) return audioContextRef.current;

    try {
      if ((window as any).audioContextInstance) {
        audioContextRef.current = (window as any).audioContextInstance;
        analyserRef.current = (window as any).analyserInstance;
        gainNodeRef.current = (window as any).gainNodeInstance;
        return audioContextRef.current;
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      // 创建 GainNode
      const gainNode = ctx.createGain();
      // 初始化时设为 0，防止爆音，等待播放器控制淡入
      gainNode.gain.setValueAtTime(0, ctx.currentTime);

      const source = ctx.createMediaElementSource(audioRef.current);
      
      // 链路: Source -> Analyser -> Gain -> Destination
      source.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      gainNodeRef.current = gainNode;
      
      (window as any).audioContextInstance = ctx;
      (window as any).analyserInstance = analyser;
      (window as any).gainNodeInstance = gainNode;
      
      return ctx;
    } catch (e) {
      console.warn("音频系统初始化失败:", e);
      return null;
    }
  }, [audioRef]);

  const updateIntensity = useCallback(() => {
    if (!analyserRef.current || !isPlaying) { 
      setAudioIntensity(0); 
      return; 
    }
    
    if (audioContextRef.current?.state === 'suspended') {
      setAudioIntensity(0);
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    let bass = 0; 
    for (let i = 0; i < 4; i++) bass += dataArray[i];
    
    const val = (bass / 4) / 255;
    setAudioIntensity(Math.pow(val, 1.2) * 1.8);
    
    animationFrameRef.current = requestAnimationFrame(updateIntensity);
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      initAnalyzer();
      animationFrameRef.current = requestAnimationFrame(updateIntensity);
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setAudioIntensity(0);
    }
    
    return () => { 
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); 
    };
  }, [isPlaying, updateIntensity, initAnalyzer]);

  return { audioIntensity, initAnalyzer };
};
