import React, { useRef, useState } from 'react';
import { LibraryFolder } from '../types';
import { exportDatabase, importDatabase } from '../utils/storage';
import ConfirmModal from './ConfirmModal';

interface ImportWindowProps {
  isOpen: boolean;
  onClose: () => void;
  onFolderSelected: (handleOrPath: FileSystemDirectoryHandle | string) => void;
  onWebdavSelected?: (config: { baseUrl: string; rootPath: string; username?: string; password?: string; name?: string }) => void | Promise<void>;
  onTestWebdav?: (config: { baseUrl: string; rootPath: string; username?: string; password?: string }) => Promise<{ success: boolean; message: string }>;
  onReconnectFolder?: (id: string, handleOrPath: FileSystemDirectoryHandle | string) => void;
  onRemoveFolder: (id: string) => void;
  importedFolders: (LibraryFolder & { hasHandle: boolean })[];
  onManualFilesSelect?: (files: FileList) => void;
  onSyncFolder?: (id: string) => void;
  onUpdateWebdavFolder?: (id: string, config: { baseUrl: string; rootPath: string; username?: string; password?: string; name?: string }) => Promise<void>;
  onUpdateLibraryFolderName?: (id: string, newName: string) => Promise<void>;
  isImporting?: boolean;
  syncingFolderId?: string | null;
}

