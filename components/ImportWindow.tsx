
import React from 'react';
import { LibraryFolder } from '../types';

interface ImportWindowProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: () => void;
  onRemoveFolder: (id: string) => void; // 新增：删除文件夹的回调
  importedFolders: LibraryFolder[];
}

const ImportWindow: React.FC<ImportWindowProps> = ({ isOpen, onClose, onImport, onRemoveFolder, importedFolders }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] animate-in fade-in duration-300">
      <div className="bg-[#181818] border border-white/10 rounded-[2.5rem] p-8 w-[32rem] shadow-2xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tighter">音乐库管理</h2>
            <p className="text-zinc-500 text-xs font-bold mt-1 uppercase tracking-widest">Manage your local soundscape</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="space-y-6">
          {importedFolders.length > 0 ? (
            <div className="space-y-3">
              <span className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] px-1">已导入文件夹:</span>
              <div className="max-h-[200px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                {importedFolders.map(folder => (
                  <div key={folder.id} className="group bg-white/5 rounded-2xl px-5 py-3 flex items-center justify-between border border-white/5 hover:border-white/10 transition-all">
                    <div className="min-w-0 flex-1">
                      <span className="text-white text-xs font-bold block truncate">{folder.name}</span>
                      <span className="text-zinc-600 text-[9px] font-black uppercase">
                        {folder.trackCount} 首歌 • 同步于 {new Date(folder.lastSync).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-yellow-500/50 group-hover:text-yellow-500 transition-colors">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                        </div>
                        <button 
                          onClick={() => onRemoveFolder(folder.id)}
                          title="移除文件夹"
                          className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>
                          </svg>
                        </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-24 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2rem] text-zinc-600">
              <p className="text-[10px] font-black uppercase tracking-widest">暂无关联的本地目录</p>
            </div>
          )}

          <div className="pt-4 border-t border-white/5">
            <button
              onClick={() => { onImport(); }}
              className="w-full bg-white hover:bg-zinc-200 text-black py-4 rounded-full font-black text-sm active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              添加新文件夹
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportWindow;
