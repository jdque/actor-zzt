TileSprite = function (name, tiles, width, height) {
    PIXI.Sprite.apply(this, [textureCache.fetch(name, tiles, width, height)]);
    this.tiles = [];
}

TileSprite.prototype = Object.create(PIXI.Sprite.prototype);

TileSprite.prototype.draw = function () {
    //var context = objCanvas.getContext('2d');
    //context.drawImage(cacheCanvas, 0, 0, this.realWidth, this.realHeight,
    //    this.position.x, this.position.y, this.realWidth, this.realHeight);
    //this.setTiles(this.tiles, this.tileWidth, this.tileHeight);
}

var WIDTH = 640;
var HEIGHT = 480;
var stage = new PIXI.Stage(0x000000);
var renderer = new PIXI.CanvasRenderer(WIDTH, HEIGHT);
var TILESET = null;
var cacheCanvas = null;
var textureCache = null;
var objTexture = null;

function TextureCache(baseTexture) {
    this.baseTexture = baseTexture;
    this.cache = {};
    this.nextY = 0;
}

TextureCache.prototype.fetch = function (name, tiles, width, height) {
    if (!this.cache[name]) {
        this.setTiles(tiles, 0, this.nextY, width, height);
        this.cache[name] = new PIXI.Texture(this.baseTexture, new PIXI.Rectangle(0, this.nextY, 8*width, 8*height));
        this.nextY += 8*height;
    }
    return this.cache[name];
}

TextureCache.prototype.setTiles = function (tiles, x, y, width, height) {
    /*this.tiles = tiles;
    this.tileWidth = width;
    this.tileHeight = height;
    this.realWidth = width * 8;
    this.realHeight = height * 8;*/

    var context = cacheCanvas.getContext('2d');
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

function update() {
    window.board.runEntityTree();

    window.stage.children.forEach(function (child) {
        child.draw();
    })

    window.renderer.render(stage);

    requestAnimFrame(update);
}

function initialize() {
    TILESET = document.createElement('img');
    TILESET.src = 'assets/tileset.bmp';
    TILESET.onload = function () {
        document.body.appendChild(renderer.view);

        cacheCanvas = document.createElement('canvas');
        cacheCanvas.width = 640;
        cacheCanvas.height = 960;

        var baseTexture = PIXI.Texture.fromCanvas(cacheCanvas);
        textureCache = new TextureCache(baseTexture);
        //objTexture = new PIXI.Texture(baseTexture, new PIXI.Rectangle(0, 0, 8*3, 8*2));

        window.board = new Board();
        board.setup(function () {
            object('Player', function () {
                pixi.set(
                    [219, 219,
                     219, 219],
                    2, 2,
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
                pixi.set(
                    [219, 219, 219,
                     219, 219, 219,
                     219, 219, 219],
                    3, 3,
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