import {type Pawn} from '../models/Pawn';
import {PAWN_SIZES, SPACER_BAR_HEIGHT} from '../models/Settings';

export interface PawnMetadata {
    isFirstInRow: boolean;
    isSameSizeAsPrevious: boolean;
    isLastRow: boolean;
    x: number;
    y: number;
}

export interface Page {
    pawns: Pawn[];
    // Map from pawn ID to metadata
    metadata: Map<string, PawnMetadata>;
}

/**
 * Calculates the layout of pawns on multiple pages based on given dimensions and margins.
 *
 * @param pawns - Array of pawns to be laid out.
 * @param paperWidth - Width of the paper in mm.
 * @param paperHeight - Height of the paper in mm.
 * @param paperMargin - Margin around the paper in mm.
 * @returns An array of pages with their respective pawns and metadata.
 */
export const calculatePages = (
    pawns: Pawn[],
    paperWidth: number,
    paperHeight: number,
    paperMargin: number
): Page[] => {
    const padding = paperMargin; // mm
    const containerWidth = paperWidth - (padding * 2);
    const containerHeight = paperHeight - (padding * 2);
    const appGapMm = 10 / 96 * 25.4; // 10px in mm approx 2.645mm
    const verticalGapMm = 5 / 96 * 25.4; // 5px gap between rows
    const borderAdjustment = 0.5 / 72 * 25.4 * 2; // 0.5pt border on each side = 1pt total

    const newPages: Page[] = [];
    let currentPagePawns: Pawn[] = [];
    let currentPageMetadata = new Map<string, PawnMetadata>();

    let currentRowWidth = 0;
    let currentRowHeight = 0;
    let totalHeightUsed = 0;
    let isFirstRowOnPage = true;
    let pawnsInCurrentRow: string[] = [];

    const finalizePage = () => {
        if (currentPagePawns.length > 0) {
            // Mark pawns in the last row
            pawnsInCurrentRow.forEach(id => {
                const meta = currentPageMetadata.get(id);
                if (meta) meta.isLastRow = true;
            });
            newPages.push({pawns: currentPagePawns, metadata: currentPageMetadata});
        }
    };

    pawns.forEach((pawn, index) => {
        const pSize = PAWN_SIZES[pawn.size];
        const width = pSize.width + borderAdjustment;
        const height = (pSize.height * 2) + SPACER_BAR_HEIGHT + borderAdjustment;

        const prevPawn = index > 0 ? pawns[index - 1] : null;
        let horizontalGap = appGapMm;
        if (prevPawn && prevPawn.size === pawn.size && currentRowWidth > 0) {
            horizontalGap = 0;
        }
        const effectiveWidth = currentRowWidth === 0 ? width : width + horizontalGap;

        let isFirst = false;
        let isSameSize = false;

        // Check if it fits in current row
        if (currentRowWidth > 0 && currentRowWidth + effectiveWidth > containerWidth + 0.1) {
            // Move to next row
            totalHeightUsed += currentRowHeight + (isFirstRowOnPage ? 0 : verticalGapMm);
            isFirstRowOnPage = false;
            currentRowWidth = 0;
            currentRowHeight = 0;
            isFirst = true;
            pawnsInCurrentRow = [];
        } else if (currentRowWidth === 0) {
            isFirst = true;
        } else {
            isSameSize = prevPawn?.size === pawn.size;
        }

        // Check if it fits in current page
        const rowGapToApply = (isFirstRowOnPage && currentRowWidth === 0) ? 0 : verticalGapMm;
        const heightWithPotentialGap = height + rowGapToApply;

        if (totalHeightUsed + heightWithPotentialGap > containerHeight + 0.1) {
            finalizePage();
            currentPagePawns = [];
            currentPageMetadata = new Map();
            totalHeightUsed = 0;
            currentRowWidth = 0;
            currentRowHeight = 0;
            isFirstRowOnPage = true;
            isFirst = true;
            isSameSize = false;
            pawnsInCurrentRow = [];
        }

        const currentX = padding + currentRowWidth + (currentRowWidth === 0 ? 0 : (isSameSize ? 0 : appGapMm));
        const currentY = padding + totalHeightUsed + (isFirstRowOnPage ? 0 : verticalGapMm);

        currentPagePawns.push(pawn);
        currentPageMetadata.set(pawn.id, {
            isFirstInRow: isFirst,
            isSameSizeAsPrevious: isSameSize,
            isLastRow: false,
            x: currentX,
            y: currentY
        });
        pawnsInCurrentRow.push(pawn.id);

        const horizontalGapToApply = (currentRowWidth === 0) ? 0 : (isSameSize ? 0 : appGapMm);
        currentRowWidth += horizontalGapToApply + width;
        currentRowHeight = Math.max(currentRowHeight, height);
    });

    finalizePage();

    return newPages.length > 0 ? newPages : [{pawns: [], metadata: new Map()}];
};
