import ePub from 'epubjs';
import * as pdfjsLib from 'pdfjs-dist';

import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure the pdfjs web worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const coverService = {
  /**
   * Extracts cover image from EPUB file buffer
   */
  async extractEpubCover(arrayBuffer: ArrayBuffer): Promise<Blob | null> {
    let bookInstance: any = null;
    try {
      bookInstance = ePub(arrayBuffer);
      await bookInstance.opened;
      const coverUrl = await bookInstance.coverUrl();
      if (!coverUrl) return null;
      
      const response = await fetch(coverUrl);
      if (!response.ok) return null;
      
      return await response.blob();
    } catch (err) {
      console.error('Error extracting EPUB cover:', err);
      return null;
    } finally {
      if (bookInstance) {
        try {
          bookInstance.destroy();
        } catch (e) {
          console.warn('Error destroying book instance in cover extractor:', e);
        }
      }
    }
  },

  /**
   * Extracts cover image from PDF file buffer (renders page 1 to canvas)
   */
  async extractPdfCover(arrayBuffer: ArrayBuffer): Promise<Blob | null> {
    try {
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      if (pdfDoc.numPages === 0) return null;
      
      const page = await pdfDoc.getPage(1);
      
      // Render to thumbnail size (width ~ 280px for layout sharpness)
      const viewport = page.getViewport({ scale: 0.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      const context = canvas.getContext('2d');
      if (!context) return null;
      
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas
      }).promise;
      
      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 0.85); // Compress as JPEG at 80-85% quality
      });
    } catch (err) {
      console.error('Error extracting PDF cover:', err);
      return null;
    }
  }
};
