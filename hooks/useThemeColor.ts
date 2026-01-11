
import { useState, useEffect } from 'react';

export interface ThemeColors {
  rhythmColor: string;
  gradientFrom: string;
  gradientTo: string;
  isDark: boolean;
}

export const useThemeColor = (coverUrl?: string): ThemeColors => {
  const [colors, setColors] = useState<ThemeColors>({
    rhythmColor: 'rgba(234, 179, 8, 1)',
    gradientFrom: 'rgba(28, 28, 28, 1)',
    gradientTo: 'rgba(10, 10, 10, 1)',
    isDark: true
  });

  useEffect(() => {
    if (coverUrl) {
      const img = new Image();
      img.src = coverUrl;
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = 1; canvas.height = 1;
          ctx.drawImage(img, 0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          
          // 计算亮度
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          const isDark = brightness < 128;

          // 基础节奏色（确保可见度）
          const rhythmColor = brightness < 40 
            ? `rgba(${Math.min(255, r + 60)}, ${Math.min(255, g + 60)}, ${Math.min(255, b + 60)}, 1)` 
            : `rgba(${r}, ${g}, ${b}, 1)`;

          setColors({
            rhythmColor,
            gradientFrom: `rgba(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)}, 0.4)`,
            gradientTo: `rgba(${Math.max(0, r - 60)}, ${Math.max(0, g - 60)}, ${Math.max(0, b - 60)}, 0.8)`,
            isDark
          });
        }
      };
      img.onerror = () => setColors({
        rhythmColor: 'rgba(234, 179, 8, 1)',
        gradientFrom: 'rgba(28, 28, 28, 1)',
        gradientTo: 'rgba(10, 10, 10, 1)',
        isDark: true
      });
    }
  }, [coverUrl]);

  return colors;
};
