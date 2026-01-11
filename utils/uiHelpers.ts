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

    const coverUrls = [...new Set(tracks.map(t => t.coverUrl).filter(Boolean))].slice(0, 4) as string[];

    if (coverUrls.length === 0) {
      // Draw a default placeholder if no covers are available
      ctx.fillStyle = '#333';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 100px sans-serif';
      ctx.fillText('♪', size / 2, size / 2);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas to Blob failed')), 'image/jpeg', 0.9);
      return;
    }

    const images = coverUrls.map(url => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      return new Promise<HTMLImageElement>((res, rej) => {
        img.onload = () => res(img);
        img.onerror = () => res(new Image()); // Resolve with an empty image on error to not break Promise.all
      });
    });

    Promise.all(images).then(loadedImages => {
      const validImages = loadedImages.filter(img => img.width > 0);
      const count = validImages.length;
      
      if (count === 1) {
        ctx.drawImage(validImages[0], 0, 0, size, size);
      } else if (count === 2) {
        ctx.drawImage(validImages[0], 0, 0, size / 2, size);
        ctx.drawImage(validImages[1], size / 2, 0, size / 2, size);
      } else if (count === 3) {
        ctx.drawImage(validImages[0], 0, 0, size / 2, size);
        ctx.drawImage(validImages[1], size / 2, 0, size / 2, size / 2);
        ctx.drawImage(validImages[2], size / 2, size / 2, size / 2, size / 2);
      } else if (count === 4) {
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
      }, 'image/jpeg', 0.9);
    });
  });
};