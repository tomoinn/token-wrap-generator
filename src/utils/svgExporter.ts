import { type Pawn } from '../models/Pawn';
import { PAWN_SIZES, SPACER_BAR_HEIGHT } from '../models/Settings';
import type { Page } from './pageCalculator';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const exportToSVG = async (
  pawns: Pawn[],
  pages: Page[],
  paperWidth: number,
  paperHeight: number
) => {
  const imageMap = new Map<File | string, string>();

  // Identify all unique images and convert to Base64
  for (const pawn of pawns) {
    const imgSource = pawn.image;
    if (!imageMap.has(imgSource)) {
      if (imgSource instanceof File) {
        imageMap.set(imgSource, await fileToBase64(imgSource));
      } else {
        imageMap.set(imgSource, imgSource);
      }
    }
  }

  const svgWidth = paperWidth;
  const svgHeight = paperHeight;

  // We'll export all pages stacked vertically in one SVG
  const totalHeight = pages.length * svgHeight;

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${svgWidth}mm" height="${totalHeight}mm" viewBox="0 0 ${svgWidth} ${totalHeight}">`;

  svgContent += `
    <style>
      .pawn-index { font-family: sans-serif; font-weight: bold; font-size: 1.2mm; dominant-baseline: middle; text-anchor: middle; }
      .pawn-border { fill: none; stroke: #999; stroke-width: 0.176; }
      .spacer { stroke: none; }
    </style>
  `;

  // Define a clip path template for each pawn size if needed, or just use individual clipPaths
  svgContent += '<defs>';
  pages.forEach((page) => {
    page.pawns.forEach((pawn) => {
      const pSize = PAWN_SIZES[pawn.size];
      svgContent += `
        <clipPath id="clip-${pawn.id}">
          <rect x="0" y="0" width="${pSize.width}" height="${pSize.height}" />
        </clipPath>
      `;
    });
  });
  svgContent += '</defs>';

  pages.forEach((page, pageIndex) => {
    const pageYOffset = pageIndex * svgHeight;

    page.pawns.forEach((pawn) => {
      const meta = page.metadata.get(pawn.id);
      if (!meta) return;

      const pSize = PAWN_SIZES[pawn.size];
      const x = meta.x;
      const y = meta.y + pageYOffset;
      const imgData = imageMap.get(pawn.image);

      svgContent += `<g transform="translate(${x}, ${y})">`;

      // Draw overall border (solid)
      svgContent += `<rect class="pawn-border" x="0" y="0" width="${pSize.width}" height="${pSize.height * 2 + SPACER_BAR_HEIGHT}" />`;

      // Top part (mirrored)
      svgContent += `<g transform="translate(0, ${pSize.height}) scale(1, -1)">`;
      svgContent += `<g clip-path="url(#clip-${pawn.id})">`;
      // image with crop
      const topScale = pawn.crop.scale;
      const topTx = (pawn.crop.x / 100) * pSize.width;
      const topTy = (pawn.crop.y / 100) * pSize.height;
      const cx = pSize.width / 2;
      const cy = pSize.height / 2;
      svgContent += `<image xlink:href="${imgData}" x="0" y="0" width="${pSize.width}" height="${pSize.height}" preserveAspectRatio="xMidYMid meet" transform="translate(${topTx}, ${topTy}) translate(${cx}, ${cy}) scale(${topScale}) translate(${-cx}, ${-cy})" />`;
      svgContent += `</g>`;
      // Index for top part (upside down)
      if (pawn.showIndex) {
        svgContent += `<circle cx="${pSize.width - 3}" cy="${pSize.height - 10}" r="2.5" fill="${pawn.colour}" />`;
        svgContent += `<text x="${pSize.width - 3}" y="${pSize.height - 10}" fill="white" class="pawn-index" transform="rotate(180, ${pSize.width - 3}, ${pSize.height - 10})">${pawn.index}</text>`;
      }
      svgContent += `</g>`;

      // Spacer bar
      svgContent += `<rect class="spacer" x="0" y="${pSize.height}" width="${pSize.width}" height="${SPACER_BAR_HEIGHT}" fill="${pawn.colour}" />`;

      // Bottom part
      svgContent += `<g transform="translate(0, ${pSize.height + SPACER_BAR_HEIGHT})">`;
      svgContent += `<g clip-path="url(#clip-${pawn.id})">`;
      const botScale = pawn.crop.scale;
      const botTx = (pawn.crop.x / 100) * pSize.width;
      const botTy = (pawn.crop.y / 100) * pSize.height;
      const bcx = pSize.width / 2;
      const bcy = pSize.height / 2;
      svgContent += `<image xlink:href="${imgData}" x="0" y="0" width="${pSize.width}" height="${pSize.height}" preserveAspectRatio="xMidYMid meet" transform="translate(${botTx}, ${botTy}) translate(${bcx}, ${bcy}) scale(${botScale}) translate(${-bcx}, ${-bcy})" />`;
      svgContent += `</g>`;
      // Index for bottom part
      if (pawn.showIndex) {
        svgContent += `<circle cx="${pSize.width - 3}" cy="${pSize.height - 10}" r="2.5" fill="${pawn.colour}" />`;
        svgContent += `<text x="${pSize.width - 3}" y="${pSize.height - 10}" fill="white" class="pawn-index">${pawn.index}</text>`;
      }
      svgContent += `</g>`;

      svgContent += `</g>`;
    });
  });

  svgContent += `</svg>`;

  const blob = new Blob([svgContent], {type: 'image/svg+xml'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pawns-${new Date().toISOString().slice(0, 10)}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
