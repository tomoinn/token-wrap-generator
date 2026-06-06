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
    fontSize: number = PAWN_NAME_HEIGHT * 10,
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

    ctx.font = `${fontWeight} ${fontSize}px sans-serif`;
    const metrics = ctx.measureText(text);

    // 1mm is approximately 10px if height is PAWN_NAME_HEIGHT mm and fontSize is PAWN_NAME_HEIGHT * 10 px.
    const paddingPx = (fontSize / 6); // ~0.5mm if fontSize is 30px
    
    // Calculate dimensions
    const width = Math.ceil(metrics.width + strokeWidth * 2 + paddingPx * 2);
    const height = Math.ceil(fontSize * 1.2 + strokeWidth * 2);

    canvas.width = width;
    canvas.height = height;

    // Set font again after resizing canvas
    ctx.font = `${fontWeight} ${fontSize}px sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    // Stroke
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, width / 2, height / 2);

    // Fill
    ctx.fillStyle = fontColor;
    ctx.fillText(text, width / 2, height / 2);

    return canvas.toDataURL('image/png');
};
