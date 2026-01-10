
import React, { useMemo, useRef, useEffect, useState } from 'react';

interface ToneArmProps {
  trackId?: string; // 引入轨道ID用于检测切歌
  isPlaying: boolean;
  progress: number;
  onClick?: () => void;
  themeColor?: string;
}

export const ToneArm: React.FC<ToneArmProps> = ({ trackId, isPlaying, progress, onClick }) => {
  const [isResetting, setIsResetting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const lastTrackId = useRef<string | undefined>(trackId);
  const lastIsPlaying = useRef<boolean>(isPlaying);

  /**
   * 几何参数微调
   * restAngle 改为更小的负值，使其离盘面更远
   */
  const restAngle = -32; 
  const startAngle = 8;  
  const endAngle = 30;   

  // 1. 监测状态变更
  useEffect(() => {
    // 检测切歌
    if (trackId !== lastTrackId.current) {
      setIsResetting(true);
      const timer = setTimeout(() => setIsResetting(false), 1000); 
      lastTrackId.current = trackId;
      return () => clearTimeout(timer);
    }

    // 检测从暂停到播放的起步瞬间
    if (isPlaying && !lastIsPlaying.current) {
      setIsStarting(true);
      const timer = setTimeout(() => setIsStarting(false), 1000); 
      lastIsPlaying.current = isPlaying;
      return () => clearTimeout(timer);
    }

    lastIsPlaying.current = isPlaying;
  }, [trackId, isPlaying]);

  const currentAngle = isPlaying
    ? startAngle + (progress * (endAngle - startAngle))
    : restAngle;

  const statusColor = isPlaying ? '#10b981' : '#f59e0b';

  /**
   * 动态过渡策略：
   * - 状态切换：1000ms 缓入缓出
   * - 循迹过程：1500ms 线性
   */
  const isStateChanging = isResetting || isStarting || !isPlaying;
  const transitionDuration = isStateChanging ? '1000ms' : '1500ms';
  const transitionTiming = isStateChanging ? 'cubic-bezier(0.4, 0, 0.2, 1)' : 'linear';

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`
        absolute 
        top-[0%] right-[-5%] 
        sm:top-[-5%] sm:right-[-15%]
        md:top-[-18%] md:right-[-22%]
        w-32 h-52 sm:w-40 sm:h-64 md:w-48 md:h-72
        z-40 pointer-events-none origin-[80%_15%]
        will-change-transform
      `}
      style={{ 
        transform: `rotate(${currentAngle}deg) scale(${isStateChanging ? 1.05 : 1}) translateZ(0)`,
        transition: `transform ${transitionDuration} ${transitionTiming}`,
        filter: isStateChanging ? 'drop-shadow(0 25px 25px rgba(0,0,0,0.45))' : 'drop-shadow(0 5px 5px rgba(0,0,0,0.2))'
      }}
    >
      {/* 唱臂长杆 */}
      <div 
        className="absolute top-[15%] right-[20%] w-1.5 md:w-2 h-[65%] bg-gradient-to-r from-zinc-500 via-zinc-200 to-zinc-600 rounded-full shadow-[2px_0_10px_rgba(0,0,0,0.3)] pointer-events-auto cursor-pointer"
        style={{ transform: 'translateX(50%)' }}
      >
        {/* 后置平衡锤 */}
        <div className="absolute top-[-18px] left-1/2 -translate-x-1/2 w-4 h-6 md:w-5 md:h-7 bg-gradient-to-r from-zinc-700 via-zinc-400 to-zinc-800 rounded-sm border border-zinc-600/30 shadow-sm">
            <div className="w-full h-px bg-white/5 mt-1.5"></div>
        </div>
        
        {/* 唱头组件 */}
        <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-5 h-8 md:w-7 md:h-12 flex flex-col items-center">
            <div className="w-full flex-1 bg-gradient-to-br from-zinc-800 to-black rounded-b-sm rounded-t-lg border border-zinc-700/30 shadow-lg relative">
                
                {/* 状态指示灯 */}
                <div 
                  className={`
                    absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1 rounded-full 
                    transition-all duration-300 
                    ${isPlaying || isResetting || isStarting ? 'animate-pulse' : ''}
                  `}
                  style={{ 
                    backgroundColor: (isResetting || isStarting) ? '#fff' : statusColor,
                    boxShadow: `0 0 ${(isResetting || isStarting) ? '10px' : (isPlaying ? '6px' : '3px')} ${(isResetting || isStarting) ? '#fff' : statusColor}`
                  }}
                />

                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-px bg-white/10"></div>
                <div className="absolute top-2 -right-3 w-3 h-0.5 bg-gradient-to-r from-zinc-400 to-zinc-600 rounded-full rotate-[15deg]"></div>

                {/* 唱针 */}
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-2 bg-gradient-to-b from-zinc-600 to-zinc-400 rounded-b-full">
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-0.5 bg-white rounded-full shadow-[0_0_2px_#fff]"></div>
                </div>
            </div>
            
            {/* 环境漫反射光 */}
            <div 
              className={`absolute -bottom-2 w-4 h-4 blur-md rounded-full transition-all duration-500 ${isPlaying ? 'opacity-30 scale-150' : 'opacity-10 scale-100'}`}
              style={{ backgroundColor: (isResetting || isStarting) ? '#fff' : statusColor }}
            />
        </div>
      </div>

      {/* 转轴底座 */}
      <div 
        className="absolute top-[15%] right-[20%] w-10 h-10 md:w-14 md:h-14 -translate-y-1/2 translate-x-1/2 z-50 pointer-events-auto cursor-pointer"
        style={{ transform: `translateX(50%) translateY(-50%) rotate(${-currentAngle}deg)` }}
      >
        <div className="w-full h-full rounded-full bg-gradient-to-br from-zinc-500 via-zinc-800 to-zinc-950 shadow-xl border border-zinc-900 flex items-center justify-center">
          <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <div 
                className="w-1 h-1 rounded-full transition-colors duration-700"
                style={{ 
                    backgroundColor: (isResetting || isStarting) ? '#fff' : statusColor,
                    boxShadow: `0 0 4px ${(isResetting || isStarting) ? '#fff' : statusColor}`,
                    opacity: isPlaying || isResetting || isStarting ? 0.6 : 0.2
                }}
              ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface VinylRecordProps {
  isPlaying: boolean;
  coverUrl?: string;
  intensity?: number;
  themeColor?: string; 
  spinSpeed?: number;
  showParticles?: boolean;
}

const VinylRecord: React.FC<VinylRecordProps> = ({ 
  isPlaying, 
  coverUrl, 
  intensity = 0, 
  themeColor = 'rgba(234, 179, 8, 1)',
  spinSpeed = 15,
  showParticles = true
}) => {
  const particles = useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      delay: `${Math.random() * 5}s`,
      duration: `${3 + Math.random() * 2}s`,
      translateX: `${(Math.random() - 0.5) * 100}px`,
      left: `${30 + Math.random() * 40}%`,
      size: `${1 + Math.random() * 2}px`,
      baseOpacity: 0.1 + Math.random() * 0.1
    }));
  }, []);

  // 基础缩放与透明度
  const recordScale = isPlaying ? 0.985 + (intensity * 0.04) : 0.985;
  const auraScale = 0.85 + (intensity * 0.2);
  const auraOpacity = isPlaying ? Math.pow(intensity, 0.9) * 0.45 : 0;

  // 环形波纹动态参数
  const waveScaleBase = 1.15 + (intensity * 0.25); 
  const waveOpacityBase = isPlaying && intensity > 0.05 ? Math.min(0.15, intensity * 0.35) : 0; 
  
  const smoothTransition = {
    transition: 'transform 150ms cubic-bezier(0.2, 0.8, 0.4, 1), opacity 150ms ease-out',
    willChange: 'transform, opacity'
  };

  return (
    <div className="relative flex items-center justify-center w-[60vw] h-[60vw] max-w-[16rem] max-h-[16rem] sm:w-[75vw] sm:h-[75vw] sm:max-w-[20rem] sm:max-h-[20rem] md:w-96 md:h-96 flex-shrink-0 aspect-square group">
      
      {/* 环形波动特效层 */}
      <div className={`absolute inset-0 z-0 pointer-events-none flex items-center justify-center transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}>
        {isPlaying && [0, 1, 2].map((i) => (
          <div
            key={i}
            className={`absolute rounded-full border border-current animate-wave-spread`}
            style={{
              width: '100%',
              height: '100%',
              color: themeColor,
              opacity: waveOpacityBase * (1 - i * 0.35),
              animationDelay: `${i * 1.2}s`,
              animationPlayState: isPlaying ? 'running' : 'paused',
              '--tw-scale-to': waveScaleBase + (i * 0.1), 
              transition: 'opacity 300ms ease-out, transform 300ms ease-out'
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{ 
          transform: `scale(${recordScale}) translateZ(0)`,
          ...smoothTransition
        }}
      >
        {isPlaying && showParticles && (
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
                  opacity: (p.baseOpacity + intensity * 0.5) * (isPlaying ? 1 : 0),
                  boxShadow: `0 0 8px ${themeColor}`,
                  transition: 'opacity 200ms ease-out',
                  '--particle-delay': p.delay,
                  '--particle-duration': p.duration,
                  '--tw-translate-x': p.translateX,
                } as React.CSSProperties}
              />
            ))}
          </div>
        )}

        {/* 动态光晕 */}
        <div 
          className="absolute inset-[-6%] rounded-full blur-[40px] pointer-events-none"
          style={{ 
            transform: `scale(${auraScale}) translateZ(0)`,
            opacity: Math.min(0.5, auraOpacity),
            backgroundColor: themeColor,
            boxShadow: `0 0 ${25 + intensity * 70}px ${themeColor}`,
            transition: 'all 150ms cubic-bezier(0.2, 0.8, 0.4, 1)'
          }}
        />

        {/* 黑胶主体 */}
        <div 
          className={`
            relative w-full h-full rounded-full vinyl-texture shadow-[0_0_60px_rgba(0,0,0,0.9),inset_0_0_20px_rgba(255,255,255,0.05)] border-[8px] md:border-[16px] border-[#111]
            flex items-center justify-center
            ${isPlaying ? 'animate-spin-slow' : ''}
          `}
          style={{ 
            animationDuration: isPlaying ? `${spinSpeed}s` : '0s',
            transition: 'transform 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
            willChange: 'transform'
          }}
        >
          {/* 纹理装饰圈 */}
          <div className="absolute inset-6 md:inset-8 rounded-full border border-white/5 pointer-events-none"></div>
          <div className="absolute inset-12 md:inset-16 rounded-full border border-white/5 pointer-events-none opacity-40"></div>
          
          {/* 唱片封面 (Label) */}
          <div className="relative w-[34%] h-[34%] rounded-full bg-[#111] shadow-inner flex items-center justify-center overflow-hidden border-2 md:border-4 border-zinc-900 z-10">
            {coverUrl ? (
              <img 
                src={coverUrl} 
                alt="Cover" 
                className={`w-full h-full object-cover transition-all duration-[1500ms] ${isPlaying ? 'opacity-90 scale-110' : 'opacity-60 scale-100'}`} 
              />
            ) : (
              <div className="flex flex-col items-center">
                  <div className="font-black text-[6px] md:text-[10px] tracking-widest mb-1 uppercase" style={{ color: themeColor }}>Vinyl</div>
                  <div className="text-zinc-600 font-bold text-[4px] md:text-[8px] tracking-tighter">HI-FI AUDIO</div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-tr from-black/50 via-transparent to-white/20 pointer-events-none"></div>
          </div>
          
          {/* 中间主轴孔 */}
          <div className="absolute w-2 h-2 md:w-3 md:h-3 bg-[#222] rounded-full z-20 shadow-[inset_0_1px_3px_rgba(255,255,255,0.4)] border border-black"></div>
        </div>
        
        {/* 环境反光层 */}
        <div className="absolute inset-0 rounded-full vinyl-reflection pointer-events-none mix-blend-screen opacity-20"></div>
      </div>
    </div>
  );
};

export default VinylRecord;
