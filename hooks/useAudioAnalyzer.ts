
import { useState, useEffect, useRef, useCallback } from 'react';

export const useAudioAnalyzer = (audioRef: React.RefObject<HTMLAudioElement | null>, isPlaying: boolean) => {
  const [audioIntensity, setAudioIntensity] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const initAnalyzer = useCallback(() => {
    if (!audioRef.current) return;
    
    // 如果已经初始化过，直接返回
    if (audioContextRef.current) return audioContextRef.current;

    try {
      // 检查全局是否已有实例
      if ((window as any).audioContextInstance) {
        audioContextRef.current = (window as any).audioContextInstance;
        analyserRef.current = (window as any).analyserInstance;
        return audioContextRef.current;
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      
      // 关键：MediaElementSource 必须且只能创建一次
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      
      // 存储到 Ref 和全局环境
      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      (window as any).audioContextInstance = ctx;
      (window as any).analyserInstance = analyser;
      
      return ctx;
    } catch (e) {
      console.warn("频谱分析器初始化失败:", e);
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
