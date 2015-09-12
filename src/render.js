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

GridHash.prototype.removeObject = function (object) {
    if (this.objIdCellMap[object.id]) {
        for (var i = 0; i < this.objIdCellMap[object.id].length; i++) {
            var cell = this.cells[this.objIdCellMap[object.id][i]];
            cell[cell.indexOf(object)] = cell[cell.length - 1];
            cell.pop();
            /*this.cells[this.objIdCellMap[object.id][i]].splice(
                this.cells[this.objIdCellMap[object.id][i]].indexOf(object), 1);*/
        }
        this.objIdCellMap[object.id] = [];
    }
}

GridHash.prototype.addOrUpdateObject = function (object) {
    var bounds = object.body.bounds;

    if (this.objIdCellMap[object.id]) {
        if (this.objIdCellMap[object.id].indexOf(this.getKey(bounds.x, bounds.y)) === -1 ||
            this.objIdCellMap[object.id].indexOf(this.getKey(bounds.x + bounds.width, bounds.y)) === -1 ||
            this.objIdCellMap[object.id].indexOf(this.getKey(bounds.x, bounds.y + bounds.height)) === -1 ||
            this.objIdCellMap[object.id].indexOf(this.getKey(bounds.x + bounds.width, bounds.y + bounds.height)) === -1)
            this.removeObject(object);
    }

    this.addObjectForPoint(bounds.x, bounds.y, object);
    this.addObjectForPoint(bounds.x + bounds.width, bounds.y, object);
    this.addObjectForPoint(bounds.x, bounds.y + bounds.height, object);
    this.addObjectForPoint(bounds.x + bounds.width, bounds.y + bounds.height, object);

    for (var y = bounds.y + this.cellSize, endY = bounds.y + bounds.height; y < endY; y += this.cellSize) {
        for (var x = bounds.x + this.cellSize, endX = bounds.x + bounds.width; x < endX; x += this.cellSize) {
            this.addObjectForPoint(x, y, object);
        }
    }
}

GridHash.prototype.addObjectForPoint = function (x, y, object) {
    var key = this.getKey(x, y);

    if (!this.cells[key]) {
        this.cells[key] = [];
    }

    if (this.cells[key].indexOf(object) === -1) {
        this.cells[key].push(object);
        if (!this.objIdCellMap[object.id]) {
            this.objIdCellMap[object.id] = [];
        }
        this.objIdCellMap[object.id].push(key);
    }
}

GridHash.prototype.getNearObjects = function (rect) {
    //var bounds = new PIXI.Rectangle(object.pixiObject.position.x, object.pixiObject.position.y, object.pixiObject.width, object.pixiObject.height);
    var objects = [];

    var cellX = Math.floor(rect.x / this.cellSize) - 1;
    var cellY = Math.floor(rect.y / this.cellSize) - 1;
    var cellW = Math.ceil(rect.width / this.cellSize) + 1;
    var cellH = Math.ceil(rect.height / this.cellSize) + 1;
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

GridHash.prototype.getIntersectingObjects = function (rect) {
    var nearObjs = this.getNearObjects(rect);
    var intersectingObjs = [];
    for (var i = 0; i < nearObjs.length; i++) {
        if (this.intersects(rect, nearObjs[i].body.bounds)) {
            intersectingObjs.push(nearObjs[i]);
        }
    }

    return intersectingObjs;
}

GridHash.prototype.intersects = function (rect1, rect2) {
    if (rect1.x + rect1.width > rect2.x &&
        rect1.x < rect2.x + rect2.width &&
        rect1.y + rect1.height > rect2.y &&
        rect1.y < rect2.y + rect2.height)
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

        window.collision = new GridHash(32);

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
                body.set(Math.floor(Math.random() * 640 / 8) * 8, Math.floor(Math.random() * 480 / 8) * 8, sprites.enemy.width * 8, sprites.enemy.height * 8, collision)
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