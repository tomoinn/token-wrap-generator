import {PAWN_NAME_HEIGHT} from '@/models/Settings';

/**
 * Renders a given text to a transparent PNG data URL.
 * @param text The text to render
 * @param fontSize The font size in pixels (or units)
 * @param fontWeight The font weight
 * @param fontColor The fill color of the text
 * @param strokeColor The stroke color of the text
 * @param strokeWidth The width of the text stroke
 * @returns A promise that resolves to a data URL
 */
export const renderTextToDataUrl = (
    text: string,
    maxLineHeight: number = PAWN_NAME_HEIGHT * 10,
    fontWeight: string = 'bold',
    fontColor: string = 'black',
    strokeColor: string = 'white',
    strokeWidth: number = 2
): string => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Could not get 2d context');
    }

    const fontSize = maxLineHeight / 1.2;
    ctx.font = `${fontWeight} ${fontSize}px sans-serif`;
    
    const lines = text.split('\n');
    let maxWidth = 0;
    for (const line of lines) {
        const metrics = ctx.measureText(line);
        maxWidth = Math.max(maxWidth, metrics.width);
    }

    const lineHeight = maxLineHeight;
    const paddingPx = (fontSize / 6);
    
    // Calculate dimensions
    const width = Math.ceil(maxWidth + strokeWidth * 2 + paddingPx * 2);
    const height = Math.ceil(lineHeight * lines.length + strokeWidth * 2);

    canvas.width = width;
    canvas.height = height;

    // Set font again after resizing canvas
    ctx.font = `${fontWeight} ${fontSize}px sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    lines.forEach((line, index) => {
        const y = (index + 0.5) * lineHeight + strokeWidth;
        
        // Stroke
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineJoin = 'round';
        ctx.strokeText(line, width / 2, y);

        // Fill
        ctx.fillStyle = fontColor;
        ctx.fillText(line, width / 2, y);
    });

    return canvas.toDataURL('image/png');
};
