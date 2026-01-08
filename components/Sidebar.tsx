
import React, { useState } from 'react';
import { ViewType } from '../types';

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  trackCount: number;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange, trackCount }) => {
  // 默认折叠
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHovering, setIsHovering] = useState(false);

  const navItems = [
    { 
      id: 'player' as ViewType, 
      label: '正在播放', 
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
      )
    },
    { 
      id: 'all' as ViewType, 
      label: '全部歌曲', 
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
        </svg>
      )
    },
    { 
      id: 'folders' as ViewType, 
      label: '本地目录', 
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      )
    },
    { 
      id: 'favorites' as ViewType, 
      label: '我的收藏', 
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
        </svg>
      )
    },
    { 
      id: 'artists' as ViewType, 
      label: '歌手预览', 
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      )
    },
    { 
      id: 'albums' as ViewType, 
      label: '专辑浏览', 
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="12" cy="12" r="3"/><path d="M3 12h18"/>
        </svg>
      )
    },
  ];

  // 统一的动画配置
  const transitionClass = "transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]";
  
  // 文字隐藏/显示样式
  const textRevealClass = `whitespace-nowrap overflow-hidden ${transitionClass} ${isCollapsed ? 'max-w-0 opacity-0 -translate-x-4' : 'max-w-[200px] opacity-100 translate-x-0 ml-4'}`;

  return (
    <aside 
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={`
        relative bg-black h-screen flex flex-col border-r border-zinc-900 z-50 pb-28
        ${transitionClass}
        ${isCollapsed ? 'w-20' : 'w-64'}
      `}
    >
      {/* 侧边栏切换按钮 */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? "展开侧边栏" : "折叠侧边栏"}
        className={`
            absolute top-1/2 -translate-y-1/2
            ${isCollapsed ? '-right-5 hover:-right-6' : '-right-4 hover:-right-5'}
            w-6 h-32
            bg-[#181818] border border-white/10 border-l-0 rounded-r-2xl
            flex items-center justify-center cursor-pointer z-[60]
            text-zinc-500 hover:text-yellow-500 hover:w-8 hover:brightness-125
            shadow-[4px_0_20px_rgba(0,0,0,0.5)] group
            ${transitionClass}
        `}
      >
         <div className="w-1.5 h-12 bg-zinc-700 rounded-full group-hover:bg-yellow-500 transition-colors duration-300" />
      </button>

      {/* Logo 区域 */}
      <div className={`p-0 h-24 flex items-center overflow-hidden shrink-0 ${transitionClass} ${isCollapsed ? 'pl-[22px]' : 'pl-8'}`}>
        <div className="flex items-center">
          <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center border border-white/5 shadow-2xl shrink-0 z-10 relative">
            <span className="text-2xl font-black text-yellow-500 select-none">V</span>
          </div>
          <div className={textRevealClass}>
            <div className="flex flex-col">
                <h1 className="text-xl font-black text-white tracking-[0.2em] leading-none">INYL</h1>
                <span className="text-[10px] text-zinc-600 font-black tracking-[0.1em]">TIME AUDIO</span>
            </div>
          </div>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 space-y-2 px-3 overflow-hidden hover:overflow-y-auto custom-scrollbar">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            title={isCollapsed ? item.label : ''}
            className={`
              w-full flex items-center rounded-2xl group relative overflow-hidden
              ${transitionClass}
              ${isCollapsed ? 'justify-center py-4 px-0' : 'justify-start px-5 py-3.5'}
              ${activeView === item.id 
                ? 'bg-zinc-900 text-white border border-white/5' 
                : 'text-zinc-600 border border-transparent hover:text-zinc-300 hover:bg-zinc-900/50'}
            `}
          >
            <div className={`
              shrink-0 flex items-center justify-center
              ${transitionClass}
              ${isCollapsed ? 'w-full' : 'w-5'}
            `}>
                <div className={`
                    ${transitionClass}
                    ${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'}
                    ${activeView === item.id ? 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]' : 'group-hover:text-zinc-400'}
                `}>
                    {item.icon}
                </div>
            </div>
            
            <span className={`font-black text-[11px] tracking-[0.2em] uppercase ${textRevealClass}`}>
              {item.label}
            </span>
            
            {activeView === item.id && (
              <div className={`absolute left-0 w-1 bg-yellow-500 rounded-r-full shadow-[0_0_15px_rgba(234,179,8,0.5)] ${transitionClass} ${isCollapsed ? 'h-full opacity-0' : 'h-6 top-1/2 -translate-y-1/2 opacity-100'}`} />
            )}
            {/* 折叠模式下的激活指示器 */}
            {activeView === item.id && isCollapsed && (
                 <div className="absolute bottom-1.5 w-1.5 h-1.5 bg-yellow-500 rounded-full shadow-[0_0_8px_rgba(234,179,8,0.8)] animate-pulse"></div>
            )}
          </button>
        ))}
      </nav>

      {/* 底部存储状态 */}
      <div className={`mt-auto shrink-0 overflow-hidden ${transitionClass} ${isCollapsed ? 'p-2' : 'p-8'}`}>
        {/* 展开状态的面板 */}
        <div className={`
            bg-zinc-900/40 rounded-3xl border border-white/5 whitespace-nowrap overflow-hidden
            ${transitionClass}
            ${isCollapsed ? 'max-h-0 opacity-0 p-0 border-0' : 'max-h-32 opacity-100 p-5'}
        `}>
            <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.3em] mb-2">Storage Status</p>
            <div className="flex items-end justify-between">
                <span className="text-sm text-white font-mono opacity-80">{trackCount}</span>
                <span className="text-[9px] text-zinc-700 font-black">TRACKS</span>
            </div>
            <div className="mt-3 w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-yellow-500/50 transition-all duration-1000" 
                    style={{ width: `${Math.min(100, trackCount * 2)}%` }}
                />
            </div>
        </div>

        {/* 折叠状态的小红点 */}
        <div className={`
             flex justify-center items-center
             ${transitionClass}
             ${isCollapsed ? 'max-h-12 opacity-100 mt-2' : 'max-h-0 opacity-0 overflow-hidden'}
        `}>
            <div className="relative group cursor-help">
                <div className="w-10 h-10 rounded-2xl bg-zinc-900 flex items-center justify-center text-[10px] font-black text-yellow-500/80 border border-white/5 shadow-lg group-hover:scale-110 transition-transform">
                    {trackCount > 99 ? '99+' : trackCount}
                </div>
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-500 rounded-full border-2 border-black animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.6)]"></div>
            </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
