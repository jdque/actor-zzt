var PIXI = require('../lib/pixi.dev.js');
var ZZT = require('../src/zzt.js');
var Graphics = require('../src/modules/graphics.js');
var Physics = require('../src/modules/physics.js');
var Input = require('../src/modules/input.js');

var WIDTH = 640;
var HEIGHT = 480;
var stage = new PIXI.Stage(0x000000);
var renderer = new PIXI.CanvasRenderer(WIDTH, HEIGHT);
var TILESET = null;
var cacheCanvas = null;
var textureCache = null;
var tilePalette = null;

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

function run() {
    TILESET = document.createElement('img');
    TILESET.onload = onResourcesLoaded;
    TILESET.src = 'assets/tileset.bmp';
}

function onResourcesLoaded() {
    document.body.appendChild(renderer.view);

    cacheCanvas = document.createElement('canvas');
    cacheCanvas.width = 640;
    cacheCanvas.height = 640;

    textureCache = new Graphics.TextureCache(cacheCanvas, TILESET);

    tilePalette = new Graphics.TilePalette();
    tilePalette.setEntry(0, new Graphics.Tile({fg: 0x000000, bg: 0x000000, char: 0}));
    tilePalette.setEntry(1, new Graphics.Tile({fg: 0xFF0000, bg: 0x00FF00, char: 100}));
    tilePalette.setEntry(2, new Graphics.Tile({fg: 0xFF0000, bg: 0x000000, char: 219}));
    tilePalette.setEntry(3, new Graphics.Tile({fg: 0x0000FF, bg: 0x000000, char: 219}));
    tilePalette.setEntry(4, new Graphics.Tile({fg: 0xFFFFFF, bg: 0x000000, char: 7}));

    spatial = new Physics.Spatial(new Physics.GridHash(32));

    sprites = {
        player: {
            stage: stage,
            cache: textureCache,
            tiles: tilePalette.convertToTiles(
                [3, 3,
                 3, 3]),
            width: 2, height: 2,
            x: 320, y: 240
        },
        enemy: {
            stage: stage,
            cache: textureCache,
            tiles: tilePalette.convertToTiles(
                [2, 2, 2,
                 2, 2, 2,
                 2, 2, 2]),
            width: 3, height: 3,
            x: 0, y: 0
        },
        bullet: {
            stage: stage,
            cache: textureCache,
            tiles: tilePalette.convertToTiles([4]),
            width: 1, height: 1,
            x: 0, y: 0
        }
    }

    tilemaps = {
        board: {
            stage: stage,
            cache: textureCache,
            tiles: tilePalette.convertToTiles(
                [1, 1, 1, 1, 1,
                 1, 0, 0, 0, 1,
                 1, 0, 0, 0, 1,
                 1, 0, 0, 0, 1,
                 1, 1, 1, 1, 1]),
            width: 5, height: 5,
            x: 0, y: 0
        }
    }

    bodies = {
        player: {
            bounds: new PIXI.Rectangle(0, 0, 16, 16),
            spatial: spatial
        },
        enemy: {
            bounds: new PIXI.Rectangle(0, 0, 24, 24),
            spatial: spatial
        },
        bullet: {
            bounds: new PIXI.Rectangle(0, 0, 8, 8),
            spatial: spatial
        }
    }

    RenderParser = new ZZT.Parser();
    RenderParser.registerModule('default', ZZT.DefaultCommandSet);
    RenderParser.registerModule('pixi', Graphics.PIXICommandSet);
    RenderParser.registerModule('body', Physics.PhysicsCommandSet);
    RenderParser.registerModule('input', Input.InputCommandSet);

    board = new ZZT.Board();

    board.configure({
        autoStep: false,
        parser: RenderParser
    });

    board.setup(function () {
        object('Player', ['_x', '_y'], function () {
            adopt('body', bodies.player)
            adopt('pixi', sprites.player)
            adopt('input')
            body.move_to($('_x'), $('_y'))
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

                _if(input.key_down(32))
                    send('[parent]', 'shoot', [expr('this.body.bounds.x + this.body.bounds.width'), expr('this.body.bounds.y'), "e"])
                    wait(5)
                _endif()

                _if(body.blocked('flow'))
                    body.move('/i')
                _endif()

                wait(1)
                jump('move')
            end()
        });

        object('Enemy', ['_x', '_y'], function () {
            adopt('body', bodies.enemy)
            adopt('pixi', sprites.enemy)
            body.move_to($('_x'), $('_y'))
            pixi.alpha(0.5)
            jump('move')
            end()

            label('move')
                body.move('/rnd')
                jump('move')
            end()

            label('enemy_stop')
                print("OUCH")
            die()
        });

        object('Bullet', ['_x', '_y', '_dir'], function () {
            adopt('body', bodies.bullet)
            adopt('pixi', sprites.bullet)
            body.move_to($('_x'), $('_y'))
            _if('$_dir === "e"')
                body.move('/e')
            _endif()
            jump('loop')

            label('loop')
                _if(body.blocked('flow'))
                    send(body.dir('flow'), 'enemy_stop')
                    jump('stop')
                _endif()
                body.move('/flow')
                jump('loop')
            end()

            label('stop')
            die()
        })
    });
    board.run(function () {
        adopt('pixi', tilemaps.board)
        loop(100)
            spawn('Enemy', [expr('Math.floor(Math.random() * 640 / 8) * 8'), expr('Math.floor(Math.random() * 480 / 8) * 8')])
        endloop()
        spawn('Player', [640 / 2, 480 / 2])
        end()

        label('shoot', ['_x', '_y', '_dir'])
            spawn('Bullet', $(['_x', '_y', '_dir']))
        end()
    });

    world = new ZZT.World();
    world.addBoard("Default", board);
    world.startBoard("Default");

    requestAnimFrame(update);
}

function update() {
    world.step();
    renderer.render(stage);
    requestAnimFrame(update);
}

var App = {
    run: run
};

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = App;
}