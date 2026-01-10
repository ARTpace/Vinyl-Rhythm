
import React from 'react';
import { AppSettings } from '../types';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => void;
  onReset: () => void;
  onClearHistory?: () => void;
}

const SettingsCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-white/5 border border-white/5 rounded-3xl p-6 mb-6">
    <div className="flex items-center gap-3 mb-6">
      <div className="text-yellow-500">{icon}</div>
      <h3 className="text-sm font-black uppercase tracking-widest text-white">{title}</h3>
    </div>
    <div className="space-y-4">
      {children}
    </div>
  </div>
);

const Toggle: React.FC<{ label: string; subLabel?: string; checked: boolean; onChange: (val: boolean) => void }> = ({ label, subLabel, checked, onChange }) => (
  <div className="flex items-center justify-between group">
    <div>
      <div className="text-sm font-bold text-zinc-200">{label}</div>
      {subLabel && <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">{subLabel}</div>}
    </div>
    <button 
      onClick={() => onChange(!checked)}
      className={`w-12 h-6 rounded-full relative transition-all duration-300 ${checked ? 'bg-yellow-500' : 'bg-zinc-800'}`}
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${checked ? 'left-7 shadow-lg' : 'left-1'}`} />
    </button>
  </div>
);

const Slider: React.FC<{ label: string; value: number; min: number; max: number; onChange: (val: number) => void }> = ({ label, value, min, max, onChange }) => (
  <div className="space-y-3">
    <div className="flex justify-between items-end">
      <div className="text-sm font-bold text-zinc-200">{label}</div>
      <div className="text-[10px] font-mono text-yellow-500">{value}s</div>
    </div>
    <input 
      type="range" min={min} max={max} value={value} 
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none accent-yellow-500 cursor-pointer"
    />
  </div>
);

const SettingsView: React.FC<SettingsViewProps> = ({ settings, onUpdate, onReset, onClearHistory }) => {
  const clearAICache = () => {
    if (confirm("确定要清除所有 AI 音乐解读缓存吗？清除后再次播放时需重新联网生成。")) {
      const request = indexedDB.deleteDatabase('VinylRhythmDB');
      request.onsuccess = () => {
         alert("已清除 AI 解读数据，应用将刷新以重新初始化。");
         window.location.reload();
      };
    }
  };

  const handleClearHistory = () => {
    if (confirm("确定要清除播放历史记录吗？")) {
      onClearHistory?.();
    }
  };

  return (
    <div className="p-4 md:p-12 h-full overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-700 pb-32">
      <header className="mb-10">
        <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase italic">控制中心</h2>
        <div className="h-1 w-20 bg-yellow-500 mt-4 rounded-full shadow-[0_0_15px_rgba(234,179,8,0.5)]"></div>
      </header>

      <div className="max-w-3xl">
        <SettingsCard title="AI 实验室" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>}>
          <Toggle 
            label="启用 Gemini 音乐解读" 
            subLabel="智能生成歌曲背景与意境解读（需联网）"
            checked={settings.enableAI} 
            onChange={(val) => onUpdate({ enableAI: val })} 
          />
          <div className="pt-2">
            <button onClick={clearAICache} className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-red-500 transition-colors">清除解读缓存</button>
          </div>
        </SettingsCard>

        <SettingsCard title="数据管理" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>}>
           <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-zinc-200">播放历史记录</div>
                <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">本地存储的最近播放曲目清单</div>
              </div>
              <button 
                onClick={handleClearHistory}
                className="px-4 py-1.5 rounded-full bg-white/5 hover:bg-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Clear History
              </button>
           </div>
        </SettingsCard>

        <SettingsCard title="视觉渲染" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>}>
          <Slider 
            label="黑胶旋转周期" 
            value={settings.spinSpeed} min={5} max={30} 
            onChange={(val) => onUpdate({ spinSpeed: val })} 
          />
          <div className="h-px bg-white/5 my-2" />
          <Toggle 
            label="动态音律粒子" 
            subLabel="播放时黑胶唱片周围的漂浮粒子特效"
            checked={settings.showParticles} 
            onChange={(val) => onUpdate({ showParticles: val })} 
          />
          <Toggle 
            label="全屏沉浸背景" 
            subLabel="播放页使用模糊封面作为大背景"
            checked={settings.showBlurBackground} 
            onChange={(val) => onUpdate({ showBlurBackground: val })} 
          />
        </SettingsCard>

        <SettingsCard title="偏好与界面" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}>
          <Toggle 
            label="优先显示繁体中文" 
            subLabel="自动将库内歌曲信息转换为繁体展示"
            checked={settings.useTraditionalChinese} 
            onChange={(val) => onUpdate({ useTraditionalChinese: val })} 
          />
          <Toggle 
            label="音质元数据标签" 
            subLabel="在播放页显示比特率与音质评级"
            checked={settings.showQualityTag} 
            onChange={(val) => onUpdate({ showQualityTag: val })} 
          />
        </SettingsCard>

        <div className="mt-12 flex items-center justify-between px-6 py-8 border border-red-500/20 rounded-3xl bg-red-500/5">
          <div>
            <div className="text-white font-black uppercase text-xs tracking-widest mb-1">重置所有配置</div>
            <div className="text-red-500/60 text-[10px] font-bold uppercase tracking-tighter">恢复初始设置，不影响音乐文件</div>
          </div>
          <button 
            onClick={() => { if(confirm("确定恢复默认设置吗？")) onReset(); }}
            className="px-6 py-2 bg-red-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all active:scale-95"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
