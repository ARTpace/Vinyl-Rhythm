
import React from 'react';

interface VinylRecordProps {
  isPlaying: boolean;
  coverUrl?: string;
}

const VinylRecord: React.FC<VinylRecordProps> = ({ isPlaying, coverUrl }) => {
  return (
    <div className="relative flex items-center justify-center w-64 h-64 md:w-80 md:h-80 group">
      {/* 唱片主体 */}
      <div className={`
        relative w-full h-full rounded-full vinyl-texture shadow-2xl border-4 border-zinc-800
        flex items-center justify-center transition-transform duration-1000
        ${isPlaying ? 'animate-spin-slow' : ''}
      `}>
        {/* 内圈装饰 */}
        <div className="w-1/3 h-1/3 rounded-full bg-zinc-900 border-2 border-zinc-700 flex items-center justify-center overflow-hidden">
          {coverUrl ? (
            <img src={coverUrl} alt="Cover" className="w-full h-full object-cover opacity-80" />
          ) : (
            <div className="text-zinc-600 text-xs text-center px-2">VINYL</div>
          )}
        </div>
        {/* 中心孔 */}
        <div className="absolute w-3 h-3 bg-[#121212] rounded-full border border-zinc-600 shadow-inner"></div>
      </div>

      {/* 唱针 */}
      <div className={`
        absolute -top-4 -right-8 w-32 h-40 transition-transform duration-700 origin-top-right pointer-events-none
        ${isPlaying ? 'rotate-[20deg]' : 'rotate-0'}
      `}>
        <div className="absolute top-0 right-0 w-8 h-8 bg-zinc-400 rounded-full border-4 border-zinc-600 z-10"></div>
        <div className="absolute top-4 right-3 w-2 h-32 bg-zinc-300 rounded-full origin-top rotate-[5deg] shadow-lg"></div>
        <div className="absolute top-[140px] right-[2px] w-4 h-8 bg-zinc-500 rounded-sm rotate-[-10deg]"></div>
      </div>
    </div>
  );
};

export default VinylRecord;
