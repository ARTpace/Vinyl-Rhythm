
import React, { useRef } from 'react';
import { LibraryFolder } from '../types';
import { exportDatabase, importDatabase } from '../utils/storage';

interface ImportWindowProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: () => void;
  onRemoveFolder: (id: string) => void;
  importedFolders: LibraryFolder[];
  onManualFilesSelect?: (files: FileList) => void;
  isImporting?: boolean;
  importProgress?: number;
  currentProcessingFile?: string;
}

const ImportWindow: React.FC<ImportWindowProps> = ({ 
  isOpen, 
  onClose, 
  onImport, 
  onRemoveFolder, 
  importedFolders,
  onManualFilesSelect,
  isImporting = false,
  importProgress = 0,
  currentProcessingFile = ''
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleManualClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && onManualFilesSelect) {
      onManualFilesSelect(e.target.files);
    }
  };

  const handleImportClick = () => {
    if (importInputRef.current) importInputRef.current.click();
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const ok = await importDatabase(content);
      if (ok) {
        alert("备份恢复成功！请刷新页面查看。");
        window.location.reload();
      } else {
        alert("备份文件无效。");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] animate-in fade-in duration-300">
      <div className="bg-[#181818] border border-white/10 rounded-[2.5rem] p-8 w-[32rem] shadow-2xl relative overflow-hidden min-h-[500px] flex flex-col">
        
        {/* 扫描进度覆盖层 */}
        {isImporting && (
          <div className="absolute inset-0 z-50 bg-[#181818]/95 backdrop-blur-xl flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-300">
            <div className="relative w-40 h-40 mb-10">
              {/* 旋转背景 */}
              <div className="absolute inset-0 rounded-full border-[6px] border-white/5 border-t-yellow-500 animate-spin"></div>
              {/* 百分比数值 */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-white italic tracking-tighter">{importProgress}%</span>
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">Syncing</span>
              </div>
            </div>

            <div className="w-full space-y-4">
              <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="h-full bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)] transition-all duration-300 ease-out"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest animate-pulse">正在解析音轨元数据...</p>
                <p className="text-[10px] font-mono text-zinc-600 truncate max-w-xs mx-auto italic">{currentProcessingFile}</p>
              </div>
            </div>
          </div>
        )}

        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileChange} 
          {...({ webkitdirectory: "true", directory: "true" } as any)} 
          multiple 
        />
        <input type="file" ref={importInputRef} style={{ display: 'none' }} accept=".json" onChange={handleImportBackup} />
        
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl" />
        
        <div className="flex justify-between items-center mb-8 relative z-10 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tighter">音乐库管理</h2>
            <p className="text-zinc-500 text-xs font-bold mt-1 uppercase tracking-widest">Manage your local soundscape</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all active:scale-90">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="space-y-6 relative z-10 flex-1 flex flex-col overflow-hidden">
          {importedFolders.length > 0 ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <span className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] px-1 mb-3 block">已导入记录:</span>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                {importedFolders.map(folder => {
                  const isNew = folder.lastSync === 0;
                  return (
                    <div key={folder.id} className="group bg-white/5 rounded-2xl px-5 py-3 flex items-center justify-between border border-white/5 hover:border-white/10 transition-all">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-xs font-bold block truncate">{folder.name}</span>
                          {isNew && <span className="bg-yellow-500/10 text-yellow-500 text-[8px] font-black px-1.5 py-0.5 rounded border border-yellow-500/20 uppercase tracking-tighter shrink-0">New</span>}
                        </div>
                        <span className="text-zinc-600 text-[9px] font-black uppercase">
                          {isNew ? '点击顶栏同步按钮开始扫描' : `${folder.trackCount} 首歌 • ${new Date(folder.lastSync).toLocaleDateString()}`}
                        </span>
                      </div>
                      <button onClick={() => onRemoveFolder(folder.id)} className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-600 hover:text-red-500 hover:bg-red-500/10 transition-all">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2rem] text-zinc-700 bg-black/20 shrink-0 mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">本地音乐库为空</p>
            </div>
          )}

          <div className="shrink-0 space-y-4 pt-4 border-t border-white/5">
            <div className="grid grid-cols-2 gap-3">
                <button onClick={exportDatabase} className="flex flex-col items-center justify-center p-4 bg-zinc-900/50 rounded-2xl border border-white/5 hover:border-yellow-500/30 transition-all group">
                  <svg className="w-5 h-5 text-zinc-500 group-hover:text-yellow-500 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">导出备份</span>
                </button>
                <button onClick={handleImportClick} className="flex flex-col items-center justify-center p-4 bg-zinc-900/50 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all group">
                  <svg className="w-5 h-5 text-zinc-500 group-hover:text-blue-500 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">恢复备份</span>
                </button>
            </div>

            <div className="space-y-3">
              <button 
                onClick={onImport} 
                disabled={isImporting}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-5 rounded-full font-black text-sm active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3 group disabled:opacity-50"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="group-hover:rotate-90 transition-transform"><path d="M12 5v14M5 12h14"/></svg>
                添加文件夹
              </button>
              <button 
                onClick={handleManualClick} 
                disabled={isImporting}
                className="w-full bg-white/5 hover:bg-white/10 text-zinc-300 py-3 rounded-full font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                传统兼容模式导入
              </button>
              <div className="px-4 py-2 bg-black/20 rounded-2xl border border-white/5">
                <p className="text-center text-[9px] text-zinc-600 font-bold leading-relaxed uppercase tracking-widest">
                  添加文件夹后，请点击主界面右上角的 <span className="text-yellow-500">同步按钮</span> 开始扫描音乐。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportWindow;
