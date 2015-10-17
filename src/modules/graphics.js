var PIXI = require('lib/pixi.dev.js');
var ZZT = require('src/zzt.js');

function Tile(attrs) {
    this.fg = attrs.fg || 0x000000;
    this.bg = attrs.bg || 0x000000;
    this.char = attrs.char || 0;
}

function TilePalette() {
    this.palette = {};
}

TilePalette.prototype.setEntry = function (id, tile) {
    this.palette[id] = tile;
}

TilePalette.prototype.convertToTiles = function (entries) {
    var mapTiles = [];
    for (var i = 0; i < entries.length; i++) {
        mapTiles.push(this.palette[entries[i]]);
    }

    return mapTiles;
}

function TileSprite(cache, name, tiles, width, height) {
    PIXI.Sprite.apply(this, [cache.cacheTiles(name, tiles, width, height)]);

    this.name = name;
    this.cache = cache;
    this.tiles = tiles;
    this.tileWidth = width;
    this.tileHeight = height;
}

TileSprite.prototype = Object.create(PIXI.Sprite.prototype);

TileSprite.prototype.setTiles = function (tiles, width, height) {
    this.cache.updateTiles(this.name, tiles, width, height);

    this.tiles = tiles;
    this.tileWidth = width;
    this.tileHeight = height;
}

TileSprite.prototype.getTile = function (tileX, tileY) {
    if (tileX > this.tileWidth - 1 || tileY > this.tileHeight - 1) {
        return null;
    }
    return this.tiles[this.tileWidth * tileY + tileX];
}

TileSprite.prototype.getTilesInRect = function (rect) {
    var tiles = [];
    for (var y = rect.y, endY = rect.y + rect.height; y < endY; y += 8) {
        for (var x = rect.x, endX = rect.x + rect.width; x < endX; x += 8) {
            tiles.push(this.getTile(x / 8, y / 8));
        }
    }

    return tiles;
}

TileSprite.prototype.anyTileInRect = function (rect) {
    for (var y = rect.y, endY = rect.y + rect.height; y < endY; y += 8) {
        for (var x = rect.x, endX = rect.x + rect.width; x < endX; x += 8) {
            var tile = this.getTile(x / 8, y / 8);
            if (tile && tile.char !== 0) {
                return true;
            }
        }
    }

    return false;
}

function TextureCache(canvas, tileset) {
    this.tileset = tileset;
    this.baseTexture = PIXI.Texture.fromCanvas(canvas);
    this.canvas = canvas;
    this.cache = {};
    this.binTree = {
        rect: new PIXI.Rectangle(0, 0, this.canvas.width, this.canvas.height),
        used: false,
        left: null,
        right: null
    };
}

TextureCache.prototype.getNextCoord = function (width, height) {
    function traverse(node, depth) {
        if (!node.left && !node.right) { //is leaf
            if (node.used || width > node.rect.width || height > node.rect.height) { //is occupied or doesn't fit
                return null;
            }

            var lRect, llRect, lrRect, rRect;
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
            var coord = null;
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

TextureCache.prototype.cacheTiles = function (name, tiles, width, height) {
    if (!this.cache[name]) {
        var coord = this.getNextCoord(8*width, 8*height);
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

TextureCache.prototype.updateTiles = function (name, tiles, width, height) {
    if (!this.cache[name]) {
        return;
    }

    var x = this.cache[name].x;
    var y = this.cache[name].y;

    this.drawTiles(tiles, x, y, width, height);
}

TextureCache.prototype.drawTiles = function (tiles, x, y, width, height) {
    var ctx = this.canvas.getContext('2d');
    for (var iy = 0; iy < height; iy++) {
        for (var ix = 0; ix < width; ix++) {
            var tile = tiles[(ix * width) + iy];
            var destX = x + ix * 8;
            var destY = y + iy * 8;

            ctx.drawImage(
                this.tileset,
                (tile.char % 16) * 8, Math.floor(tile.char / 16) * 8,
                8, 8,
                destX, destY,
                8, 8);

            //Tint white and black pixels with tile's foreground and background color, respectively
            var fgRgb = {r: (tile.fg >> 16) & 0xFF, g: (tile.fg >> 8) & 0xFF, b: tile.fg & 0xFF};
            var bgRgb = {r: (tile.bg >> 16) & 0xFF, g: (tile.bg >> 8) & 0xFF, b: tile.bg & 0xFF};
            var imageData = ctx.getImageData(destX, destY, 8, 8);
            var pixels = imageData.data;
            for (var i = 0; i < pixels.length; i += 4) {
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

var PIXICommandSet = {};

PIXICommandSet.parseCommands = function (parser, entity) {
    var pixi = {
        color: parser._defaultParseFunc(entity.commands.pixi.color),
        alpha: parser._defaultParseFunc(entity.commands.pixi.alpha)
    };

    return {
        pixi: pixi
    };
};

PIXICommandSet.runCommands = function (entity) {
    var pixi = {
        __init__: function (params) {
            var obj = new TileSprite(params.cache, entity.name, params.tiles, params.width, params.height);
            obj.position.x = params.x;
            obj.position.y = params.y;

            entity.pixiObject = obj;
            entity.pixiObject.stage = params.stage;

            entity.pixiObject.stage.addChild(obj);
        },

        __destroy__: function () {
            entity.pixiObject.stage.removeChild(entity.pixiObject);
            entity.pixiObject = null;
        },

        color: function (color) {
            if (entity.pixiObject) {
                var color = color instanceof ZZT.Evaluable ? color.evaluate() : color;
                entity.pixiObject.tint = color || 0xFFFFFF;
            }
        },

        alpha: function (alpha) {
            if (entity.pixiObject) {
                var alpha = alpha instanceof ZZT.Evaluable ? alpha.evaluate() : alpha;
                entity.pixiObject.alpha = alpha || 1;
            }
        }
    };

    return {
        pixi: pixi
    };
};

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        Tile: Tile,
        TilePalette: TilePalette,
        TileSprite: TileSprite,
        TextureCache: TextureCache,
        PIXICommandSet: PIXICommandSet
    };
}