const ImportWindow: React.FC<ImportWindowProps> = ({ 
  isOpen, 
  onClose, 
  onFolderSelected, 
  onWebdavSelected,
  onTestWebdav,
  onReconnectFolder,
  onRemoveFolder, 
  importedFolders,
  onManualFilesSelect,
  onSyncFolder,
  onUpdateWebdavFolder,
  onUpdateLibraryFolderName,
  isImporting = false,
  syncingFolderId = null,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    folderId: string | null;
    folderName: string | null;
  }>({ isOpen: false, folderId: null, folderName: null });

  const [webdavModalOpen, setWebdavModalOpen] = useState(false);
  const [editingWebdavId, setEditingWebdavId] = useState<string | null>(null);
  const [webdavName, setWebdavName] = useState('');
  const [webdavBaseUrl, setWebdavBaseUrl] = useState('');
  const [webdavRootPath, setWebdavRootPath] = useState('/music');
  const [webdavUsername, setWebdavUsername] = useState('');
  const [webdavPassword, setWebdavPassword] = useState('');

  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

  const [testStatus, setTestStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
  }>({ loading: false });

  const [isBrowsing, setIsBrowsing] = useState(false);
  const [browsingFolders, setBrowsingFolders] = useState<any[]>([]);
  const [browsingPath, setBrowsingPath] = useState('');

  if (!isOpen) return null;

  const handleBrowse = async (path: string = '') => {
    if (!webdavBaseUrl.trim()) {
      setTestStatus({ loading: false, success: false, message: '请先填写服务器地址' });
      return;
    }
    setTestStatus({ loading: true, message: '正在加载目录...' });
    try {
      const folders = await window.windowBridge.webdavBrowse({
        baseUrl: webdavBaseUrl.trim(),
        pathname: path,
        username: webdavUsername || undefined,
        password: webdavPassword || undefined
      });
      // 只显示文件夹
      setBrowsingFolders(folders.filter((f: any) => f.isCollection));
      setBrowsingPath(path);
      setIsBrowsing(true);
      setTestStatus({ loading: false, message: undefined });
    } catch (err: any) {
      setTestStatus({ loading: false, success: false, message: err.message || '加载失败，请检查配置' });
    }
  };

  const handleSelectBrowsingFolder = (folderPath: string) => {
    setWebdavRootPath(folderPath);
    setIsBrowsing(false);
  };

  const handleGoBack = () => {
    if (!browsingPath || browsingPath === '/' || browsingPath === '.') {
      setIsBrowsing(false);
      return;
    }
    const parts = browsingPath.split('/').filter(Boolean);
    parts.pop();
    const parentPath = '/' + parts.join('/');
    handleBrowse(parentPath === '/' ? '' : parentPath);
  };

  const handleTestConnection = async () => {
    if (!onTestWebdav) return;
    setTestStatus({ loading: true });
    try {
      const result = await onTestWebdav({
        baseUrl: webdavBaseUrl.trim(),
        rootPath: webdavRootPath.trim() || '/',
        username: webdavUsername || undefined,
        password: webdavPassword || undefined
      });
      setTestStatus({
        loading: false,
        success: result.success,
        message: result.message
      });
    } catch (e) {
      setTestStatus({
        loading: false,
        success: false,
        message: '测试连接时发生错误'
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && onManualFilesSelect) {
      onManualFilesSelect(e.target.files);
    }
  };

  const handleImportClick = () => {
    if (importInputRef.current) importInputRef.current.click();
  };

  const handleReconnect = async (id: string) => {
    try {
      if (window.windowBridge?.openDirectory) {
        const folderPath = await window.windowBridge.openDirectory();
        if (!folderPath) return;
        if (onReconnectFolder) onReconnectFolder(id, folderPath);
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
        alert("曲库数据已导入！请在下方列表点击“重新关联”来激活您的音乐文件。");
        window.location.reload();
      } else {
        alert("备份文件无效。");
      }
    };
    reader.readAsText(file);
  };

  const handleRemoveClick = (folderId: string, folderName: string) => {
    setConfirmModalState({ isOpen: true, folderId, folderName });
  };

  const handleConfirmRemove = () => {
    if (confirmModalState.folderId) {
      onRemoveFolder(confirmModalState.folderId);
    }
    setConfirmModalState({ isOpen: false, folderId: null, folderName: null });
  };

  const handleCancelRemove = () => {
    setConfirmModalState({ isOpen: false, folderId: null, folderName: null });
  };

  const handleAddFolderClick = async () => {
    try {
      if (window.windowBridge?.openDirectory) {
        const folderPath = await window.windowBridge.openDirectory();
        if (!folderPath) return;
        onFolderSelected(folderPath);
        return;
      }

      if (!window.showDirectoryPicker) {
        throw new Error("showDirectoryPicker API is not supported.");
      }
      const handle = await window.showDirectoryPicker();
      onFolderSelected(handle);
    } catch (err) {
      console.warn("Modern directory picker failed, falling back to legacy input.", err);
      fileInputRef.current?.click();
    }
  };

  const canUseWebdav = !!onWebdavSelected;

  const handleOpenWebdav = () => {
    if (!canUseWebdav) return;
    setEditingWebdavId(null);
    setWebdavName('');
    setWebdavBaseUrl('');
    setWebdavRootPath('/music');
    setWebdavUsername('');
    setWebdavPassword('');
    setWebdavModalOpen(true);
    setTestStatus({ loading: false });
    setIsBrowsing(false);
  };

  const handleEditWebdav = (folder: any) => {
    if (!canUseWebdav) return;
    setEditingWebdavId(folder.id);
    setWebdavName(folder.name || '');
    setWebdavBaseUrl(folder.baseUrl || '');
    setWebdavRootPath(folder.rootPath || '/music');
    setWebdavUsername(folder.username || '');
    setWebdavPassword(folder.password || '');
    setWebdavModalOpen(true);
    setTestStatus({ loading: false });
    setIsBrowsing(false);
  };

  const handleRenameFolder = (folder: LibraryFolder) => {
    setRenamingFolderId(folder.id);
    setNewFolderName(folder.name);
    setRenameModalOpen(true);
  };

  const submitRename = async () => {
    if (renamingFolderId && newFolderName.trim() && onUpdateLibraryFolderName) {
      await onUpdateLibraryFolderName(renamingFolderId, newFolderName.trim());
      setRenameModalOpen(false);
      setRenamingFolderId(null);
      setNewFolderName('');
    }
  };

  const handleSubmitWebdav = async () => {
    const baseUrl = webdavBaseUrl.trim();
    const rootPath = webdavRootPath.trim() || '/';
    if (!baseUrl || !rootPath) return;

    const config = {
      name: webdavName.trim() || undefined,
      baseUrl,
      rootPath,
      username: webdavUsername || undefined,
      password: webdavPassword || undefined
    };

    if (editingWebdavId && onUpdateWebdavFolder) {
      await onUpdateWebdavFolder(editingWebdavId, config);
    } else if (onWebdavSelected) {
      await onWebdavSelected(config);
    }

    setWebdavModalOpen(false);
    setWebdavName('');
    setWebdavBaseUrl('');
    setWebdavRootPath('/music');
    setWebdavUsername('');
    setWebdavPassword('');
    setEditingWebdavId(null);
    setIsBrowsing(false);
  };

  return (
    <>
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title="确认移除文件夹"
        message={
          <>
            您确定要移除 <strong className="text-yellow-500 font-bold">{confirmModalState.folderName}</strong> 吗？
            <br />
            此操作将从曲库中删除该文件夹下的所有曲目记录，且无法恢复。
          </>
        }
        onConfirm={handleConfirmRemove}
        onCancel={handleCancelRemove}
        confirmText="确认移除"
      />
      {renameModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[110] animate-in fade-in duration-300 px-4">
          <div className="bg-[#181818] border border-white/10 rounded-[2.5rem] p-6 md:p-8 w-full max-w-[28rem] shadow-2xl relative overflow-hidden">
            <h2 className="text-xl font-black text-white tracking-tighter mb-4">重命名文件夹</h2>
            <div className="space-y-4">
              <div>
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">文件夹名称</div>
                <input 
                  autoFocus
                  value={newFolderName} 
                  onChange={(e) => setNewFolderName(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && submitRename()}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white focus:border-yellow-500/50 outline-none transition-all" 
                  placeholder="输入新名称" 
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setRenameModalOpen(false)} className="w-full bg-white/5 hover:bg-white/10 text-white py-3 rounded-full font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">
                  取消
                </button>
                <button onClick={submitRename} disabled={!newFolderName.trim()} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-3 rounded-full font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50">
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {webdavModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[110] animate-in fade-in duration-300 px-4">
          <div className="bg-[#181818] border border-white/10 rounded-[2.5rem] p-6 md:p-8 w-full max-w-[34rem] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tighter">{editingWebdavId ? '编辑 WebDAV' : '添加 WebDAV'}</h2>
                <p className="text-zinc-500 text-[10px] font-black mt-1 uppercase tracking-[0.2em]">
                  WebDAV {editingWebdavId ? 'Edit' : 'Import'}
                </p>
              </div>
              <button onClick={() => setWebdavModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all active:scale-90">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="space-y-3 relative z-10">
              {isBrowsing ? (
                <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden flex flex-col min-h-[300px] max-h-[400px]">
                  <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <button 
                        onClick={handleGoBack}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white shrink-0"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                      </button>
                      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 truncate">
                        {browsingPath || '根目录 /'}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {browsingFolders.length === 0 ? (
                      <div className="py-12 text-center text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                        没有发现子文件夹
                      </div>
                    ) : (
                      browsingFolders.map((folder) => (
                        <div 
                          key={folder.remotePath}
                          className="group flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all cursor-pointer border border-transparent hover:border-white/5"
                          onClick={() => handleBrowse(folder.remotePath)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                            </div>
                            <span className="text-sm text-white font-bold truncate">{folder.name}</span>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectBrowsingFolder(folder.remotePath);
                            }}
                            className="px-3 py-1.5 rounded-full bg-blue-500 text-black text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-400 active:scale-95"
                          >
                            选择此文件夹
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">名称（可选）</div>
                    <input value={webdavName} onChange={(e) => setWebdavName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white focus:border-blue-500/50 outline-none transition-all" placeholder="例如：家里 NAS WebDAV" />
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">服务器地址</div>
                    <input value={webdavBaseUrl} onChange={(e) => setWebdavBaseUrl(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white focus:border-blue-500/50 outline-none transition-all" placeholder="例如：https://example.com/remote.php/dav/files/user" />
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 flex justify-between items-center">
                      <span>根目录路径</span>
                      <button 
                        onClick={() => handleBrowse(webdavRootPath)}
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        浏览服务器目录
                      </button>
                    </div>
                    <input value={webdavRootPath} onChange={(e) => setWebdavRootPath(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white focus:border-blue-500/50 outline-none transition-all" placeholder="/music 或 /Music" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">用户名</div>
                      <input value={webdavUsername} onChange={(e) => setWebdavUsername(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white focus:border-blue-500/50 outline-none transition-all" />
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">密码</div>
                      <input type="password" value={webdavPassword} onChange={(e) => setWebdavPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white focus:border-blue-500/50 outline-none transition-all" />
                    </div>
                  </div>
                </>
              )}
            </div>

            {testStatus.message && (
              <div className={`mt-4 px-4 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${testStatus.success ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${testStatus.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {testStatus.message}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 relative z-10">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setWebdavModalOpen(false)} className="w-full bg-white/5 hover:bg-white/10 text-white py-4 rounded-full font-black text-xs uppercase tracking-widest active:scale-95 transition-all">
                  取消
                </button>
                <button 
                  onClick={handleTestConnection} 
                  disabled={testStatus.loading || !webdavBaseUrl.trim()} 
                  className="w-full bg-white/5 hover:bg-white/10 text-white py-4 rounded-full font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {testStatus.loading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {testStatus.loading ? '测试中...' : '检查连接状态'}
                </button>
              </div>
              <button onClick={handleSubmitWebdav} disabled={isImporting || !webdavBaseUrl.trim() || !webdavRootPath.trim()} className="w-full bg-blue-500 hover:bg-blue-400 text-black py-4 rounded-full font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50">
                {editingWebdavId ? '保存修改' : '连接并导入'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] animate-in fade-in duration-300 px-4">
        <div className="bg-[#181818] border border-white/10 rounded-[2.5rem] p-6 md:p-8 w-full max-w-[34rem] max-h-[85vh] shadow-2xl relative overflow-hidden flex flex-col">
          
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
          
          <div className="flex justify-between items-start mb-6 relative z-10 shrink-0">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tighter">管理路径记录</h2>
              <p className="text-zinc-500 text-[10px] font-black mt-1 uppercase tracking-[0.2em]">
                Managed Folders ({importedFolders.length})
              </p>
            </div>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all active:scale-90">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mb-6 min-h-0 relative z-10">
            {importedFolders.length > 0 ? (
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
                        {!isCurrentlySyncing && (
                          <button 
                            onClick={() => {
                              if (folder.baseUrl) handleEditWebdav(folder);
                              else handleRenameFolder(folder);
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-full text-zinc-700 hover:text-blue-500 hover:bg-blue-500/10 transition-all"
                            title="编辑"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                          </button>
                        )}
                        {isDisconnected ? (
                            <button 
                                onClick={() => handleReconnect(folder.id)}
                                className="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[9px] font-black uppercase tracking-tighter transition-colors"
                            >
                                修复
                            </button>
                        ) : (isPending || isCurrentlySyncing) ? (
                            <button 
                                onClick={() => onSyncFolder?.(folder.id)}
                                disabled={isImporting}
                                className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all text-[9px] font-black uppercase tracking-tighter ${isCurrentlySyncing ? 'bg-yellow-500 text-black' : 'bg-yellow-500/10 hover:bg-yellow-500 text-yellow-500 hover:text-black border border-yellow-500/20 active:scale-95'}`}
                            >
                                {isCurrentlySyncing && <div className="w-2 h-2 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                                {isCurrentlySyncing ? '正在同步' : '继续同步'}
                            </button>
                        ) : null}
                        {!isCurrentlySyncing && (
                          <button onClick={() => handleRemoveClick(folder.id, folder.name)} className="w-7 h-7 flex items-center justify-center rounded-full text-zinc-700 hover:text-red-500 hover:bg-red-500/10 transition-all">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2rem] text-zinc-700 bg-black/20">
                <div className="p-4 bg-white/5 rounded-full mb-3">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93l-2.73-2.73A2 2 0 0 0 8.07 2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z"/></svg>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">暂无路径记录</p>
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

            <div className="space-y-3">
              <button 
                onClick={handleAddFolderClick} 
                disabled={isImporting}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-4 rounded-full font-black text-sm active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3 group disabled:opacity-50"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="group-hover:rotate-90 transition-transform"><path d="M12 5v14M5 12h14"/></svg>
                添加新的音乐文件夹
              </button>
              <button
                onClick={handleOpenWebdav}
                disabled={isImporting || !canUseWebdav}
                className="w-full bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-black border border-blue-500/20 py-4 rounded-full font-black text-sm active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4 12h16M12 4v16"/></svg>
                添加 WebDAV
              </button>
              <div className="px-4 py-2.5 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                <p className="text-center text-[8px] text-blue-400/70 font-black uppercase tracking-widest">
                  💡 支持文件夹层级递归扫描，支持断点增量同步。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ImportWindow;
