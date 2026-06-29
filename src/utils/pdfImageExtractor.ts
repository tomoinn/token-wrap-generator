import { PDFParse } from 'pdf-parse';

// Configure the worker for pdf-parse (which uses pdfjs-dist internally)
// Version 5.4.296 is the one used by pdf-parse 2.4.5
PDFParse.setWorker('https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs');

export interface ExtractedPdfImage {
  id: string;
  name: string;
  file: File;
  previewUrl: string;
}

const dataURLtoFile = (dataurl: string, filename: string): File => {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

export const extractImagesFromPdfFile = async (pdfFile: File): Promise<ExtractedPdfImage[]> => {
  console.info('[pdfImageExtractor] Starting extraction from file using pdf-parse:', pdfFile.name);
  
  const bytes = await pdfFile.arrayBuffer();
  
  const parser = new PDFParse({ data: bytes });
  try {
    const info = await parser.getInfo();
    const totalPages = info.total;
    console.info(`[pdfImageExtractor] PDF has ${totalPages} pages.`);

    const results: ExtractedPdfImage[] = [];
    const baseName = pdfFile.name.replace(/\.pdf$/i, '');

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        const imageResult = await parser.getImage({ 
          partial: [pageNum],
          imageThreshold: 16,
          imageDataUrl: true,
          imageBuffer: false 
        });

        imageResult.pages.forEach((page) => {
          page.images.forEach((img, imgIndex) => {
            const imageName = `${baseName}-p${page.pageNumber}-img${imgIndex + 1}.png`;
            const file = dataURLtoFile(img.dataUrl, imageName);
            
            results.push({
              id: `${page.pageNumber}-${imgIndex + 1}`,
              name: imageName,
              file,
              previewUrl: URL.createObjectURL(file)
            });
          });
        });
      } catch (pageError) {
        console.warn(`[pdfImageExtractor] Failed to extract images from page ${pageNum}:`, pageError);
      }
    }

    console.info(`[pdfImageExtractor] Extraction finished, found ${results.length} images.`);
    return results;
  } finally {
    await parser.destroy();
  }
};