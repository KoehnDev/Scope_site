(() => {
  // Reduce downloaded Proposal PDF size while preserving full artwork resolution.
  // The proposal's live text/linework stays vector. Only the static full-page cover
  // may be encoded as a very-high-quality JPEG when that is materially smaller.
  // Interior artwork remains lossless PNG and is explicitly reused on every page.
  if (typeof exportPdf !== 'function') {
    console.warn('Proposal PDF size optimization skipped: exportPdf unavailable.');
    return;
  }
  if (window.__proposalPdfLosslessSizeOptimization === '2026-09-21-2') return;

  const coverCache = new Map();

  async function proposalPdfCoverDataUrl(src, fastPreview) {
    if (fastPreview) return imageToDataUrl(src);
    const key = String(src || '');
    if (coverCache.has(key)) return coverCache.get(key);

    const promise = (async () => {
      const pngData = await imageToDataUrl(key);
      try {
        const jpegData = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              const ctx = canvas.getContext('2d', { alpha: false });
              ctx.fillStyle = '#fff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              // Same pixel dimensions as the source artwork: no downsampling.
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              resolve(canvas.toDataURL('image/jpeg', 0.98));
            } catch (error) {
              reject(error);
            }
          };
          img.onerror = reject;
          img.src = pngData;
        });

        // Do not change encoding unless it produces a meaningful size reduction.
        // This keeps flat/vector-heavy covers as PNG when JPEG would not help.
        return jpegData && jpegData.length < pngData.length * 0.92 ? jpegData : pngData;
      } catch {
        return pngData;
      }
    })();

    coverCache.set(key, promise);
    try {
      return await promise;
    } catch (error) {
      coverCache.delete(key);
      throw error;
    }
  }

  let source = exportPdf.toString();
  let changed = 0;

  const replaceAllExact = (from, to) => {
    if (!source.includes(from)) return false;
    source = source.split(from).join(to);
    changed++;
    return true;
  };

  replaceAllExact(
    "imageToDataUrl(coverPaths[0])",
    "proposalPdfCoverDataUrl(coverPaths[0],fastPreview)"
  );
  replaceAllExact(
    "imageToDataUrl(coverPaths[1])",
    "proposalPdfCoverDataUrl(coverPaths[1],fastPreview)"
  );

  if (!replaceAllExact(
    "doc.addImage(coverData,'PNG',0,0,pageW,coverPageH,undefined,'FAST')",
    "doc.addImage(coverData,/^data:image\\/jpe?g/i.test(coverData)?'JPEG':'PNG',0,0,pageW,coverPageH,'proposal-cover-bg',fastPreview?'FAST':'MEDIUM')"
  )) {
    replaceAllExact(
      "doc.addImage(coverData,'PNG',0,0,pageW,coverPageH,undefined,fastPreview?'FAST':'SLOW')",
      "doc.addImage(coverData,/^data:image\\/jpe?g/i.test(coverData)?'JPEG':'PNG',0,0,pageW,coverPageH,'proposal-cover-bg',fastPreview?'FAST':'MEDIUM')"
    );
  }

  if (!replaceAllExact(
    "doc.addImage(interiorData,'PNG',0,0,pageW,pageH,undefined,'FAST')",
    "doc.addImage(interiorData,'PNG',0,0,pageW,pageH,'proposal-interior-bg',fastPreview?'FAST':'SLOW')"
  )) {
    replaceAllExact(
      "doc.addImage(interiorData,'PNG',0,0,pageW,pageH,undefined,fastPreview?'FAST':'SLOW')",
      "doc.addImage(interiorData,'PNG',0,0,pageW,pageH,'proposal-interior-bg',fastPreview?'FAST':'SLOW')"
    );
  }

  if (changed < 4) {
    console.warn('Proposal PDF size optimization found only', changed, 'of 4 expected hooks.');
  }

  try {
    const patchedExportPdf = eval(`(${source})`);
    exportPdf = patchedExportPdf;
    window.exportPdf = patchedExportPdf;

    const oldButton = document.getElementById('exportPdfBtn');
    if (oldButton) {
      const newButton = oldButton.cloneNode(true);
      newButton.dataset.losslessPdfSizeOptimized = 'true';
      oldButton.replaceWith(newButton);
      newButton.addEventListener('click', patchedExportPdf);
    }

    window.__proposalPdfLosslessSizeOptimization = '2026-09-21-2';
  } catch (error) {
    console.error('Proposal PDF size optimization failed.', error);
  }
})();