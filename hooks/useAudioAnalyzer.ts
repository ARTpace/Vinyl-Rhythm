
// 修复: 导入 React 模块以支持 React.RefObject 命名空间的使用
import React, { useState, useEffect, useRef, useCallback } from 'react';

// 使用全局标识记录是否已连接
const connectedElements = new WeakSet<HTMLAudioElement>();

export const useAudioAnalyzer = (audioRef: React.RefObject<HTMLAudioElement | null>, isPlaying: boolean) => {
  const [audioIntensity, setAudioIntensity] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // 灵敏度控制参数
  const lastIntensity = useRef(0);
  const movingAverage = useRef(0.1); // 动态音量基准

  const initAnalyzer = useCallback((initialVolume?: number) => {
    const audio = audioRef.current;
    if (!audio) return null;
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      return audioContextRef.current;
    }

    try {
      if ((window as any).audioContextInstance) {
        audioContextRef.current = (window as any).audioContextInstance;
        analyserRef.current = (window as any).analyserInstance;
        gainNodeRef.current = (window as any).gainNodeInstance;
        
        if (!connectedElements.has(audio)) {
          const source = audioContextRef.current!.createMediaElementSource(audio);
          source.connect(analyserRef.current!);
          connectedElements.add(audio);
        }
        return audioContextRef.current;
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      
      const analyser = ctx.createAnalyser();
      // fftSize 保持 256 提供足够频段参考
      analyser.fftSize = 256; 
      // 增加平滑常数 (从 0.5 提高到 0.7)，让波形更平缓
      analyser.smoothingTimeConstant = 0.7;

      const gainNode = ctx.createGain();
      const startVol = (initialVolume !== undefined) ? initialVolume : 0.8;
      gainNode.gain.setValueAtTime(startVol, ctx.currentTime);

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
    
    // 分析低频段
    let energy = 0; 
    const sampleRange = 4; 
    for (let i = 0; i < sampleRange; i++) {
      energy += dataArray[i];
    }
    
    const currentRaw = (energy / sampleRange) / 255;
    
    // 稍微放慢基准能量的更新速度，使对比度更持久
    movingAverage.current = movingAverage.current * 0.99 + currentRaw * 0.01;
    
    // 冲击力计算
    let impact = Math.max(0, currentRaw - movingAverage.current * 0.75);
    
    // 减弱指数幂次 (从 1.5 降到 1.2)，使亮暗过渡不再那么剧烈
    let targetIntensity = Math.pow(impact * 2.2, 1.2);
    
    // 显著减慢衰减速度 (从 0.85 提高到 0.92)，产生“呼吸感”
    if (targetIntensity > lastIntensity.current) {
      // 上升阶段也增加一点平滑
      lastIntensity.current = lastIntensity.current * 0.3 + targetIntensity * 0.7;
    } else {
      lastIntensity.current *= 0.92; 
    }

    const finalValue = Math.min(lastIntensity.current, 1.2);
    setAudioIntensity(finalValue > 0.02 ? finalValue : 0);
    
    animationFrameRef.current = requestAnimationFrame(updateIntensity);
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      const savedVol = parseFloat(localStorage.getItem('vinyl_volume') || '0.8');
      initAnalyzer(savedVol);
      animationFrameRef.current = requestAnimationFrame(updateIntensity);
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setAudioIntensity(0);
      lastIntensity.current = 0;
    }
    
    return () => { 
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); 
    };
  }, [isPlaying, updateIntensity, initAnalyzer]);

  return { audioIntensity, initAnalyzer };
};
