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
var world = null;

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

    var cacheCanvas = document.createElement('canvas');
    cacheCanvas.width = 1280;
    cacheCanvas.height = 1280;

    var textureCache = new Graphics.TextureCache(cacheCanvas, TILESET);

    var tilePalette = new Graphics.TilePalette();
    tilePalette.setEntry(0, new Graphics.Tile({fg: 0x000000, bg: 0x000000, char: 0}));
    tilePalette.setEntry(1, new Graphics.Tile({fg: 0xFF0000, bg: 0x00FF00, char: 100}));
    tilePalette.setEntry(2, new Graphics.Tile({fg: 0xFF0000, bg: 0x000000, char: 219}));
    tilePalette.setEntry(3, new Graphics.Tile({fg: 0x0000FF, bg: 0x000000, char: 219}));
    tilePalette.setEntry(4, new Graphics.Tile({fg: 0xFFFFFF, bg: 0x000000, char: 7}));

    var top = new Array(80).fill(1);
    var side = new Array(80).fill(0);
    side[0] = 1;
    side[1] = 1;
    side[side.length - 1] = 1;
    side[side.length - 2] = 1;

    var tilemap = top.concat(top);
    for (var i = 0; i < 56; i++) {
        tilemap = tilemap.concat(side);
    }
    tilemap = tilemap.concat(top).concat(top);

    boards = {
        default: {
            sprite: {
                stage: stage,
                cache: textureCache,
                tiles: tilePalette.convertToTiles(tilemap),
                width: 80, height: 60,
                x: 0, y: 0
            },
            body: {
                tiles: tilemap,
                width: 80, height: 60
            }
        }
    };

    entities = {
        player: {
            sprite: {
                stage: stage,
                cache: textureCache,
                tiles: tilePalette.convertToTiles(
                    [3, 3,
                     3, 3]),
                width: 2, height: 2,
                x: 320, y: 240
            },
            body: {
                tiles: [1, 1,
                        1, 1],
                width: 2, height: 2
            }
        },
        enemy: {
            sprite: {
                stage: stage,
                cache: textureCache,
                tiles: tilePalette.convertToTiles(
                    [2, 2, 2,
                     2, 2, 2,
                     2, 2, 2]),
                width: 3, height: 3,
                x: 0, y: 0
            },
            body: {
                tiles: [1, 1, 1,
                        1, 1, 1,
                        1, 1, 1],
                width: 3, height: 3
            }
        },
        bullet: {
            sprite: {
                stage: stage,
                cache: textureCache,
                tiles: tilePalette.convertToTiles([4]),
                width: 1, height: 1,
                x: 0, y: 0
            },
            body: {
                tiles: [1],
                width: 1, height: 1
            }
        }
    };

    var RenderParser = new ZZT.Parser();
    RenderParser.registerModule(ZZT.DefaultCommandSet);
    RenderParser.registerModule(Graphics.PIXICommandSet);
    RenderParser.registerModule(Physics.PhysicsCommandSet);
    RenderParser.registerModule(Input.InputCommandSet);

    var board = new ZZT.Board();

    board.configure({
        autoStep: false,
        parser: RenderParser
    });

    board.setup(function () {
        object('Player', function () {
            label('init', ['_x', '_y'])
                adopt('body', entities.player.body)
                adopt('pixi', entities.player.sprite)
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

        object('Enemy', function () {
            label('init', ['_x', '_y'])
                adopt('body', entities.enemy.body)
                adopt('pixi', entities.enemy.sprite)
                body.move_to($('_x'), $('_y'))
                pixi.alpha(0.5)
                jump('move')
            end()

            label('move')
                body.move('/rnd')
                body.move('/flow/flow/flow/flow')
                jump('move')
            end()

            label('enemy_stop')
                print("OUCH")
                die()
            end()
        });

        object('Bullet', function () {
            label('init', ['_x', '_y', '_dir'])
                adopt('body', entities.bullet.body)
                adopt('pixi', entities.bullet.sprite)
                body.move_to($('_x'), $('_y'))
                _if('$_dir === "e"')
                    body.move('/e')
                _endif()
                jump('loop')
            end()

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
            end()
        })
    });
    board.run(function () {
        adopt('body', boards.default.body)
        adopt('pixi', boards.default.sprite)
        loop(100)
            spawn('Enemy', [
                expr('Math.floor(Math.random() * 640 / 8) * 8'),
                expr('Math.floor(Math.random() * 480 / 8) * 8')
            ])
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