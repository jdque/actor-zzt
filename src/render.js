TileSprite = function (name, tiles, width, height) {
    PIXI.Sprite.apply(this, [textureCache.fetch(name, tiles, width, height)]);
    this.tiles = tiles;
    this.tileWidth = width;
    this.tileHeight = height;
}

TileSprite.prototype = Object.create(PIXI.Sprite.prototype);

TileSprite.prototype.draw = function () {
    //var context = objCanvas.getContext('2d');
    //context.drawImage(cacheCanvas, 0, 0, this.realWidth, this.realHeight,
    //    this.position.x, this.position.y, this.realWidth, this.realHeight);
    //this.setTiles(this.tiles, this.tileWidth, this.tileHeight);
}

function TextureCache(canvas) {
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

TextureCache.prototype.fetch = function (name, tiles, width, height) {
    if (!this.cache[name]) {
        var coord = this.getNextCoord(8*width, 8*height);
        if (!coord) {
            return null;
        }

        this.setTiles(tiles, coord.x, coord.y, width, height);
        this.cache[name] = new PIXI.Texture(this.baseTexture, new PIXI.Rectangle(coord.x, coord.y, 8*width, 8*height));
    }
    return this.cache[name];
}

TextureCache.prototype.setTiles = function (tiles, x, y, width, height) {
    var context = this.canvas.getContext('2d');
    for (var i = 0; i < height; i++) {
        for (var j = 0; j < width; j++) {
            var tileId = tiles[(i * width) + j];
            context.drawImage(
                TILESET,
                (tileId % 16) * 8, Math.floor(tileId / 16) * 8,
                8, 8,
                x + j * 8, y + i * 8,
                8, 8);
        }
    }
}

function GridHash(cellSize) {
    this.cellSize = cellSize || 64;
    this.cells = {};
    this.objIdCellMap = {};
}

GridHash.prototype.getKey = function (x, y) {
    var cellX = Math.floor(x / this.cellSize);
    var cellY = Math.floor(y / this.cellSize);
    return cellX + "," + cellY;
}

GridHash.prototype.addObject = function (object) {
    if (this.objIdCellMap[object.id]) {
        return;
    }

    this.objIdCellMap[object.id] = [];

    var bounds = object.body.bounds;

    //Insert corner points
    this.addObjectForPoint(object, bounds.x, bounds.y);
    this.addObjectForPoint(object, bounds.x + bounds.width, bounds.y);
    this.addObjectForPoint(object, bounds.x, bounds.y + bounds.height);
    this.addObjectForPoint(object, bounds.x + bounds.width, bounds.y + bounds.height);

    //Insert intermediate points, spaced by cell size
    for (var y = bounds.y + this.cellSize, endY = bounds.y + bounds.height; y < endY; y += this.cellSize) {
        for (var x = bounds.x + this.cellSize, endX = bounds.x + bounds.width; x < endX; x += this.cellSize) {
            this.addObjectForPoint(x, y, object);
        }
    }
}

GridHash.prototype.removeObject = function (object) {
    if (!this.objIdCellMap[object.id]) {
        return;
    }

    for (var i = 0; i < this.objIdCellMap[object.id].length; i++) {
        var cell = this.cells[this.objIdCellMap[object.id][i]];
        cell[cell.indexOf(object)] = cell[cell.length - 1];
        cell.pop();
        /*this.cells[this.objIdCellMap[object.id][i]].splice(
            this.cells[this.objIdCellMap[object.id][i]].indexOf(object), 1);*/
    }
    this.objIdCellMap[object.id] = null;
}

GridHash.prototype.updateObject = function (object) {
    if (!this.objIdCellMap[object.id]) {
        return;
    }

    var bounds = object.body.bounds;

    //If object corner points are in the same cells as before, no need to update
    if (this.objIdCellMap[object.id].indexOf(this.getKey(bounds.x, bounds.y)) > -1 &&
        this.objIdCellMap[object.id].indexOf(this.getKey(bounds.x + bounds.width, bounds.y)) > -1 &&
        this.objIdCellMap[object.id].indexOf(this.getKey(bounds.x, bounds.y + bounds.height)) > -1 &&
        this.objIdCellMap[object.id].indexOf(this.getKey(bounds.x + bounds.width, bounds.y + bounds.height)) > -1) {
        return;
    }

    this.removeObject(object);
    this.addObject(object);
}

GridHash.prototype.addObjectForPoint = function (object, x, y) {
    var key = this.getKey(x, y);

    if (!this.cells[key]) {
        this.cells[key] = [];
    }

    if (this.cells[key].indexOf(object) === -1) {
        this.cells[key].push(object);
        this.objIdCellMap[object.id].push(key);
    }
}

GridHash.prototype.getNearObjects = function (x, y, w, h) {
    var objects = [];

    var cellX = Math.floor(x / this.cellSize) - 1;
    var cellY = Math.floor(y / this.cellSize) - 1;
    var cellW = Math.ceil(w / this.cellSize) + 1;
    var cellH = Math.ceil(h / this.cellSize) + 1;
    for (var y = cellY; y <= cellY + cellH; y++) {
        for (var x = cellX; x <= cellX + cellW; x++) {
            var cellObjs = this.getCellObjects(x + "," + y);
            for (var i = 0; i < cellObjs.length; i++) {
                if (objects.indexOf(cellObjs[i]) === -1) {
                    objects.push(cellObjs[i]);
                }
            }
        }
    }

    return objects;
}

GridHash.prototype.getIntersectingObjects = function (x, y, w, h) {
    var nearObjs = this.getNearObjects(x, y, w, h);
    var intersectingObjs = [];
    for (var i = 0; i < nearObjs.length; i++) {
        if (this.intersects(
                x, y, w, h,
                nearObjs[i].body.bounds.x, nearObjs[i].body.bounds.y, nearObjs[i].body.bounds.width, nearObjs[i].body.bounds.height)) {
            intersectingObjs.push(nearObjs[i]);
        }
    }

    return intersectingObjs;
}

GridHash.prototype.intersects = function (x1, y1, w1, h1, x2, y2, w2, h2) {
    if (x1 + w1 > x2 &&
        x1 < x2 + w2 &&
        y1 + h1 > y2 &&
        y1 < y2 + h2)
        return true;

    return false;
}

GridHash.prototype.getCellObjects = function (key) {
    return this.cells[key] || [];
}

GridHash.prototype.getCellObjectsForPoint = function (x, y) {
    var key = this.getKey(x, y);
    return this.cells[key] || [];
}

function Spatial(finder) {
    this.finder = finder;
}

Spatial.prototype.register = function (object) {
    this.finder.addObject(object);
}

Spatial.prototype.unregister = function (object) {
    this.finder.removeObject(object);
}

Spatial.prototype.update = function (object) {
    this.finder.updateObject(object);
}

Spatial.prototype.getInRect = function (rect, offsetX, offsetY) {
    return this.finder.getIntersectingObjects(rect.x + offsetX || 0, rect.y + offsetY || 0, rect.width, rect.height);
}

var WIDTH = 640;
var HEIGHT = 480;
var stage = new PIXI.Stage(0x000000);
var renderer = new PIXI.CanvasRenderer(WIDTH, HEIGHT);
var TILESET = null;
var cacheCanvas = null;
var textureCache = null;

function update() {
    window.board.step();

    window.renderer.render(stage);

    requestAnimFrame(update);
}

function testTexturePacking() {
    for (var i = 0; i < 100; i++) {
        var w = Math.floor(Math.random() * 30);
        var h = Math.floor(Math.random() * 30);
        var tile = Math.floor(Math.random() * 128);
        var tiles = [];
        for (var j = 0; j < w * h; j++) {
            tiles.push(tile);
        }
        var tex = textureCache.fetch(i.toString(), tiles, w, h);
        if (!tex) console.log("couldnt fit")
    }
}

function initialize() {
    TILESET = document.createElement('img');
    TILESET.src = 'assets/tileset.bmp';
    TILESET.onload = function () {
        document.body.appendChild(renderer.view);

        cacheCanvas = document.createElement('canvas');
        cacheCanvas.width = 640;
        cacheCanvas.height = 960;

        textureCache = new TextureCache(cacheCanvas);

        window.spatial = new Spatial(new GridHash(32));

        window.sprites = {
            player: {
                tiles: [219, 219,
                        219, 219],
                width: 2,
                height: 2
            },
            enemy: {
                tiles: [219, 219, 219,
                        219, 219, 219,
                        219, 219, 219],
                width: 3,
                height: 3
            }
        }

        window.board = new Board();
        board.setup(function () {
            object('Player', function () {
                pixi.set(sprites.player.tiles, sprites.player.width, sprites.player.height,
                    Math.floor(Math.random() * 640 / 8) * 8, Math.floor(Math.random() * 480 / 8) * 8)
                pixi.color(0x0000FF)
                jump('move')
                end()

                label('move')
                    wait(5)
                    jump('move')
                end()
            });

            object('Enemy', function () {
                body.set(Math.floor(Math.random() * 640 / 8) * 8, Math.floor(Math.random() * 480 / 8) * 8, sprites.enemy.width * 8, sprites.enemy.height * 8, spatial)
                pixi.set(sprites.enemy.tiles, sprites.enemy.width, sprites.enemy.height, Math.floor(Math.random() * 640 / 8) * 8, Math.floor(Math.random() * 480 / 8) * 8)
                pixi.color(0xFF0000)
                pixi.alpha(0.5)
                jump('move')
                end()

                label('move')
                    body.move('/rnd')
                    jump('move')
                end()
            });
        });
        board.run(function () {
            loop(300)
                spawn('Enemy')
            endloop()
            spawn('Player')
        });
        board.execute();

        requestAnimFrame(update);
    }
}

window.onload = initialize;