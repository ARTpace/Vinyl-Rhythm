
import React from 'react';
import { ViewType } from '../types';

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  trackCount: number;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange, trackCount }) => {
  const navItems = [
    { id: 'player' as ViewType, label: '正在播放', icon: '💿' },
    { id: 'all' as ViewType, label: '全部歌曲', icon: '🎵' },
    { id: 'favorites' as ViewType, label: '我的收藏', icon: '❤️' },
    { id: 'artists' as ViewType, label: '歌手预览', icon: '👤' },
    { id: 'albums' as ViewType, label: '专辑浏览', icon: '💿' },
  ];

  return (
    <div className="w-64 bg-[#000000] h-screen flex flex-col border-r border-zinc-800 p-6 z-20 relative">
      <div className="mb-10">
        <h1 className="text-xl font-bold text-yellow-500 tracking-widest flex items-center gap-2">
          <span>VINYL</span>
          <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">TIME</span>
        </h1>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`
              w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all
              ${activeView === item.id ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}
            `}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-6 border-t border-zinc-800">
        <div className="text-xs text-zinc-500">
          库中共有 {trackCount} 首曲目
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
