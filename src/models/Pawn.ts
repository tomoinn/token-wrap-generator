import {type PawnSize} from './Settings';

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
    public showIndex: boolean;
    public pawnName: string;
    public startColourIndex: number;

    constructor(image: string | File, name: string, size: PawnSize = 'huge', colour: string = '#ccc', crop?: CropSettings, index: number = 1, showIndex: boolean = true, pawnName: string = '', startColourIndex: number = 0) {
        this.id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
        this.image = image;
        this.name = name;
        this.size = size;
        this.colour = colour;
        this.crop = crop || {x: 0, y: 0, scale: 1};
        this.index = index;
        this.showIndex = showIndex;
        this.pawnName = pawnName;
        this.startColourIndex = startColourIndex;
    }
}
