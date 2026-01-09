
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
    { id: 'all' as ViewType, label: '全部', icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> },
    { id: 'folders' as ViewType, label: '目录', icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> },
    { id: 'favorites' as ViewType, label: '收藏', icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg> },
    { id: 'artists' as ViewType, label: '歌手', icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
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
