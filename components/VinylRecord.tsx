
import React, { useMemo } from 'react';

interface VinylRecordProps {
  isPlaying: boolean;
  coverUrl?: string;
  intensity?: number;
  progress?: number;
  themeColor?: string; // 接收格式如 "rgba(r, g, b, 1)"
}

const VinylRecord: React.FC<VinylRecordProps> = ({ 
  isPlaying, 
  coverUrl, 
  intensity = 0, 
  progress = 0,
  themeColor = 'rgba(234, 179, 8, 1)'
}) => {
  // 生成随机粒子属性
  const particles = useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      delay: `${Math.random() * 5}s`,
      duration: `${2 + Math.random() * 3}s`,
      translateX: `${(Math.random() - 0.5) * 200}px`,
      left: `${20 + Math.random() * 60}%`,
      size: `${2 + Math.random() * 4}px`,
      baseOpacity: 0.1 + Math.random() * 0.4
    }));
  }, []);

  // --- 视觉参数优化：收紧范围，增强跳动感 ---
  // 唱片主体缩放（泵感）：基础 1.0 -> 峰值 1.05
  const recordScale = isPlaying ? 1 + intensity * 0.05 : 0.98;
  
  // 光晕收紧：以前是 1.25，现在收缩到 1.1 左右，使其贴合唱片
  const auraScale = 0.9 + intensity * 0.4; 
  const auraOpacity = isPlaying ? (0.1 + intensity * 0.8) : 0;
  
  // 波纹扩散范围：随律动变化
  const waveScale = 1.0 + intensity * 0.8;
  const waveOpacity = 0.05 + intensity * 0.5;

  const startAngle = 20;
  const endAngle = 36;
  const currentAngle = isPlaying ? startAngle + (progress * (endAngle - startAngle)) : 0;

  // 辅助函数：根据 themeColor 生成不同透明度的颜色
  const getGlowColor = (alpha: number) => {
    return themeColor.replace(/rgba?\((\d+),\s*(\d+ death?|(\d+)),\s*(\d+)(?:,\s*[\d.]+)?\)/, `rgba($1, $2, $4, ${alpha})`)
                     .replace(/rgb\((\d+),\s*(\d+ death?|(\d+)),\s*(\d+)\)/, `rgba($1, $2, $4, ${alpha})`);
  };

  return (
    <div className="relative flex items-center justify-center w-72 h-72 md:w-96 md:h-96 flex-shrink-0 aspect-square group transition-transform duration-75 ease-out"
         style={{ transform: `scale(${recordScale})` }}>
      
      {/* 粒子系统层 */}
      {isPlaying && (
        <div className="absolute inset-0 pointer-events-none z-0">
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute animate-particle rounded-full blur-[1px] transition-opacity duration-300 pointer-events-none"
              style={{
                left: p.left,
                bottom: '40%',
                width: p.size,
                height: p.size,
                backgroundColor: themeColor,
                opacity: p.baseOpacity + intensity * 1.5,
                boxShadow: `0 0 15px ${themeColor}`,
                '--particle-delay': p.delay,
                '--particle-duration': p.duration,
                '--tw-translate-x': p.translateX,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      {/* 紧致背景光晕 - 范围减小，亮度随律动大幅变化 */}
      <div 
        className="absolute inset-[-10%] rounded-full blur-[60px] transition-all duration-75 ease-out pointer-events-none"
        style={{ 
          transform: `scale(${auraScale})`,
          opacity: Math.min(0.9, auraOpacity),
          backgroundColor: themeColor,
          boxShadow: `0 0 ${40 + intensity * 100}px ${themeColor}`
        }}
      />

      {/* 扩散波纹环 */}
      {isPlaying && (
        <div 
            className="absolute inset-0 rounded-full border-2 animate-wave-spread pointer-events-none" 
            style={{ 
                borderColor: themeColor,
                opacity: waveOpacity,
                '--tw-scale-to': waveScale 
            } as any} 
        />
      )}

      {/* 唱片主体 */}
      <div className={`
        relative w-full h-full rounded-full vinyl-texture shadow-[0_0_80px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(255,255,255,0.05)] border-[12px] border-[#161616]
        flex items-center justify-center transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1)
        ${isPlaying ? 'animate-spin-slow' : ''}
      `}>
        {/* 纹理圈 */}
        <div className="absolute inset-4 rounded-full border border-white/5 pointer-events-none"></div>
        <div className="absolute inset-12 rounded-full border border-white/10 pointer-events-none opacity-30"></div>
        
        {/* 中心标签 */}
        <div className="relative w-1/3 h-1/3 rounded-full bg-[#111] shadow-inner flex items-center justify-center overflow-hidden border-4 border-zinc-900 z-10">
          {coverUrl ? (
            <img 
              src={coverUrl} 
              alt="Cover" 
              className={`w-full h-full object-cover transition-all duration-1000 ${isPlaying ? 'opacity-90 scale-105' : 'opacity-60 scale-100'}`} 
            />
          ) : (
            <div className="flex flex-col items-center">
                <div className="font-black text-[10px] tracking-widest mb-1 uppercase" style={{ color: themeColor }}>Vinyl</div>
                <div className="text-zinc-600 font-bold text-[8px] tracking-tighter">HI-FI AUDIO</div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-white/10 pointer-events-none"></div>
        </div>
        <div className="absolute w-2.5 h-2.5 bg-[#222] rounded-full z-20 shadow-[inset_0_1px_3px_rgba(255,255,255,0.3)] border border-black"></div>
      </div>

      <div className="absolute inset-0 rounded-full vinyl-reflection pointer-events-none mix-blend-screen opacity-30"></div>

      {/* 唱针臂 */}
      <div 
        className={`absolute -top-6 -right-12 w-44 h-52 transition-transform duration-[1200ms] cubic-bezier(0.34, 1.56, 0.64, 1) origin-[85%_10%] pointer-events-none z-30`}
        style={{ transform: `rotate(${currentAngle}deg)` }}
      >
        <div className="absolute top-2 right-4 w-14 h-14 bg-gradient-to-br from-zinc-400 to-zinc-800 rounded-full shadow-2xl border-4 border-zinc-900 flex items-center justify-center">
            <div className="w-5 h-5 bg-zinc-900 rounded-full border-2 border-zinc-600"></div>
        </div>
        <div className="absolute top-10 right-10 w-2.5 h-48 bg-gradient-to-b from-zinc-300 via-zinc-400 to-zinc-600 rounded-full origin-top rotate-[5deg] shadow-2xl">
            <div className="absolute bottom-0 -left-1.5 w-6 h-11 bg-gradient-to-br from-zinc-700 to-zinc-900 rounded-sm rotate-[-10deg] shadow-lg border border-zinc-800">
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-0.5 h-3.5 bg-zinc-400 rounded-full"></div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default VinylRecord;
