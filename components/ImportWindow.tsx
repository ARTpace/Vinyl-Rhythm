
import React, { useRef } from 'react';
import { LibraryFolder } from '../types';
import { exportDatabase, importDatabase } from '../utils/storage';

interface ImportWindowProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: () => void;
  onReconnectFolder?: (id: string, handle: FileSystemDirectoryHandle) => void;
  onRemoveFolder: (id: string) => void;
  importedFolders: (LibraryFolder & { hasHandle: boolean })[] | any[];
  onManualFilesSelect?: (files: FileList) => void;
  onSyncFolder?: (id: string) => void;
  isImporting?: boolean;
  syncingFolderId?: string | null;
  nasMode?: boolean;
}

const ImportWindow: React.FC<ImportWindowProps> = ({ 
  isOpen, 
  onClose, 
  onImport, 
  onReconnectFolder,
  onRemoveFolder, 
  importedFolders,
  onManualFilesSelect,
  onSyncFolder,
  isImporting = false,
  syncingFolderId = null,
  nasMode = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && onManualFilesSelect) {
      onManualFilesSelect(e.target.files);
    }
  };

  const handleImportClick = () => {
    if (importInputRef.current) importInputRef.current.click();
  };

  const onImportWithLog = () => {
    console.log("Import button clicked");
    if (window.windowBridge) {
      console.log("windowBridge found, calling onImport");
    } else if ('showDirectoryPicker' in window) {
      console.log("showDirectoryPicker found, calling onImport");
    } else {
      console.log("Fallback to file input");
      fileInputRef.current?.click();
      return;
    }
    onImport();
  };

  const handleReconnect = async (id: string) => {
    if (nasMode) return;
    try {
      if (window.windowBridge) {
        // Electron 环境下，直接触发同步即可，或者让用户重新选择路径
        if (onSyncFolder) onSyncFolder(id);
        return;
      }
      const handle = await window.showDirectoryPicker();
      if (onReconnectFolder) {
        onReconnectFolder(id, handle);
      }
    } catch (e) {
      console.warn("User cancelled directory picker");
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const ok = await importDatabase(content);
      if (ok) {
        alert("曲库数据已导入！正在刷新。");
        window.location.reload();
      } else {
        alert("备份文件无效。");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] animate-in fade-in duration-300 px-4">
      <div className="bg-[#181818] border border-white/10 rounded-[2.5rem] p-6 md:p-8 w-full max-w-[34rem] max-h-[85vh] shadow-2xl relative overflow-hidden flex flex-col">
        
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} {...({ webkitdirectory: "true", directory: "true" } as any)} multiple />
        <input type="file" ref={importInputRef} style={{ display: 'none' }} accept=".json" onChange={handleImportBackup} />
        
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl" />
        
        <div className="flex justify-between items-start mb-6 relative z-10 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tighter">{nasMode ? 'NAS 曲库管理' : '本地路径记录'}</h2>
            <p className="text-zinc-500 text-[10px] font-black mt-1 uppercase tracking-[0.2em]">
              {nasMode ? 'Cloud Storage Management' : `Managed Folders (${importedFolders.length})`}
            </p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all active:scale-90">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mb-6 min-h-0 relative z-10">
          {nasMode && (
            <div className="mb-4 p-5 rounded-[2rem] bg-emerald-500/5 border border-emerald-500/20 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-lg">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-black text-emerald-400">NAS 存储卷已挂载</div>
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">Docker Path: /music</div>
                  </div>
                  <div className="flex flex-col items-end">
                     <span className="text-[10px] font-black text-zinc-500">STATUS</span>
                     <span className="text-[10px] font-black text-emerald-500 animate-pulse uppercase">Connected</span>
                  </div>
               </div>
            </div>
          )}

          {!nasMode && importedFolders.length > 0 ? (
            <div className="space-y-2">
              {importedFolders.map(folder => {
                const isDisconnected = !folder.hasHandle;
                const isCurrentlySyncing = syncingFolderId === folder.id || syncingFolderId === 'ALL';
                const total = folder.totalFilesCount || 0;
                const current = folder.trackCount;
                const isPending = total > current;
                
                return (
                  <div key={folder.id} className={`group rounded-2xl px-4 py-2.5 flex items-center justify-between border transition-all ${isDisconnected ? 'bg-red-500/5 border-red-500/20 shadow-[inset_0_0_10px_rgba(239,68,68,0.05)]' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isDisconnected ? 'bg-red-500 animate-pulse' : (isPending || isCurrentlySyncing) ? 'bg-yellow-500 animate-pulse' : 'bg-emerald-500'}`} />
                        <span className="text-white text-xs font-bold block truncate">{folder.name}</span>
                      </div>
                      <div className="mt-0.5">
                          <span className={`text-[8px] font-black uppercase tracking-tighter ${isDisconnected ? 'text-red-400/80' : 'text-zinc-600'}`}>
                          {isDisconnected ? '⚠️ 访问断开，请重新关联' : total > 0 ? `${current} / ${total} 首歌 • ${isCurrentlySyncing ? '正在解析元数据...' : isPending ? '待同步' : '已就绪'}` : `${current} 首歌 • 扫描中`}
                          </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {isDisconnected ? (
                          <button onClick={() => handleReconnect(folder.id)} className="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[9px] font-black uppercase tracking-tighter transition-colors">修复</button>
                      ) : (isPending || isCurrentlySyncing) ? (
                          <button onClick={() => onSyncFolder?.(folder.id)} disabled={isImporting} className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all text-[9px] font-black uppercase tracking-tighter ${isCurrentlySyncing ? 'bg-yellow-500 text-black' : 'bg-yellow-500/10 hover:bg-yellow-500 text-yellow-500 hover:text-black border border-yellow-500/20 active:scale-95'}`}>
                              {isCurrentlySyncing && <div className="w-2 h-2 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                              {isCurrentlySyncing ? '正在同步' : '继续同步'}
                          </button>
                      ) : null}
                      {!isCurrentlySyncing && (
                        <button onClick={() => onRemoveFolder(folder.id)} className="w-7 h-7 flex items-center justify-center rounded-full text-zinc-700 hover:text-red-500 hover:bg-red-500/10 transition-all">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : !nasMode && (
            <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2rem] text-zinc-700 bg-black/20">
              <div className="p-4 bg-white/5 rounded-full mb-3">
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93l-2.73-2.73A2 2 0 0 0 8.07 2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z"/></svg>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">暂无本地路径</p>
            </div>
          )}

          {nasMode && (
             <div className="p-6 border-2 border-dashed border-white/5 rounded-[2.5rem] bg-black/20 text-center">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-4 leading-relaxed">
                   NAS 模式下，系统会自动读取挂载卷中的所有音乐。<br/>无需手动添加单个文件夹。
                </p>
                <div className="h-px w-8 bg-zinc-800 mx-auto mb-4" />
                <p className="text-[9px] text-zinc-600 font-bold italic uppercase tracking-tighter">
                   Tip: 在 Docker Compose 中修改 volumes 映射来更换曲库。
                </p>
             </div>
          )}
        </div>

        <div className="shrink-0 space-y-4 pt-6 border-t border-white/5 bg-gradient-to-t from-[#181818] via-[#181818] to-transparent relative z-10">
          <div className="grid grid-cols-2 gap-3">
              <button onClick={exportDatabase} className="flex items-center justify-center gap-2 p-3 bg-zinc-900/50 rounded-2xl border border-white/5 hover:border-yellow-500/30 transition-all group">
                <svg className="w-4 h-4 text-zinc-500 group-hover:text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-white">导出备份</span>
              </button>
              <button onClick={handleImportClick} className="flex items-center justify-center gap-2 p-3 bg-zinc-900/50 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all group">
                <svg className="w-4 h-4 text-zinc-500 group-hover:text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-white">导入备份</span>
              </button>
          </div>

          {!nasMode ? (
            <div className="space-y-3">
              <button 
                onClick={onImportWithLog} 
                disabled={isImporting}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-4 rounded-full font-black text-sm active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3 group disabled:opacity-50"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="group-hover:rotate-90 transition-transform"><path d="M12 5v14M5 12h14"/></svg>
                添加新的音乐文件夹
              </button>
            </div>
          ) : (
             <button 
              onClick={() => onSyncFolder?.('ALL')} 
              disabled={isImporting}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-4 rounded-full font-black text-sm active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3 group disabled:opacity-50"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`${isImporting ? 'animate-spin' : 'group-hover:rotate-180 transition-all duration-500'}`}><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24L21 8"/><path d="M21 3v5h-5"/></svg>
              同步 NAS 曲库文件
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportWindow;
