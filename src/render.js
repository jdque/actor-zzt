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
    this.bounds = {min: new PIXI.Point(0, 0), max: new PIXI.Point(0, 0)};
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

    //Update global bounds
    if (bounds.x < this.bounds.min.x) this.bounds.min.x = bounds.x;
    if (bounds.y < this.bounds.min.y) this.bounds.min.y = bounds.y;
    if (bounds.x + bounds.width > this.bounds.max.x) this.bounds.max.x = bounds.x + bounds.width;
    if (bounds.y + bounds.height > this.bounds.max.y) this.bounds.max.y = bounds.y + bounds.height;
}

GridHash.prototype.removeObject = function (object) {
    if (!this.objIdCellMap[object.id]) {
        return;
    }

    for (var i = 0; i < this.objIdCellMap[object.id].length; i++) {
        var cell = this.cells[this.objIdCellMap[object.id][i]];
        cell[cell.indexOf(object)] = cell[cell.length - 1];
        cell.pop();
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

GridHash.prototype.getNearbyObjects = function (x, y, w, h) {
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

GridHash.prototype.getBounds = function () {
    return this.bounds;
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
    this.objects = [];
}

Spatial.prototype.register = function (object) {
    if (this.objects.indexOf(object) !== -1) {
        return;
    }
    this.objects.push(object);
    this.finder.addObject(object);
}

Spatial.prototype.unregister = function (object) {
    var idx = this.objects.indexOf(object);
    if (idx === -1) {
        return;
    }
    this.objects[idx] = this.objects[this.objects.length - 1];
    this.objects.pop();
    this.finder.removeObject(object);
}

Spatial.prototype.update = function (object) {
    this.finder.updateObject(object);
}

Spatial.prototype.isIntersect = function (rect1, rect2) {
    if (rect1.x + rect1.width > rect2.x &&
        rect1.x < rect2.x + rect2.width &&
        rect1.y + rect1.height > rect2.y &&
        rect1.y < rect2.y + rect2.height) {
        return true;
    }

    return false;
}

Spatial.prototype.isInside = function (testRect, inRect) {
    if (testRect.x >= inRect.x &&
        testRect.y >= inRect.y &&
        testRect.x + testRect.width <= inRect.x + inRect.width &&
        testRect.y + testRect.height <= inRect.y + inRect.height) {
        return true;
    }

    return false;
}

Spatial.prototype.isWithin = function (rect, fromX, fromY, distance) {
    //TODO Calculate based on closet point on object boundary instead of center
    var centerX = rect.x + rect.width / 2;
    var centerY = rect.y + rect.height / 2;
    if (Math.sqrt(Math.pow(centerX - fromX, 2) + Math.pow(centerY - fromY, 2)) <= distance) {
        return true;
    }

    return false;
}

Spatial.prototype.isDirection = function (testRect, fromRect, dirX, dirY) {
    if (dirX === -1 && testRect.x + testRect.width > fromRect.x) return false;
    if (dirX === 1 && testRect.x < fromRect.x + fromRect.width) return false;
    if (dirY === -1 && testRect.y + testRect.height > fromRect.y) return false;
    if (dirY === 1 && testRect.y < fromRect.y + fromRect.height) return false;

    return true;
}

Spatial.prototype.getAll = function () {
    return this.objects;
}

Spatial.prototype.getIntersect = function (rect, offsetX, offsetY) {
    rect.x += offsetX || 0;
    rect.y += offsetY || 0;

    var objs = this.finder.getNearbyObjects(rect.x, rect.y, rect.width, rect.height);
    for (var i = objs.length - 1; i >= 0; i--) {
        if (!this.isIntersect(objs[i].body.bounds, rect)) {
            objs[i] = objs[objs.length - 1];
            objs.pop();
        }
    }

    rect.x -= offsetX || 0;
    rect.y -= offsetY || 0;

    return objs;
}

Spatial.prototype.getInside = function (rect, offsetX, offsetY) {
    rect.x += offsetX || 0;
    rect.y += offsetY || 0;

    var objs = this.finder.getNearbyObjects(rect.x, rect.y, rect.width, rect.height);
    for (var i = objs.length - 1; i >= 0; i--) {
        if (!this.isInside(objs[i].body.bounds, rect)) {
            objs[i] = objs[objs.length - 1];
            objs.pop();
        }
    }

    rect.x -= offsetX || 0;
    rect.y -= offsetY || 0;

    return objs;
}

Spatial.prototype.getWithin = function (x, y, distance) {
    var objs = this.finder.getNearbyObjects(x - distance, y - distance, distance * 2, distance * 2);
    for (var i = objs.length - 1; i >= 0; i--) {
        if (!this.isWithin(objs[i].body.bounds, x, y, distance)) {
            objs[i] = objs[objs.length - 1];
            objs.pop();
        }
    }

    return objs;
}

Spatial.prototype.getDirection = function (rect, dirX, dirY) {
    var queryRect = new PIXI.Rectangle(0, 0, 0, 0);
    var bounds = this.finder.getBounds();
    if (dirX === -1) {
        queryRect.x = bounds.min.x;
        queryRect.width = rect.x - bounds.min.x;
    }
    else if (dirX === 1) {
        queryRect.x = rect.x + rect.width;
        queryRect.width = bounds.max.x - queryRect.x;
    }
    else {
        queryRect.x = bounds.min.x;
        queryRect.width = bounds.max.x - bounds.min.x;
    }

    if (dirY === -1) {
        queryRect.y = bounds.min.y;
        queryRect.height = rect.y - bounds.min.y;
    }
    else if (dirY === 1) {
        queryRect.y = rect.y + rect.height;
        queryRect.height = bounds.max.y - queryRect.y;
    }
    else {
        queryRect.y = bounds.min.y;
        queryRect.height = bounds.max.y - bounds.min.y;
    }

    return this.getInside(queryRect, 0, 0);
}

Spatial.prototype.query = function () {
    return (function (spatial) {
        var resultSet = null;
        var notIsActive = false;

        function listDiff(list, removeList) {
            var diffList = []
            for (var i = 0; i < list.length; i++) {
                if (removeList.indexOf(list[i]) === -1) {
                    diffList.push(list[i]);
                }
            }

            return diffList;
        }

        function all() {
            if (!resultSet) {
                if (notIsActive) {
                    resultSet = [];
                }
                else {
                    resultSet = spatial.getAll();
                }
            }

            notIsActive = false;
            return closure;
        }

        function intersect(rect, offsetX, offsetY) {
            if (!resultSet) {
                if (notIsActive) {
                    resultSet = listDiff(spatial.getAll(), spatial.getIntersect(rect, offsetX, offsetY));
                }
                else {
                    resultSet = spatial.getIntersect(rect, offsetX, offsetY);
                }
            }
            else {
                resultSet = resultSet.filter(function (obj) {
                    return spatial.isIntersect(obj.body.bounds, rect) !== notIsActive;
                });
            }

            notIsActive = false;
            return closure;
        }

        function inside(rect, offsetX, offsetY) {
            if (!resultSet) {
                if (notIsActive) {
                    resultSet = listDiff(spatial.getAll(), spatial.getInside(rect, offsetX, offsetY));
                }
                else {
                    resultSet = spatial.getInside(rect, offsetX, offsetY);
                }
            }
            else {
                resultSet = resultSet.filter(function (obj) {
                    return spatial.isInside(obj.body.bounds, rect) !== notIsActive;
                });
            }

            notIsActive = false;
            return closure;
        }

        function distance(distance, fromX, fromY) {
            if (!resultSet) {
                if (notIsActive) {
                    resultSet = listDiff(spatial.getAll(), spatial.getWithin(fromX, fromY, distance));
                }
                else {
                    resultSet = spatial.getWithin(fromX, fromY, distance);
                }
            }
            else {
                resultSet = resultSet.filter(function (obj) {
                    return spatial.isWithin(obj.body.bounds, fromX, fromY, distance) !== notIsActive;
                });
            }

            notIsActive = false;
            return closure;
        }

        function direction(fromRect, dirX, dirY) {
            if (!resultSet) {
                if (notIsActive) {
                    resultSet = listDiff(spatial.getAll(), spatial.getDirection(fromRect, dirX, dirY));
                }
                else {
                    resultSet = spatial.getDirection(fromRect, dirX, dirY);
                }
            }
            else {
                resultSet = resultSet.filter(function (obj) {
                    return spatial.isDirection(obj.body.bounds, fromRect, dirX, dirY) !== notIsActive;
                });
            }

            notIsActive = false;
            return closure;
        }

        function not() {
            notIsActive = !notIsActive;
            return closure;
        }

        function get() {
            return resultSet;
        }

        var closure = {
            all: all,
            intersect: intersect,
            inside: inside,
            distance: distance,
            direction: direction,
            not: not,
            get: get
        }

        return closure;
    })(this);
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
                width: 2, height: 2,
                x: 320, y: 240
            },
            enemy: {
                tiles: [219, 219, 219,
                        219, 219, 219,
                        219, 219, 219],
                width: 3, height: 3,
                x: 0, y: 0
            }
        }

        window.board = new Board();
        board.setup(function () {
            object('Player', ['@x', '@y'], function () {
                adopt('body', { bounds: new PIXI.Rectangle(0, 0, 16, 16), spatial: spatial})
                adopt('pixi', sprites.player)
                adopt('input')
                body.move_to(expr('@x'), expr('@y'))
                pixi.color(0x0000FF)
                jump('move')
                end()

                label('move')
                    _if(input.key_down(38))
                        body.move('/n')
                    _elif(input.key_down(40))
                        body.move('/s')
                    _endif()

                    _if(input.key_down(37))
                        body.move('/w')
                    _elif(input.key_down(39))
                        body.move('/e')
                    _endif()

                    _if(body.blocked('flow'))
                        print("THUD")
                        body.move('/i')
                    _endif()

                    exec(function (entity) {
                        var all = entity.body.spatial.query().all().get();
                        all.forEach(function (obj) {
                            obj.pixiObject.tint = 0xFF0000;
                        });

                        var boundary = entity.body.spatial.query()
                            //.intersect(new PIXI.Rectangle(128, 128, 640 - 256, 480 - 256))
                            //.not().intersect(new PIXI.Rectangle(128, 128, 128, 128))
                            .distance(128, entity.body.bounds.x + entity.body.bounds.width / 2, entity.body.bounds.y + entity.body.bounds.height / 2)
                            .direction(entity.body.bounds, 0, -1)
                            .get();
                        boundary.forEach(function (obj) {
                            obj.pixiObject.tint = 0xFFFFFF;
                        });
                    })
                    wait(1)
                    jump('move')
                end()
            });

            object('Enemy', ['@x', '@y'], function () {
                adopt('body', { bounds: new PIXI.Rectangle(0, 0, 24, 24), spatial: spatial})
                adopt('pixi', sprites.enemy)
                body.move_to(expr('@x'), expr('@y'))
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
            loop(100)
                spawn('Enemy', [expr('Math.floor(Math.random() * 640 / 8) * 8'), expr('Math.floor(Math.random() * 480 / 8) * 8')])
            endloop()
            spawn('Player', [640 / 2, 480 / 2])
        });
        board.execute();

        requestAnimFrame(update);
    }
}

window.onload = initialize;