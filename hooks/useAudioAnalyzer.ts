
import React, { useState, useEffect, useRef, useCallback } from 'react';

// 使用全局标识记录是否已连接，因为 createMediaElementSource 只能对同一个 HTMLAudioElement 调用一次
const connectedElements = new WeakSet<HTMLAudioElement>();

export const useAudioAnalyzer = (audioRef: React.RefObject<HTMLAudioElement | null>, isPlaying: boolean) => {
  const [audioIntensity, setAudioIntensity] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const initAnalyzer = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return null;
    
    // 如果已经存在实例且未关闭，复用它
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      return audioContextRef.current;
    }

    try {
      // 检查全局单例
      if ((window as any).audioContextInstance) {
        audioContextRef.current = (window as any).audioContextInstance;
        analyserRef.current = (window as any).analyserInstance;
        gainNodeRef.current = (window as any).gainNodeInstance;
        
        // 关键修复：即便 Context 存在，如果当前 audio 没连接过也要连接
        if (!connectedElements.has(audio)) {
          const source = audioContextRef.current.createMediaElementSource(audio);
          source.connect(analyserRef.current!);
          connectedElements.add(audio);
        }
        return audioContextRef.current;
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75; // 增加平滑度

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, ctx.currentTime);

      // 核心修复：防止 InvalidStateError
      if (!connectedElements.has(audio)) {
        const source = ctx.createMediaElementSource(audio);
        source.connect(analyser);
        connectedElements.add(audio);
      }
      
      analyser.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      gainNodeRef.current = gainNode;
      
      // 存储单例
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
    
    // 扩大采样范围（前 12 个频段涵盖了低音到中低音部分）
    let energy = 0; 
    const sampleRange = 12;
    for (let i = 0; i < sampleRange; i++) {
      const weight = i < 4 ? 1.5 : 1.0; // 极低频权重
      energy += dataArray[i] * weight;
    }
    
    const average = (energy / sampleRange) / 255;
    
    // 指数映射增强律动对比感
    const boostedIntensity = Math.pow(average, 1.4) * 2.2;
    
    setAudioIntensity(Math.min(boostedIntensity, 1.5));
    
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
