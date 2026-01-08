
import React, { useMemo } from 'react';

interface VinylRecordProps {
  isPlaying: boolean;
  coverUrl?: string;
  intensity?: number; // 接收来自 App 的实时音频强度 (0-1)
}

const VinylRecord: React.FC<VinylRecordProps> = ({ isPlaying, coverUrl, intensity = 0 }) => {
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

  // 律动参数计算
  const auraScale = 1 + intensity * 0.4;
  const recordScale = isPlaying ? 1 + intensity * 0.08 : 0.98;
  const auraOpacity = 0.1 + intensity * 0.6;
  const waveScale = 1 + intensity * 0.8;

  return (
    <div 
      className="relative flex items-center justify-center w-72 h-72 md:w-96 md:h-96 flex-shrink-0 aspect-square group transition-transform duration-100 ease-out"
      style={{ transform: `scale(${recordScale})` }}
    >
      
      {/* 粒子系统层 */}
      {isPlaying && (
        <div className="absolute inset-0 pointer-events-none z-0">
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute animate-particle rounded-full bg-yellow-500 blur-[1px] transition-opacity duration-300"
              style={{
                left: p.left,
                bottom: '40%',
                width: p.size,
                height: p.size,
                opacity: p.baseOpacity + intensity * 0.5,
                '--particle-delay': p.delay,
                '--particle-duration': p.duration,
                '--tw-translate-x': p.translateX,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      {/* 律动律动背景光晕 (受强度控制) */}
      <div 
        className={`absolute inset-[-15%] rounded-full bg-yellow-500 blur-3xl transition-all duration-150 ease-out`}
        style={{ 
          transform: `scale(${auraScale})`,
          opacity: isPlaying ? auraOpacity : 0
        }}
      />

      {/* 扩散波纹环 - 第一层 (强度越大 扩散越远) */}
      {isPlaying && (
        <div 
            className="absolute inset-0 rounded-full border-2 border-yellow-500 animate-wave-spread pointer-events-none" 
            style={{ 
                opacity: 0.2 + intensity * 0.3,
                '--tw-scale-to': waveScale 
            } as any} 
        />
      )}
      
      {/* 扩散波纹环 - 第二层 (延迟) */}
      {isPlaying && (
        <div 
            className="absolute inset-0 rounded-full border border-yellow-500/10 animate-wave-spread pointer-events-none" 
            style={{ 
                animationDelay: '1.5s',
                '--tw-scale-to': waveScale * 0.8
            } as any} 
        />
      )}

      {/* 外部阴影层 */}
      <div className="absolute inset-0 rounded-full bg-black/50 blur-2xl scale-95 translate-y-8"></div>

      {/* 唱片旋转盘 */}
      <div className={`
        relative w-full h-full rounded-full vinyl-texture shadow-[0_0_60px_rgba(0,0,0,0.9),inset_0_0_15px_rgba(255,255,255,0.05)] border-[12px] border-[#161616]
        flex items-center justify-center transition-all duration-[2000ms] cubic-bezier(0.4, 0, 0.2, 1)
        ${isPlaying ? 'animate-spin-slow' : ''}
      `}>
        {/* 盘面上细微的高光环 */}
        <div className="absolute inset-4 rounded-full border border-white/5 pointer-events-none"></div>
        <div className="absolute inset-10 rounded-full border border-white/5 pointer-events-none"></div>
        <div className="absolute inset-20 rounded-full border border-white/5 pointer-events-none opacity-40"></div>
        
        {/* 内圈标签区域 */}
        <div className="relative w-1/3 h-1/3 rounded-full bg-[#111] shadow-inner flex items-center justify-center overflow-hidden border-4 border-zinc-900 z-10">
          {coverUrl ? (
            <img 
              src={coverUrl} 
              alt="Cover" 
              className={`w-full h-full object-cover transition-all duration-1000 ${isPlaying ? 'opacity-90 scale-105' : 'opacity-60 scale-100'}`} 
            />
          ) : (
            <div className="flex flex-col items-center">
                <div className="text-yellow-500 font-black text-[10px] tracking-widest mb-1">VINYL</div>
                <div className="text-zinc-600 font-bold text-[8px] tracking-tighter">HI-FI AUDIO</div>
            </div>
          )}
          {/* 标签纸纹理遮罩 */}
          <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-white/10 pointer-events-none"></div>
        </div>

        {/* 中心固定针孔 */}
        <div className="absolute w-2.5 h-2.5 bg-[#222] rounded-full z-20 shadow-[inset_0_1px_3px_rgba(255,255,255,0.3)] border border-black"></div>
      </div>

      {/* 环境反光层 (不随唱片旋转) */}
      <div className="absolute inset-0 rounded-full vinyl-reflection pointer-events-none mix-blend-screen opacity-40"></div>

      {/* 唱针臂组件 (受强度影响产生微颤) */}
      <div 
        className={`
            absolute -top-6 -right-12 w-44 h-52 transition-all duration-[1200ms] origin-[85%_10%] pointer-events-none z-30
            ${isPlaying ? 'rotate-[24deg] translate-x-1' : 'rotate-0'}
        `}
        style={{ transform: isPlaying ? `rotate(${24 + intensity * 2}deg)` : undefined }}
      >
        {/* 唱针基座旋转轴 */}
        <div className="absolute top-2 right-4 w-14 h-14 bg-gradient-to-br from-zinc-400 to-zinc-800 rounded-full shadow-2xl border-4 border-zinc-900 flex items-center justify-center">
            <div className="w-5 h-5 bg-zinc-900 rounded-full border-2 border-zinc-600"></div>
        </div>
        
        {/* 唱针长臂 */}
        <div className="absolute top-10 right-10 w-2.5 h-48 bg-gradient-to-b from-zinc-300 via-zinc-400 to-zinc-600 rounded-full origin-top rotate-[5deg] shadow-2xl">
            {/* 唱针头 (Cartridge) */}
            <div className="absolute bottom-0 -left-1.5 w-6 h-11 bg-gradient-to-br from-zinc-700 to-zinc-900 rounded-sm rotate-[-10deg] shadow-lg border border-zinc-800">
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-0.5 h-3.5 bg-zinc-400 rounded-full"></div>
            </div>
        </div>

        {/* 唱针细节装饰线 */}
        <div className="absolute top-12 right-11 w-0.5 h-36 bg-white/10 rounded-full rotate-[5deg]"></div>
      </div>

      {/* 底部播放提示光晕 */}
      <div className={`
        absolute -bottom-10 w-2/3 h-4 bg-yellow-500/20 blur-2xl transition-all duration-300 rounded-full
        ${isPlaying ? 'opacity-100' : 'opacity-0 scale-50'}
      `} style={{ transform: `scale(${1 + intensity * 0.5})` }}></div>
    </div>
  );
};

export default VinylRecord;
