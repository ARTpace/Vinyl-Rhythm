
import React, { useState, useRef, useEffect, ReactNode } from 'react';

interface SwipeableTrackProps {
  children: ReactNode;
  onNext: () => void;
  onPrev: () => void;
  onTogglePlay?: () => void;
  currentId: string;
}

const SwipeableTrack: React.FC<SwipeableTrackProps> = ({ children, onNext, onPrev, onTogglePlay, currentId }) => {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const startX = useRef(0);
  const startTime = useRef(0);
  const exitDirection = useRef<'left' | 'right' | null>(null);
  const prevId = useRef(currentId);

  useEffect(() => {
    if (currentId !== prevId.current) {
      if (exitDirection.current) {
        setIsAnimating(false);
        const startPos = exitDirection.current === 'left' ? window.innerWidth : -window.innerWidth;
        setOffset(startPos);
        
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsAnimating(true);
            setOffset(0);
            exitDirection.current = null;
          });
        });
      } else {
        setOffset(0);
      }
      prevId.current = currentId;
    }
  }, [currentId]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    
    setIsDragging(true);
    setIsAnimating(false);
    startX.current = e.clientX;
    startTime.current = Date.now();
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const diff = e.clientX - startX.current;
    // 添加一点阻尼效果，拉动距离越长阻力越大
    const resistance = 0.8;
    setOffset(diff * resistance);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    setIsAnimating(true);
    (e.target as Element).releasePointerCapture(e.pointerId);

    const diff = e.clientX - startX.current;
    const time = Date.now() - startTime.current;
    const velocity = Math.abs(diff) / time; // 计算滑动速度

    const threshold = Math.min(window.innerWidth * 0.3, 120); 
    const isFastSwipe = velocity > 0.5 && Math.abs(diff) > 30; // 快速轻扫识别

    if (diff < -threshold || (diff < -30 && isFastSwipe)) {
      setOffset(-window.innerWidth * 1.2);
      exitDirection.current = 'left';
      setTimeout(onNext, 250);
    } else if (diff > threshold || (diff > 30 && isFastSwipe)) {
      setOffset(window.innerWidth * 1.2);
      exitDirection.current = 'right';
      setTimeout(onPrev, 250);
    } else {
      // 如果滑动距离极小，视为点击
      if (Math.abs(diff) < 5 && time < 200) {
        onTogglePlay?.();
      }
      setOffset(0);
    }
  };

  // 根据位移计算缩放和旋转，增加动感
  const scale = 1 - Math.min(Math.abs(offset) / window.innerWidth, 0.2);
  const rotate = offset * 0.05;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="touch-none cursor-grab active:cursor-grabbing relative z-20 flex items-center justify-center w-full outline-none select-none"
      style={{
        transform: `translate3d(${offset}px, 0, 0) rotate(${rotate}deg) scale(${scale})`,
        opacity: Math.max(0.3, 1 - Math.abs(offset) / (window.innerWidth * 0.7)),
        transition: isAnimating ? 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.4s' : 'none'
      }}
    >
      {children}
    </div>
  );
};

export default SwipeableTrack;
