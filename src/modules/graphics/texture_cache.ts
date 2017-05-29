import {ITile} from './tile';

interface RGBColor {
    r: number;
    g: number;
    b: number;
};

interface TreeNode {
    rect: PIXI.Rectangle;
    used: boolean;
    left: TreeNode;
    right: TreeNode;
};

interface TextureRef {
    texture: PIXI.Texture;
    x: number;
    y: number;
}

export class TextureCache {
    tileset: HTMLImageElement;
    canvas: HTMLCanvasElement;
    baseTexture: PIXI.BaseTexture;
    cache: {[id: string]: TextureRef};
    binTree: TreeNode;

    constructor(canvas: HTMLCanvasElement, tileset: HTMLImageElement) {
        this.tileset = tileset;
        this.baseTexture = PIXI.BaseTexture.fromCanvas(canvas);
        this.canvas = canvas;
        this.cache = {};
        this.binTree = {
            rect: new PIXI.Rectangle(0, 0, this.canvas.width, this.canvas.height),
            used: false,
            left: null,
            right: null
        };
    }

    getNextCoord(width: number, height: number): {x: number, y: number} {
        function traverse(node: TreeNode, depth: number): {x: number, y: number} {
            if (!node.left && !node.right) { //is leaf
                if (node.used || width > node.rect.width || height > node.rect.height) { //is occupied or doesn't fit
                    return null;
                }

                let lRect, llRect, lrRect, rRect;
                if (depth % 2 === 0) { //split along x axis first
                    lRect = new PIXI.Rectangle(node.rect.x, node.rect.y, node.rect.width, height);
                    llRect = new PIXI.Rectangle(node.rect.x, node.rect.y, width, height);
                    lrRect = new PIXI.Rectangle(node.rect.x + width, node.rect.y, node.rect.width - width, height);
                    rRect = new PIXI.Rectangle(node.rect.x, node.rect.y + height, node.rect.width, node.rect.height - height);
                }
                else { //split along y axis first
                    lRect = new PIXI.Rectangle(node.rect.x, node.rect.y, width, node.rect.height);
                    llRect = new PIXI.Rectangle(node.rect.x, node.rect.y, width, height);
                    lrRect = new PIXI.Rectangle(node.rect.x, node.rect.y + height, width, node.rect.height - height);
                    rRect = new PIXI.Rectangle(node.rect.x + width, node.rect.y, node.rect.width - width, node.rect.height);
                }

                node.left = {
                    rect: lRect,
                    used: false,
                    left: {
                        rect: llRect,
                        used: true,
                        left: null,
                        right: null
                    },
                    right: {
                        rect: lrRect,
                        used: false,
                        left: null,
                        right: null
                    }
                }
                node.right = {
                    rect: rRect,
                    used: false,
                    left: null,
                    right: null
                }

                return {x: node.rect.x, y: node.rect.y};
            }
            else { //is branch
                let coord = null;
                coord = traverse(node.left, depth + 1);
                if (coord) {
                    return coord;
                }
                coord = traverse(node.right, depth + 1);
                if (coord) {
                    return coord;
                }

                return null;
            }
        }

        return traverse(this.binTree, 0);
    }

    cacheTiles(name: string, tiles: ITile[], width: number, height: number): PIXI.Texture {
        if (!this.cache[name]) {
            let coord = this.getNextCoord(8*width, 8*height);
            if (!coord) {
                return null;
            }

            this.drawTiles(tiles, coord.x, coord.y, width, height);
            this.cache[name] = {
                texture: new PIXI.Texture(this.baseTexture, new PIXI.Rectangle(coord.x, coord.y, 8*width, 8*height)),
                x: coord.x,
                y: coord.y
            };
        }
        return this.cache[name].texture;
    }

    updateTiles(name: string, tiles: ITile[], width: number, height: number): void {
        if (!this.cache[name]) {
            return;
        }

        let x = this.cache[name].x;
        let y = this.cache[name].y;

        this.drawTiles(tiles, x, y, width, height);
    }

    drawTiles(tiles: ITile[], x: number, y: number, width: number, height: number): void {
        let ctx: CanvasRenderingContext2D = this.canvas.getContext('2d');
        for (let iy = 0; iy < height; iy++) {
            for (let ix = 0; ix < width; ix++) {
                let tile = tiles[(iy * width) + ix];
                let destX = x + ix * 8;
                let destY = y + iy * 8;

                ctx.drawImage(
                    this.tileset,
                    (tile.char % 16) * 8, Math.floor(tile.char / 16) * 8,
                    8, 8,
                    destX, destY,
                    8, 8);

                //Tint white and black pixels with tile's foreground and background color, respectively
                let fgRgb: RGBColor = {r: (tile.fg >> 16) & 0xFF, g: (tile.fg >> 8) & 0xFF, b: tile.fg & 0xFF};
                let bgRgb: RGBColor = {r: (tile.bg >> 16) & 0xFF, g: (tile.bg >> 8) & 0xFF, b: tile.bg & 0xFF};
                let imageData: ImageData = ctx.getImageData(destX, destY, 8, 8);
                let pixels = imageData.data;
                for (let i = 0; i < pixels.length; i += 4) {
                    if (pixels[i] > 0 && pixels[i+1] > 0 && pixels[i+2] > 0) {
                        pixels[i] = fgRgb.r;
                        pixels[i+1] = fgRgb.g;
                        pixels[i+2] = fgRgb.b;
                    }
                    else {
                        pixels[i] = bgRgb.r;
                        pixels[i+1] = bgRgb.g;
                        pixels[i+2] = bgRgb.b;
                    }
                }
                ctx.putImageData(imageData, destX, destY);
            }
        }
    }
}
