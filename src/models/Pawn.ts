export const PAWN_SIZES = {
  small: { width: 21.5, height: 28.6 },
  medium: { width: 29, height: 49 },
  large: { width: 48.4, height: 63.3 },
  huge: { width: 76, height: 98.7 }
};

export const PAPER_SIZES = {
  A4: { name: 'A4', width: 210, height: 297 },
  Letter: { name: 'Letter (US)', width: 215.9, height: 279.4 },
  Legal: { name: 'Legal (US)', width: 215.9, height: 355.6 }
};

export const SPACER_BAR_HEIGHT = 2.5;

export const PAWN_COLORS = [
  '#FF3B30', // Red
  '#FF9500', // Orange
  '#FFCC00', // Yellow
  '#4CD964', // Green
  '#5AC8FA', // Sky Blue
  '#007AFF', // Blue
  '#5856D6', // Purple
  '#FF2D55', // Pink
  '#AF52DE', // Violet
  '#FF6482', // Salmon
  '#34C759', // Darker Green
  '#00C7BE', // Teal
];

export type PawnSize = keyof typeof PAWN_SIZES;
export type PaperSize = keyof typeof PAPER_SIZES;

export interface CropSettings {
  x: number;
  y: number;
  scale: number;
}

export class Pawn {
  public id: string;
  public image: string | File;
  public name: string;
  public size: PawnSize;
  public colour: string;
  public crop: CropSettings;
  public index: number;

  constructor(image: string | File, name: string, size: PawnSize = 'huge', colour: string = '#ccc', crop?: CropSettings, index: number = 1) {
    this.id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    this.image = image;
    this.name = name;
    this.size = size;
    this.colour = colour;
    this.crop = crop || { x: 0, y: 0, scale: 1 };
    this.index = index;
  }
}
