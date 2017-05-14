import {Tile, TileSprite, TilePalette} from './tile';
import {TextureCache} from './texture_cache';
import {ModuleBuilder} from '../../core/module';

type PIXIStage = any;

interface IInitParams {
    stage: PIXIStage;
    cache: TextureCache;
    tiles: Tile[];
    x: number;
    y: number;
    width: number;
    height: number;
};

let builder = new ModuleBuilder();

builder
    .command({
        name: '__init__',
        compile: null,
        run: (entity: any) => (params: IInitParams) => {
            var obj = new TileSprite(params.cache, entity.name, params.tiles, params.width, params.height);
            obj.position.x = params.x;
            obj.position.y = params.y;

            entity.pixiObject = obj;

            if (entity.parent && entity.parent.pixiObject) {
                entity.parent.pixiObject.addChild(obj);
            } else {
                params.stage.addChild(obj);
            }
        }
    })
    .command({
        name: '__destroy__',
        compile: null,
        run: (entity: any) => () => {
            entity.pixiObject.parent.removeChild(entity.pixiObject);
            entity.pixiObject = null;
        }
    })
    .command({
        name: 'color',
        compile: (parser) => parser.simpleCommand('pixi.color'),
        run: (entity: any) => (color: number) => {
            if (entity.pixiObject) {
                entity.pixiObject.tint = color || 0xFFFFFF;
            }
        }
    })
    .command({
        name: 'alpha',
        compile: (parser) => parser.simpleCommand('pixi.alpha'),
        run: (entity: any) => (alpha: number) => {
            if (entity.pixiObject) {
                entity.pixiObject.alpha = alpha || 1;
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