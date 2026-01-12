
import React, { useState, useRef, useEffect, ReactNode } from 'react';

interface SwipeableTrackProps {
  children: ReactNode;
  onNext: () => void;
  onPrev: () => void;
  currentId: string;
}

const SwipeableTrack: React.FC<SwipeableTrackProps> = ({ children, onNext, onPrev, currentId }) => {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const startX = useRef(0);
  const exitDirection = useRef<'left' | 'right' | null>(null);
  const prevId = useRef(currentId);

  // 监听 ID 变化处理入场动画
  useEffect(() => {
    if (currentId !== prevId.current) {
      if (exitDirection.current) {
        // 这是一个由拖拽触发的切换，执行入场动画
        setIsAnimating(false); // 关闭动画以便瞬移
        // 如果是向左滑出的(Next)，新卡片应该从右边(正值)滑入
        const startPos = exitDirection.current === 'left' ? window.innerWidth : -window.innerWidth;
        setOffset(startPos);
        
        // 强制重绘，确保瞬移生效后再开启动画
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsAnimating(true);
            setOffset(0);
            exitDirection.current = null;
          });
        });
      } else {
        // 如果是外部触发（如按钮点击），我们重置位置以防万一
        setOffset(0);
      }
      prevId.current = currentId;
    }
  }, [currentId]);

  const handlePointerDown = (e: React.PointerEvent) => {
    // 防止多指触控干扰
    if (!e.isPrimary) return;
    
    setIsDragging(true);
    setIsAnimating(false);
    startX.current = e.clientX;
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const diff = e.clientX - startX.current;
    setOffset(diff);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    setIsAnimating(true);
    (e.target as Element).releasePointerCapture(e.pointerId);

    const threshold = Math.min(window.innerWidth * 0.25, 150); // 触发阈值

    if (offset < -threshold) {
      // 向左滑动 -> 下一首
      setOffset(-window.innerWidth * 1.5); // 滑出屏幕
      exitDirection.current = 'left';
      // 等待滑出动画完成后触发切换
      setTimeout(() => {
         onNext();
      }, 300);
    } else if (offset > threshold) {
      // 向右滑动 -> 上一首
      setOffset(window.innerWidth * 1.5); // 滑出屏幕
      exitDirection.current = 'right';
      setTimeout(() => {
         onPrev();
      }, 300);
    } else {
      // 未达到阈值，回弹
      setOffset(0);
    }
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="touch-none cursor-grab active:cursor-grabbing relative z-20 flex items-center justify-center w-full outline-none"
      style={{
        transform: `translate3d(${offset}px, 0, 0) rotate(${offset * 0.03}deg)`,
        opacity: Math.max(0, 1 - Math.abs(offset) / (window.innerWidth * 0.8)),
        transition: isAnimating ? 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.4s' : 'none'
      }}
    >
      {children}
    </div>
  );
};

export default SwipeableTrack;
