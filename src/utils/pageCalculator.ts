import {type Pawn} from '../models/Pawn';
import {PAWN_SIZES, SPACER_BAR_HEIGHT} from '../models/Settings';

export interface PawnMetadata {
    isFirstInRow: boolean;
    isSameSizeAsPrevious: boolean;
    isLastInRow: boolean;
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
    const minRemainingSpaceForLastInRowMm = appGapMm;
    const verticalGapMm = 5 / 96 * 25.4; // 5px gap between rows
    const pawnBorderWidthMm = 0.265; // matches CSS overlap used by same-size-as-previous

    const newPages: Page[] = [];
    let currentPagePawns: Pawn[] = [];
    let currentPageMetadata = new Map<string, PawnMetadata>();

    let currentRowWidth = 0;
    let currentRowHeight = 0;
    let totalHeightUsed = 0;
    let isFirstRowOnPage = true;
    let currentRowIndex = 0;
    let pawnsInCurrentRow: string[] = [];

    const markLastInCurrentRow = () => {
        const remainingSpace = containerWidth - currentRowWidth;
        if (remainingSpace + 0.1 < minRemainingSpaceForLastInRowMm) return;

        const lastPawnId = pawnsInCurrentRow[pawnsInCurrentRow.length - 1];
        if (!lastPawnId) return;
        const meta = currentPageMetadata.get(lastPawnId);
        if (meta) meta.isLastInRow = true;
    };

    const finalizePage = () => {
        if (currentPagePawns.length > 0) {
            markLastInCurrentRow();
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
        const width = pSize.width;
        const height = (pSize.height * 2) + SPACER_BAR_HEIGHT;

        const prevPawn = index > 0 ? pawns[index - 1] : null;
        let horizontalGap = appGapMm;
        if (prevPawn && prevPawn.size === pawn.size && currentRowWidth > 0) {
            horizontalGap = -pawnBorderWidthMm;
        }
        const effectiveWidth = currentRowWidth === 0 ? width : width + horizontalGap;

        console.debug('[Layout] Row width calculation', {
            pawnId: pawn.id,
            pawnName: pawn.pawnName || pawn.name,
            pawnSize: pawn.size,
            rowIndex: currentRowIndex,
            containerWidth,
            currentRowWidth,
            pawnBaseWidth: width,
            horizontalGap,
            effectiveWidth,
            projectedRowWidth: currentRowWidth + effectiveWidth
        });

        let isFirst = false;
        let isSameSize = false;

        // Check if it fits in current row
        if (currentRowWidth > 0 && currentRowWidth + effectiveWidth > containerWidth + 0.1) {
            markLastInCurrentRow();
            console.debug('[Layout] Starting new row', {
                pawnId: pawn.id,
                pawnName: pawn.pawnName || pawn.name,
                previousRowIndex: currentRowIndex,
                previousRowWidth: currentRowWidth,
                attemptedWidth: currentRowWidth + effectiveWidth,
                containerWidth
            });
            // Move to next row
            totalHeightUsed += currentRowHeight + (isFirstRowOnPage ? 0 : verticalGapMm);
            isFirstRowOnPage = false;
            currentRowWidth = 0;
            currentRowHeight = 0;
            currentRowIndex += 1;
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
            isLastInRow: false,
            isLastRow: false,
            x: currentX,
            y: currentY
        });
        pawnsInCurrentRow.push(pawn.id);

        const horizontalGapToApply = (currentRowWidth === 0) ? 0 : (isSameSize ? 0 : appGapMm);
        currentRowWidth += horizontalGapToApply + width;
        currentRowHeight = Math.max(currentRowHeight, height);

        console.debug('[Layout] Pawn positioned in row', {
            pawnId: pawn.id,
            pawnName: pawn.pawnName || pawn.name,
            pawnSize: pawn.size,
            rowIndex: currentRowIndex,
            x: currentX,
            y: currentY,
            width,
            height,
            currentRowWidth
        });
    });

    finalizePage();

    return newPages.length > 0 ? newPages : [{pawns: [], metadata: new Map()}];
};
