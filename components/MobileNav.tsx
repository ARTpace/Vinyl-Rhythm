
import React from 'react';
import { ViewType } from '../types';

interface MobileNavProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  trackCount: number;
  themeColor?: string;
}

const MobileNav: React.FC<MobileNavProps> = ({ activeView, onViewChange, trackCount, themeColor = '#eab308' }) => {
  const navItems = [
    { id: 'player' as ViewType, label: '播放', icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg> },
    { id: 'all' as ViewType, label: '曲库', icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> },
    { id: 'playlists' as ViewType, label: '歌单', icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> },
    { id: 'collection' as ViewType, label: '收藏', icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M11 3v18M15 3v18"/></svg> },
    { id: 'settings' as ViewType, label: '设置', icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg> }
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#121212]/95 backdrop-blur-xl border-t border-white/5 z-[60] flex items-center justify-around px-2 pb-safe">
      {navItems.map(item => (
        <button
          key={item.id}
          onClick={() => onViewChange(item.id)}
          className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-300 ${activeView === item.id ? '' : 'text-zinc-500 hover:text-zinc-300'}`}
          style={activeView === item.id ? { color: themeColor } : {}}
        >
          <div className={`relative transition-transform duration-300 ${activeView === item.id ? '-translate-y-1' : ''}`}>
             {item.icon}
             {activeView === item.id && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,1)]" />}
          </div>
          <span className="text-[9px] font-bold tracking-widest uppercase scale-90">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default MobileNav;