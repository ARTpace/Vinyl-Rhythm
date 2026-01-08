
import React from 'react';

interface VinylRecordProps {
  isPlaying: boolean;
  coverUrl?: string;
}

const VinylRecord: React.FC<VinylRecordProps> = ({ isPlaying, coverUrl }) => {
  return (
    <div className="relative flex items-center justify-center w-72 h-72 md:w-96 md:h-96 flex-shrink-0 aspect-square group">
      {/* 外部阴影层 - 增强立体悬浮感 */}
      <div className="absolute inset-0 rounded-full bg-black/40 blur-2xl scale-95 translate-y-8"></div>

      {/* 唱片旋转盘 */}
      <div className={`
        relative w-full h-full rounded-full vinyl-texture shadow-[0_0_50px_rgba(0,0,0,0.8),inset_0_0_10px_rgba(255,255,255,0.05)] border-[12px] border-[#181818]
        flex items-center justify-center transition-transform duration-[2000ms] cubic-bezier(0.4, 0, 0.2, 1)
        ${isPlaying ? 'animate-spin-slow scale-100' : 'scale-[0.98]'}
      `}>
        {/* 盘面上细微的高光环 */}
        <div className="absolute inset-4 rounded-full border border-white/5 pointer-events-none"></div>
        <div className="absolute inset-10 rounded-full border border-white/5 pointer-events-none"></div>
        
        {/* 内圈标签区域 */}
        <div className="relative w-1/3 h-1/3 rounded-full bg-[#111] shadow-inner flex items-center justify-center overflow-hidden border-4 border-zinc-900 z-10">
          {coverUrl ? (
            <img 
              src={coverUrl} 
              alt="Cover" 
              className={`w-full h-full object-cover transition-opacity duration-1000 ${isPlaying ? 'opacity-90' : 'opacity-60'}`} 
            />
          ) : (
            <div className="flex flex-col items-center">
                <div className="text-yellow-500 font-black text-[10px] tracking-widest mb-1">VINYL</div>
                <div className="text-zinc-600 font-bold text-[8px] tracking-tighter">HI-FI AUDIO</div>
            </div>
          )}
          {/* 标签纸纹理遮罩 */}
          <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent pointer-events-none"></div>
        </div>

        {/* 中心固定针孔 */}
        <div className="absolute w-2 h-2 bg-[#222] rounded-full z-20 shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)] border border-black"></div>
      </div>

      {/* 环境反光层 (不随唱片旋转，模拟真实光源) */}
      <div className="absolute inset-0 rounded-full vinyl-reflection pointer-events-none mix-blend-screen opacity-40"></div>

      {/* 唱针臂组件 */}
      <div className={`
        absolute -top-6 -right-10 w-40 h-48 transition-all duration-1000 origin-[90%_10%] pointer-events-none z-30
        ${isPlaying ? 'rotate-[22deg] translate-x-1' : 'rotate-0'}
      `}>
        {/* 唱针基座旋转轴 */}
        <div className="absolute top-2 right-4 w-12 h-12 bg-gradient-to-br from-zinc-400 to-zinc-700 rounded-full shadow-2xl border-4 border-zinc-800 flex items-center justify-center">
            <div className="w-4 h-4 bg-zinc-900 rounded-full border-2 border-zinc-600"></div>
        </div>
        
        {/* 唱针长臂 */}
        <div className="absolute top-8 right-8 w-2 h-44 bg-gradient-to-b from-zinc-300 via-zinc-400 to-zinc-500 rounded-full origin-top rotate-[4deg] shadow-lg">
            {/* 唱针头 (Cartridge) */}
            <div className="absolute bottom-0 -left-1 w-5 h-10 bg-gradient-to-br from-zinc-600 to-zinc-800 rounded-sm rotate-[-8deg] shadow-md border border-zinc-700">
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-zinc-400 rounded-full"></div>
            </div>
        </div>

        {/* 唱针细节装饰线 */}
        <div className="absolute top-10 right-9 w-0.5 h-32 bg-white/20 rounded-full rotate-[4deg]"></div>
      </div>

      {/* 底部播放提示光晕 */}
      {isPlaying && (
        <div className="absolute -bottom-4 w-1/2 h-1 bg-yellow-500/20 blur-md animate-pulse"></div>
      )}
    </div>
  );
};

export default VinylRecord;
