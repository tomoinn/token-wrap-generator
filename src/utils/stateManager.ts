import {Pawn} from '../models/Pawn';
import {type PaperSize} from '../models/Settings';

export interface StateExport {
    pawns: any[];
    images: Record<string, { name: string, type: string, data: string }>;
    settings: {
        selectedPaperSize: PaperSize;
        paperMargin: number;
    };
}

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const base64ToFile = (base64Data: string, filename: string, mimeType: string): File => {
    const arr = base64Data.split(',');
    const match = arr[0].match(/:(.*?);/);
    const mime = match ? match[1] : mimeType;
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type: mime});
};

export const exportState = async (
    pawns: Pawn[],
    selectedPaperSize: PaperSize,
    paperMargin: number
) => {
    const images: Record<string, { name: string, type: string, data: string }> = {};
    const imageMap = new Map<File | string, string>();

    // Synchronously identify all unique images and assign keys to avoid race conditions
    let imgCount = 0;
    pawns.forEach(pawn => {
        if (pawn.image instanceof File && !imageMap.has(pawn.image)) {
            const imageKey = `img_${imgCount++}`;
            imageMap.set(pawn.image, imageKey);
        }
    });

    // Now perform the async Base64 conversion for each unique image
    await Promise.all(
        Array.from(imageMap.entries()).map(async ([file, key]) => {
            if (file instanceof File) {
                images[key] = {
                    name: file.name,
                    type: file.type,
                    data: await fileToBase64(file)
                };
            }
        })
    );

    const exportedPawns = pawns.map((pawn) => {
        let imageKey: string;
        if (pawn.image instanceof File) {
            imageKey = imageMap.get(pawn.image)!;
        } else {
            imageKey = pawn.image;
        }

        return {
            ...pawn,
            image: imageKey
        };
    });

    const state: StateExport = {
        pawns: exportedPawns,
        images: images,
        settings: {
            selectedPaperSize,
            paperMargin
        }
    };

    const blob = new Blob([JSON.stringify(state, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pawns-state-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

export const importState = async (file: File): Promise<{
    pawns: Pawn[],
    settings: { selectedPaperSize: PaperSize, paperMargin: number }
} | null> => {
    try {
        const text = await file.text();
        const state = JSON.parse(text) as StateExport;

        let selectedPaperSize: PaperSize = 'A4';
        let paperMargin = 5;

        if (state.settings) {
            selectedPaperSize = state.settings.selectedPaperSize || 'A4';
            paperMargin = state.settings.paperMargin || 5;
        }

        const reconstructedImages = new Map<string, File>();
        if (state.images) {
            for (const [key, imgData] of Object.entries(state.images)) {
                reconstructedImages.set(key, base64ToFile(imgData.data, imgData.name, imgData.type));
            }
        }

        let pawns: Pawn[] = [];
        if (Array.isArray(state.pawns)) {
            pawns = state.pawns.map((p: any) => {
                let image = p.image;
                // Check if it's a key in our images map
                if (typeof p.image === 'string' && reconstructedImages.has(p.image)) {
                    image = reconstructedImages.get(p.image);
                } else if (p.image && typeof p.image === 'object' && p.image.data) {
                    // Fallback for old format
                    image = base64ToFile(p.image.data, p.image.name, p.image.type);
                }
                const pawn = new Pawn(image, p.name, p.size, p.colour, p.crop, p.index, p.showIndex, p.pawnName, p.startColourIndex || 0);
                pawn.id = p.id || pawn.id;
                return pawn;
            });
        }

        return {
            pawns,
            settings: {selectedPaperSize, paperMargin}
        };
    } catch (e) {
        console.error('Failed to import state:', e);
        throw new Error('Failed to import state. Please make sure the file is a valid JSON export.');
    }
};
