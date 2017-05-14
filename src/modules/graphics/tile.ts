import {TextureCache} from './texture_cache';

declare var require;
interface PIXIRectangle { new(...args: any[]): PIXIRectangle; width: any; height: any; x: any; y: any;};
interface PIXISprite    { new(...args: any[]): PIXISprite; position: any; };
interface PIXITexture   { new(...args: any[]): PIXITexture; fromCanvas: any; }
interface IPIXI {
    Rectangle: PIXIRectangle;
    Sprite: PIXISprite;
    Texture: PIXITexture;
}
var PIXI: IPIXI = require('pixi');

export interface ITile {
    fg: number;
    bg: number;
    char: number;
}

export class Tile implements ITile {
    fg: number;
    bg: number;
    char: number;

    constructor(attrs: ITile) {
        this.fg = attrs.fg || 0x000000;
        this.bg = attrs.bg || 0x000000;
        this.char = attrs.char || 0;
    }
}

export class TilePalette {
    palette: {[id: string]: Tile};

    constructor() {
        this.palette = {};
    }

    setEntry(id: string | number, tile: Tile): void {
        this.palette[id] = tile;
    }

    convertToTiles(entries: Array<string | number>): Tile[] {
        return entries.map((id) => this.palette[id]);
    }
}

export class TileSprite extends PIXI.Sprite {
    name: string;
    cache: TextureCache;
    tiles: Tile[];
    tileWidth: number;
    tileHeight: number;

    constructor(cache: TextureCache, name: string, tiles: Tile[], width: number, height: number) {
        super(cache.cacheTiles(name, tiles, width, height));

        this.name = name;
        this.cache = cache;
        this.tiles = tiles;
        this.tileWidth = width;
        this.tileHeight = height;
    }

    setTiles(tiles: Tile[], width: number, height: number): void {
        this.cache.updateTiles(this.name, tiles, width, height);

        this.tiles = tiles;
        this.tileWidth = width;
        this.tileHeight = height;
    }
}