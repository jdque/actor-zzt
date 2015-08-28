TileSprite = function () {
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
    document.body.appendChild(this.canvas);
    
    PIXI.Sprite.apply(this, [PIXI.Texture.fromCanvas(this.canvas)]);

    this.tiles = [];
}

TileSprite.prototype = Object.create(PIXI.Sprite.prototype);

TileSprite.prototype.setTiles = function (tiles, width, height) {
    this.tiles = tiles;
    this.width = width;
    this.height = height;

    //var canvas = this.canvas;
    //var context = canvas.getContext('2d');

    //this.canvas.width = width * 8;
    //this.canvas.height = height * 8;
    this.canvas.style.left = this.position.x + "px";
    this.canvas.style.top = this.position.y + "px";
    this.canvas.style.position = 'absolute';
    this.canvas.style.display = 'block';

    for (var i = 0; i < height; i++) {
        for (var j = 0; j < width; j++) {
            this.context.drawImage(
                TILESET,
                (tiles[(i * width) + j] % 8) * 8, Math.floor(tiles[(i * width) + j] / 8) * 8,
                8, 8,
                j * 8, i * 8,
                8, 8);
        }
    }

    this.setTexture(PIXI.Texture.fromCanvas(this.canvas));
}

var WIDTH = 640;
var HEIGHT = 480;
var stage = new PIXI.Stage(0x000000);
var renderer = new PIXI.CanvasRenderer(WIDTH, HEIGHT);
var TILESET = null;

function update() {
    window.renderer.render(stage);
}

function initialize() {
    document.body.appendChild(renderer.view);

    TILESET = document.createElement('img');
    TILESET.src = 'assets/tileset.bmp';

    var obj = new TileSprite();
    obj.position.x = 32;
    obj.position.y = 32;
    obj.setTiles(
        [1, 2, 3, 4,
         1, 2, 3, 4], 4, 2);
    window.stage.addChild(obj);

    window.setInterval(function () {
        requestAnimFrame(update);
    }, 1000 / 60);
}

window.onload = initialize;