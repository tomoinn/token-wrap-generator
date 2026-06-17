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
 * Resizes an image if it exceeds the maximum dimensions for the configured DPI at the largest token size.
 * @param source - The source File or URL string.
 * @returns A Promise that resolves to the resized File or the original source if no resizing was needed.
 */
export async function resizeImageIfNeeded(source: File | string): Promise<File | string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        const url = source instanceof File ? URL.createObjectURL(source) : source;
        
        img.onload = () => {
            if (source instanceof File) {
                URL.revokeObjectURL(url);
            }
            
            if (img.width <= MAX_WIDTH && img.height <= MAX_HEIGHT) {
                resolve(source);
                return;
            }
            
            // Calculate new dimensions maintaining aspect ratio
            let newWidth = img.width;
            let newHeight = img.height;
            
            if (newWidth > MAX_WIDTH) {
                newHeight = (MAX_WIDTH / newWidth) * newHeight;
                newWidth = MAX_WIDTH;
            }
            
            if (newHeight > MAX_HEIGHT) {
                newWidth = (MAX_HEIGHT / newHeight) * newWidth;
                newHeight = MAX_HEIGHT;
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }
            
            // Fill with white background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, newWidth, newHeight);
            
            ctx.drawImage(img, 0, 0, newWidth, newHeight);
            
            // Use JPEG as the representation after resizing images.
            // Since we fill with a white background, transparency is no longer needed.
            const mimeType = 'image/jpeg';

            canvas.toBlob((blob) => {
                if (blob) {
                    const originalName = source instanceof File ? source.name : 'resized-image.jpg';
                    // Ensure the file extension matches the JPEG format
                    const fileName = originalName.replace(/\.[^/.]+$/, "") + ".jpg";
                    const resizedFile = new File([blob], fileName, { type: mimeType });
                    resolve(resizedFile);
                } else {
                    reject(new Error('Failed to create blob'));
                }
            }, mimeType, 0.9);
        };
        
        img.onerror = () => {
            if (source instanceof File) {
                URL.revokeObjectURL(url);
            }
            reject(new Error('Failed to load image'));
        };
        
        img.src = url;
    });
}
