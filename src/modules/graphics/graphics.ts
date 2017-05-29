import {Tile, TileSprite, TilePalette} from './tile';
import {TextureCache} from './texture_cache';
import {ModuleBuilder} from '../../core/module';

interface InitParams {
    stage: PIXI.Container;
    cache: TextureCache;
    tiles: Tile[];
    x: number;
    y: number;
    width: number;
    height: number;
};

interface Data {
    pixiObject: any;
};

let builder = new ModuleBuilder();

builder
    .command({
        name: '__init__',
        compile: null,
        run: (entity, data: Data) => (params: InitParams) => {
            var obj = new TileSprite(params.cache, entity.name, params.tiles, params.width, params.height);
            obj.position.x = params.x;
            obj.position.y = params.y;

            data.pixiObject = obj;

            if (entity.parent && entity.parent.data('pixi').pixiObject) {
                entity.parent.data('pixi').pixiObject.addChild(obj);
            } else {
                params.stage.addChild(obj);
            }
        }
    })
    .command({
        name: '__destroy__',
        compile: null,
        run: (entity, data: Data) => () => {
            data.pixiObject.parent.removeChild(data.pixiObject);
            data.pixiObject = null;
        }
    })
    .command({
        name: 'color',
        compile: (parser) => parser.simpleCommand('pixi.color'),
        run: (entity, data: Data) => (color: number) => {
            if (data.pixiObject) {
                data.pixiObject.tint = color || 0xFFFFFF;
            }
        }
    })
    .command({
        name: 'alpha',
        compile: (parser) => parser.simpleCommand('pixi.alpha'),
        run: (entity, data: Data) => (alpha: number) => {
            if (data.pixiObject) {
                data.pixiObject.alpha = alpha || 1;
            }
        }
    });

export let Graphics = {
    PIXICommandSet: builder.build('pixi'),
    Tile,
    TilePalette,
    TileSprite,
    TextureCache
};