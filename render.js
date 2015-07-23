TileSprite = function () {
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
    document.body.appendChild(this.canvas);
    
    PIXI.Sprite.apply(this, [PIXI.Texture.fromCanvas(this.canvas)]);

    this.tiles = [];
    this.width = 0;
    this.height = 0;
}

TileSprite.prototype = Object.create(PIXI.Sprite.prototype);

TileSprite.prototype.setTiles = function (tiles, width, height) {
    this.tiles = tiles;
    this.width = width;
    this.height = height;

    var canvas = this.canvas;
    var context = canvas.getContext('2d');

    this.canvas.width = width * 8;
    this.canvas.height = height * 8;
    this.canvas.style.left = this.x + "px";
    this.canvas.style.top = this.y + "px";
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

    //this.setTexture(PIXI.Texture.fromCanvas(this.canvas));
}

var WIDTH = 640;
var HEIGHT = 480;
var stage = new PIXI.Stage(0x000000);
var renderer = new PIXI.CanvasRenderer(WIDTH, HEIGHT);
var TILESET = null;

document.body.appendChild(renderer.view);

function update() {
    window.renderer.render(stage);
}

function initialize() {
    TILESET = document.createElement('img');
    TILESET.src = 'tileset.bmp';
    TILESET.style.display = "none";
    document.body.appendChild(TILESET);

    var what = new PIXI.Sprite(PIXI.Texture.fromCanvas(this.canvas))

    var obj = new TileSprite();
    obj.setTiles(
        [1, 2, 3, 4,
         1, 2, 3, 4], 4, 2);
    obj.x = 0;
    obj.y = 0;
    window.stage.addChild(obj);

    window.setInterval(function () {
        requestAnimFrame(update);
    }, 1000 / 60);
}

window.onload = initialize;