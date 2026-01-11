import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  title?: string;
  defaultValue?: string;
  confirmText?: string;
}

const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title = "创建新歌单",
  defaultValue = "我的新歌单",
  confirmText = "确认创建"
}) => {
  const [name, setName] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(defaultValue);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(name.trim());
    }
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-[110] animate-in fade-in duration-300"
      onClick={onCancel}
    >
      <div
        className="bg-gradient-to-br from-[#222] to-[#111] border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl m-4 animate-in zoom-in-95 duration-500"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-black text-white tracking-tighter mb-5">{title}</h2>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-yellow-500/50 outline-none backdrop-blur-md transition-all mb-6"
            placeholder="请输入歌单名称"
          />
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-bold transition-colors active:scale-95"
            >
              取消
            </button>
            <button
              type="submit"
              className="bg-yellow-500 hover:bg-yellow-400 text-black py-3 rounded-xl font-bold transition-colors active:scale-95 shadow-lg shadow-yellow-900/40"
            >
              {confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default CreatePlaylistModal;