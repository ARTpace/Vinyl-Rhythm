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
}

const ImportWindow: React.FC<ImportWindowProps> = ({ 
  isOpen, 
  onClose, 
  onImport, 
  onRemoveFolder, 
  importedFolders,
  onManualFilesSelect
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
      <div className="bg-[#181818] border border-white/10 rounded-[2.5rem] p-8 w-[32rem] shadow-2xl relative overflow-hidden">
        {/* Fix: 使用类型断言绕过 TypeScript 对非标准属性 webkitdirectory 和 directory 的检查 */}
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
        
        <div className="flex justify-between items-center mb-8 relative z-10">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tighter">音乐库管理</h2>
            <p className="text-zinc-500 text-xs font-bold mt-1 uppercase tracking-widest">Manage your local soundscape</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all active:scale-90">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="space-y-6 relative z-10">
          {importedFolders.length > 0 ? (
            <div className="space-y-3">
              <span className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] px-1">已导入记录:</span>
              <div className="max-h-[160px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                {importedFolders.map(folder => (
                  <div key={folder.id} className="group bg-white/5 rounded-2xl px-5 py-3 flex items-center justify-between border border-white/5 hover:border-white/10 transition-all">
                    <div className="min-w-0 flex-1">
                      <span className="text-white text-xs font-bold block truncate">{folder.name}</span>
                      <span className="text-zinc-600 text-[9px] font-black uppercase">
                        {folder.trackCount} 首歌 • {new Date(folder.lastSync).toLocaleDateString()}
                      </span>
                    </div>
                    <button onClick={() => onRemoveFolder(folder.id)} className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-600 hover:text-red-500 hover:bg-red-500/10 transition-all">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-24 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2rem] text-zinc-700 bg-black/20">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">本地音乐库为空</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pb-2 border-t border-white/5 pt-4">
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
            <button onClick={onImport} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-5 rounded-full font-black text-sm active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3 group">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="group-hover:rotate-90 transition-transform"><path d="M12 5v14M5 12h14"/></svg>
              添加文件夹 (智能同步)
            </button>
            <button onClick={handleManualClick} className="w-full bg-white/5 hover:bg-white/10 text-zinc-300 py-3 rounded-full font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              传统兼容模式导入
            </button>
            <p className="text-center px-4 text-[9px] text-zinc-600 font-bold leading-relaxed uppercase tracking-widest">
              数据存储在浏览器本地数据库中。清理“网站数据”会导致 AI 解读内容丢失。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportWindow;