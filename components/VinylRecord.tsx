
import React, { useMemo } from 'react';

interface VinylRecordProps {
  isPlaying: boolean;
  coverUrl?: string;
  intensity?: number;
  progress?: number;
  themeColor?: string; 
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
      duration: `${3 + Math.random() * 2}s`,
      translateX: `${(Math.random() - 0.5) * 100}px`,
      left: `${30 + Math.random() * 40}%`,
      size: `${1 + Math.random() * 2}px`,
      baseOpacity: 0.1 + Math.random() * 0.2
    }));
  }, []);

  const recordScale = isPlaying ? 1 + intensity * 0.03 : 0.98;
  const auraScale = 0.9 + intensity * 0.2;
  const auraOpacity = isPlaying ? (0.1 + intensity * 0.4) : 0;
  const waveScale = 1.0 + intensity * 0.35;
  const waveOpacity = 0.05 + intensity * 0.2;

  const startAngle = 20;
  const endAngle = 36;
  const currentAngle = isPlaying ? startAngle + (progress * (endAngle - startAngle)) : 0;

  const snappyTransition = "all 75ms cubic-bezier(0.2, 0.8, 0.2, 1)";

  return (
    // 移动端使用 w-[70vw] 自适应，最大 w-72。桌面端 w-96。
    <div className="relative flex items-center justify-center w-[70vw] h-[70vw] max-w-[18rem] max-h-[18rem] md:w-96 md:h-96 flex-shrink-0 aspect-square group">
      
      {/* 缩放层 */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{ 
          transform: `scale(${recordScale})`,
          transition: snappyTransition
        }}
      >
        {/* 粒子系统 */}
        {isPlaying && (
          <div className="absolute inset-0 pointer-events-none z-0">
            {particles.map((p) => (
              <div
                key={p.id}
                className="absolute animate-particle rounded-full blur-[1px] pointer-events-none"
                style={{
                  left: p.left,
                  bottom: '45%',
                  width: p.size,
                  height: p.size,
                  backgroundColor: themeColor,
                  opacity: p.baseOpacity + intensity * 0.5,
                  boxShadow: `0 0 8px ${themeColor}`,
                  transition: 'opacity 100ms ease-out',
                  '--particle-delay': p.delay,
                  '--particle-duration': p.duration,
                  '--tw-translate-x': p.translateX,
                } as React.CSSProperties}
              />
            ))}
          </div>
        )}

        {/* 背景光晕 */}
        <div 
          className="absolute inset-[-4%] rounded-full blur-[35px] pointer-events-none"
          style={{ 
            transform: `scale(${auraScale})`,
            opacity: Math.min(0.6, auraOpacity),
            backgroundColor: themeColor,
            boxShadow: `0 0 ${20 + intensity * 60}px ${themeColor}`,
            transition: snappyTransition
          }}
        />

        {/* 扩散波纹 */}
        {isPlaying && (
          <div 
              className="absolute inset-0 rounded-full border-[1.5px] animate-wave-spread pointer-events-none" 
              style={{ 
                  borderColor: themeColor,
                  opacity: waveOpacity,
                  '--tw-scale-to': waveScale 
              } as any} 
          />
        )}

        {/* 唱片主体 */}
        <div className={`
          relative w-full h-full rounded-full vinyl-texture shadow-[0_0_50px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(255,255,255,0.05)] border-[8px] md:border-[14px] border-[#161616]
          flex items-center justify-center transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1)
          ${isPlaying ? 'animate-spin-slow' : ''}
        `}>
          <div className="absolute inset-4 rounded-full border border-white/5 pointer-events-none"></div>
          
          <div className="relative w-1/3 h-1/3 rounded-full bg-[#111] shadow-inner flex items-center justify-center overflow-hidden border-4 border-zinc-900 z-10">
            {coverUrl ? (
              <img 
                src={coverUrl} 
                alt="Cover" 
                className={`w-full h-full object-cover transition-all duration-1000 ${isPlaying ? 'opacity-90 scale-105' : 'opacity-60 scale-100'}`} 
              />
            ) : (
              <div className="flex flex-col items-center">
                  <div className="font-black text-[8px] md:text-[10px] tracking-widest mb-1 uppercase" style={{ color: themeColor }}>Vinyl</div>
                  <div className="text-zinc-600 font-bold text-[6px] md:text-[8px] tracking-tighter">HI-FI AUDIO</div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-white/10 pointer-events-none"></div>
          </div>
          <div className="absolute w-2.5 h-2.5 bg-[#222] rounded-full z-20 shadow-[inset_0_1px_3px_rgba(255,255,255,0.3)] border border-black"></div>
        </div>

        <div className="absolute inset-0 rounded-full vinyl-reflection pointer-events-none mix-blend-screen opacity-15"></div>
      </div>

      {/* 唱针臂 - 移动端调整位置和缩放 */}
      <div 
        className={`absolute -top-6 -right-8 md:-right-12 w-32 h-40 md:w-44 md:h-52 transition-transform duration-[1200ms] cubic-bezier(0.34, 1.56, 0.64, 1) origin-[85%_10%] pointer-events-none z-30`}
        style={{ transform: `rotate(${currentAngle}deg)` }}
      >
        <div className="absolute top-2 right-4 w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-zinc-400 to-zinc-800 rounded-full shadow-2xl border-4 border-zinc-900 flex items-center justify-center">
            <div className="w-4 h-4 md:w-5 md:h-5 bg-zinc-900 rounded-full border-2 border-zinc-600"></div>
        </div>
        <div className="absolute top-8 right-8 md:top-10 md:right-10 w-2 md:w-2.5 h-36 md:h-48 bg-gradient-to-b from-zinc-300 via-zinc-400 to-zinc-600 rounded-full origin-top rotate-[5deg] shadow-2xl">
            <div className="absolute bottom-0 -left-1.5 w-5 h-9 md:w-6 md:h-11 bg-gradient-to-br from-zinc-700 to-zinc-900 rounded-sm rotate-[-10deg] shadow-lg border border-zinc-800">
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-0.5 h-3.5 bg-zinc-400 rounded-full"></div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default VinylRecord;
