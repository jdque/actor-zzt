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

var WIDTH = 640;
var HEIGHT = 480;
var stage = new PIXI.Stage(0x000000);
var renderer = new PIXI.CanvasRenderer(WIDTH, HEIGHT);
var TILESET = null;
var cacheCanvas = null;
var textureCache = null;

function update() {
    window.board.runEntityTree();

    window.stage.children.forEach(function (child) {
        child.draw();
    })

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
                    set('$rand', expr('Math.floor(Math.random() * 4)'))
                    _if('$rand === 0')
                        pixi.moveBy(8, 0)
                    _elif('$rand === 1')
                        pixi.moveBy(0, 8)
                    _elif('$rand === 2')
                        pixi.moveBy(-8, 0)
                    _elif('$rand === 3')
                        pixi.moveBy(0, -8)
                    _endif()
                    wait(5)
                    jump('move')
                end()
            });

            object('Enemy', function () {
                pixi.set(sprites.enemy.tiles, sprites.enemy.width, sprites.enemy.height,
                    Math.floor(Math.random() * 640 / 8) * 8, Math.floor(Math.random() * 480 / 8) * 8)
                pixi.color(0xFF0000)
                jump('move')
                end()

                label('move')
                    set('$rand', expr('Math.floor(Math.random() * 4)'))
                    _if('$rand === 0')
                        pixi.moveBy(8, 0)
                    _elif('$rand === 1')
                        pixi.moveBy(0, 8)
                    _elif('$rand === 2')
                        pixi.moveBy(-8, 0)
                    _elif('$rand === 3')
                        pixi.moveBy(0, -8)
                    _endif()
                    wait(5)
                    jump('move')
                end()
            });
        });
        board.run(function () {
            loop(100)
                spawn('Player')
                spawn('Enemy')
            endloop()
        });
        board.execute();

        requestAnimFrame(update);
    }
}

window.onload = initialize;