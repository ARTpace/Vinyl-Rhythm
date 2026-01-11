import React from 'react';
import ReactDOM from 'react-dom';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = "确认",
  cancelText = "取消"
}) => {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-[110] animate-in fade-in duration-300"
      onClick={onCancel}
    >
      <div 
        className="bg-gradient-to-br from-[#222] to-[#111] border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl m-4 animate-in zoom-in-95 duration-500"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-tighter">{title}</h2>
            <div className="text-zinc-400 text-sm mt-2 leading-relaxed">{message}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-8">
          <button 
            onClick={onCancel} 
            className="bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-bold transition-colors active:scale-95"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm} 
            className="bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-bold transition-colors active:scale-95 shadow-lg shadow-red-900/40"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;
