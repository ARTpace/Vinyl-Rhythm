
import { useState, useEffect } from 'react';

export const useThemeColor = (coverUrl?: string) => {
  const [rhythmColor, setRhythmColor] = useState('rgba(234, 179, 8, 1)');

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
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          setRhythmColor(brightness < 40 ? `rgba(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)}, 1)` : `rgba(${r}, ${g}, ${b}, 1)`);
        }
      };
      img.onerror = () => setRhythmColor('rgba(234, 179, 8, 1)');
    } else {
      setRhythmColor('rgba(234, 179, 8, 1)');
    }
  }, [coverUrl]);

  return { rhythmColor };
};
