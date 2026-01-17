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

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, size, size);

    const tracksWithCover = tracks.filter(t => t.coverBlob || t.coverUrl);

    if (tracksWithCover.length === 0) {
      ctx.fillStyle = '#222';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 120px sans-serif';
      ctx.fillText('♪', size / 2, size / 2);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas to Blob failed')), 'image/jpeg', 0.85);
      return;
    }

    const selectedTracks: Track[] = [];
    const seenFolderIds = new Set<string>();
    const seenFingerprints = new Set<string>();

    for (const track of tracksWithCover) {
      const fp = track.fingerprint || '';
      const folderId = track.folderId || '';

      if (seenFingerprints.has(fp)) continue;

      if (folderId && seenFolderIds.has(folderId)) {
        continue;
      }

      seenFingerprints.add(fp);
      if (folderId) {
        seenFolderIds.add(folderId);
      }
      selectedTracks.push(track);

      if (selectedTracks.length >= 4) break;
    }

    if (selectedTracks.length < 4) {
      for (const track of tracksWithCover) {
        const fp = track.fingerprint || '';
        if (seenFingerprints.has(fp)) continue;

        seenFingerprints.add(fp);
        selectedTracks.push(track);
        if (selectedTracks.length >= 4) break;
      }
    }

    const coverUrls = selectedTracks.slice(0, 4).map(t => t.coverUrl).filter((url): url is string => Boolean(url));

    const images = coverUrls.map(url => {
      return new Promise<HTMLImageElement>((res) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => res(new Image());
        img.src = url;
        setTimeout(() => res(new Image()), 2000);
      });
    });

    Promise.all(images).then(loadedImages => {
      const validImages = loadedImages.filter(img => img.width > 0);
      const count = validImages.length;

      if (count === 0) {
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