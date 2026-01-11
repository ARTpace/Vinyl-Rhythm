import { Track } from '../types';

/**
 * Dynamically generates a composite cover image for a playlist.
 * It takes the first four unique track covers and arranges them in a 2x2 grid.
 * @param tracks - The array of tracks in the playlist.
 * @returns A Promise that resolves to a Blob of the generated cover image.
 */
export const generateCompositeCover = (tracks: Track[]): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const size = 500;
    canvas.width = size;
    canvas.height = size;

    if (!ctx) {
      return reject(new Error('Canvas context not available'));
    }

    // Default background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, size, size);

    // Get unique covers from the tracks
    const coverUrls = [...new Set(tracks.map(t => t.coverUrl).filter(Boolean))].slice(0, 4) as string[];

    if (coverUrls.length === 0) {
      // Draw a default placeholder if no covers are available
      ctx.fillStyle = '#222';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 120px sans-serif';
      ctx.fillText('♪', size / 2, size / 2);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas to Blob failed')), 'image/jpeg', 0.85);
      return;
    }

    const images = coverUrls.map(url => {
      return new Promise<HTMLImageElement>((res) => {
        const img = new Image();
        // NOTE: Do NOT use crossOrigin for blob: urls as it can cause loading failures
        img.onload = () => res(img);
        img.onerror = () => res(new Image()); // Resolve with an empty image on error
        img.src = url;
        
        // Timeout safeguard
        setTimeout(() => res(new Image()), 2000);
      });
    });

    Promise.all(images).then(loadedImages => {
      const validImages = loadedImages.filter(img => img.width > 0);
      const count = validImages.length;
      
      if (count === 0) {
        // Fallback if images failed to load
        ctx.fillStyle = '#222';
        ctx.fillText('♪', size / 2, size / 2);
      } else if (count === 1) {
        ctx.drawImage(validImages[0], 0, 0, size, size);
      } else if (count === 2) {
        ctx.drawImage(validImages[0], 0, 0, size / 2, size);
        ctx.drawImage(validImages[1], size / 2, 0, size / 2, size);
      } else if (count === 3) {
        ctx.drawImage(validImages[0], 0, 0, size / 2, size);
        ctx.drawImage(validImages[1], size / 2, 0, size / 2, size / 2);
        ctx.drawImage(validImages[2], size / 2, size / 2, size / 2, size / 2);
      } else {
        const s = size / 2;
        ctx.drawImage(validImages[0], 0, 0, s, s);
        ctx.drawImage(validImages[1], s, 0, s, s);
        ctx.drawImage(validImages[2], 0, s, s, s);
        ctx.drawImage(validImages[3], s, s, s, s);
      }

      canvas.toBlob(blob => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      }, 'image/jpeg', 0.85);
    }).catch(err => {
      reject(err);
    });
  });
};