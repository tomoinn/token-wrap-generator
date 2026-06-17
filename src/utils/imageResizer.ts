import { PAWN_SIZES } from '../models/Settings';

const DPI = 180;
const MM_PER_INCH = 25.4;
const PIXELS_PER_MM = DPI / MM_PER_INCH;

// Find the largest pawn dimensions
const largestPawn = Object.values(PAWN_SIZES).reduce((max, size) => {
    return {
        width: Math.max(max.width, size.width),
        height: Math.max(max.height, size.height)
    };
}, { width: 0, height: 0 });

const MAX_WIDTH = Math.ceil(largestPawn.width * PIXELS_PER_MM);
const MAX_HEIGHT = Math.ceil(largestPawn.height * PIXELS_PER_MM);

/**
 * Finds the bounding box of non-transparent pixels in an image.
 */
function getTrimmedBoundingBox(img: HTMLImageElement): { x: number, y: number, width: number, height: number } {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { x: 0, y: 0, width: img.width, height: img.height };

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const alpha = data[(y * canvas.width + x) * 4 + 3];
            if (alpha > 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                found = true;
            }
        }
    }

    if (!found) {
        return { x: 0, y: 0, width: img.width, height: img.height };
    }

    return {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
    };
}

/**
 * Resizes an image if it is a File and exceeds the maximum dimensions for the configured DPI at the largest token size.
 * Images loaded from URLs are returned as-is.
 * @param source - The source File or URL string.
 * @returns A Promise that resolves to the resized File or the original source if no resizing was needed or possible.
 */
export async function resizeImageIfNeeded(source: File | string): Promise<File | string> {
    // Only resize files dragged into the page (instance of File)
    // Never resize images loaded from a URL
    if (!(source instanceof File)) {
        return source;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        
        const url = URL.createObjectURL(source);
        
        img.onload = () => {
            URL.revokeObjectURL(url);

            let trimRect;
            try {
                trimRect = getTrimmedBoundingBox(img);
            } catch (e) {
                // If it fails (likely due to CORS "tainted canvas"), continue without trimming/resizing
                // or at least resolve with the original source.
                console.warn('Could not trim/resize image due to CORS/Security restrictions', e);
                resolve(source);
                return;
            }
            
            if (img.width <= MAX_WIDTH && img.height <= MAX_HEIGHT && 
                trimRect.width === img.width && trimRect.height === img.height) {
                resolve(source);
                return;
            }
            
            // Calculate new dimensions maintaining aspect ratio of the trimmed image
            const aspectRatio = trimRect.width / trimRect.height;
            let newWidth = trimRect.width;
            let newHeight = trimRect.height;
            
            if (newWidth > MAX_WIDTH) {
                newWidth = MAX_WIDTH;
                newHeight = newWidth / aspectRatio;
            }
            
            if (newHeight > MAX_HEIGHT) {
                newHeight = MAX_HEIGHT;
                newWidth = newHeight * aspectRatio;
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('Failed to get canvas context for resizing');
                resolve(source);
                return;
            }
            
            // Fill with white background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, newWidth, newHeight);
            
            try {
                ctx.drawImage(img, trimRect.x, trimRect.y, trimRect.width, trimRect.height, 0, 0, newWidth, newHeight);
                
                // Use JPEG as the representation after resizing images.
                // Since we fill with a white background, transparency is no longer needed.
                const mimeType = 'image/jpeg';

                canvas.toBlob((blob) => {
                    if (blob) {
                        const originalName = source.name;
                        // Ensure the file extension matches the JPEG format
                        const fileName = originalName.replace(/\.[^/.]+$/, "") + ".jpg";
                        const resizedFile = new File([blob], fileName, { type: mimeType });
                        resolve(resizedFile);
                    } else {
                        console.error('Failed to create blob for resized image');
                        resolve(source);
                    }
                }, mimeType, 0.9);
            } catch (e) {
                console.warn('Failed to draw/export resized image (likely CORS)', e);
                resolve(source);
            }
        };
        
        img.onerror = (err) => {
            console.error('Failed to load image for resizing:', url, err);
            URL.revokeObjectURL(url);
            // Resolve with original source instead of rejecting to keep app working
            resolve(source);
        };
        
        img.src = url;
    });
}
