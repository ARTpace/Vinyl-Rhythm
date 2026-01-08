
import { Buffer } from 'buffer';

// 立即注入全局对象，必须在所有其他 import 之前
(window as any).Buffer = Buffer;
(window as any).global = window;

// 使用 (window as any) 避免 TypeScript 编译错误，因为标准的 window 对象不包含 process 属性
if (!(window as any).process) {
  (window as any).process = { env: {} };
}
if (!(window as any).process.env) {
  (window as any).process.env = {};
}
(window as any).process.browser = true;
(window as any).process.version = '';
(window as any).process.nextTick = (fn: any) => setTimeout(fn, 0);

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
