import * as Ops from '../../core/ops';
import {DeferredFunction} from '../../core/evaluables';
import {Entity} from '../../core/environment';
import {ModuleBuilder} from '../../core/module';
import {GridHash} from './grid_hash';
import {TilemapCollider} from './collider';
import {Spatial} from './spatial';

interface InitParams {
    tiles: any[];
    width: number;
    height: number;
}

interface Data {
    bounds: PIXI.Rectangle;
    spatial: any;
    tilemap: any;
    lastDelta: Delta;
}

interface Delta {
    dx: number;
    dy: number;
}

declare module '../../core/module' {
    interface ModuleData {
        body: Data;
    }
}

function getDirectionDelta(dirStr: string, entity: Entity): Delta {
    var dx = 0;
    var dy = 0;

    switch(dirStr) {
        case 'n':
            dy = -8;
            break;
        case 's':
            dy = 8;
            break;
        case 'w':
            dx = -8;
            break;
        case 'e':
            dx = 8;
            break;
        case 'rnd':
            var dir = Math.floor(Math.random() * 4);
            if      (dir === 0) { dy = -8; }
            else if (dir === 1) { dy = 8;  }
            else if (dir === 2) { dx = -8; }
            else                { dx = 8;  }
            break;
        case 'flow':
            var lastDelta = entity.data().body.lastDelta;
            dx = lastDelta.dx;
            dy = lastDelta.dy;
            break;
    }

    return {dx: dx, dy: dy};
}

let builder = new ModuleBuilder();

builder
    .command({
        name: '__init__',
        compile: null,
        run: (entity, data: Data) => (params: InitParams) => {
            data.bounds = new PIXI.Rectangle(0, 0, params.width * 8, params.height * 8),
            data.spatial = new Spatial(new GridHash(32)),
            data.tilemap = new TilemapCollider(params.tiles, params.width, params.height),
            data.lastDelta = {dx: 0, dy: 0}

            if (entity.parent && entity.parent.data().body) {
                entity.parent.data().body.spatial.register(entity);
            }
        }
    })
    .command({
        name: '__destroy__',
        compile: null,
        run: (entity, data: Data) => () => {
            if (entity.parent && entity.parent.data().body) {
                entity.parent.data().body.spatial.unregister(entity);
            }
            data.bounds = null;
            data.spatial = null;
            data.tilemap = null;
            data.lastDelta = null;
        }
    })
    .command({
        name: 'blocked',
        compile: (parser) => (dir: string): DeferredFunction => {
            return new DeferredFunction((entity): boolean => {
                let data: Data = entity.data().body;

                var blocked = false;
                var delta = getDirectionDelta(dir, entity);

                data.bounds.x += delta.dx;
                data.bounds.y += delta.dy;

                if (entity.parent.data().body.spatial.anyIntersect(data.bounds, 0, 0, entity)) {
                    blocked = true;
                }
                else if (entity.parent.data().body.tilemap.anyTileInRect(data.bounds)) {
                    blocked = true;
                }

                data.bounds.x -= delta.dx;
                data.bounds.y -= delta.dy;

                return blocked;
            });
        },
        run: null
    })
    .command({
        name: 'dir',
        compile: (parser) => (dir: string): DeferredFunction => {
            return new DeferredFunction((entity): Entity[] => {
                let data: Data = entity.data().body;

                var delta = getDirectionDelta(dir, entity);
                var objs = entity.parent.data().body.spatial.query()
                    .distance(data.bounds, 1)
                    .direction(data.bounds, delta.dx / 8, delta.dy / 8)
                    .get();
                return objs;
            });
        },
        run: null
    })
    .command({
        name: 'move_to',
        compile: (parser) => parser.simpleCommand('body.move_to'),
        run: (entity, data: Data) => (x: number, y: number) => {
            if (!data)
                return;

            data.bounds.x = x;
            data.bounds.y = y;
            entity.parent.data().body.spatial.update(entity);

            if (entity.data().pixi.pixiObject) {
                entity.data().pixi.pixiObject.position.x = data.bounds.x;
                entity.data().pixi.pixiObject.position.y = data.bounds.y;
            }
        }
    })
    .command({
        name: 'move_by',
        compile: (parser) => parser.simpleCommand('body.move_by'),
        run: (entity, data: Data) => (dx: number, dy: number) => {
            if (!data)
                return;

            data.bounds.x += dx;
            data.bounds.y += dy;

            if (entity.parent.data().body.spatial.anyIntersect(data.bounds, 0, 0, entity)) {
                data.bounds.x -= dx;
                data.bounds.y -= dy;
            }
            else if (entity.parent.data().body.tilemap.anyTileInRect(data.bounds)) {
                data.bounds.x -= dx;
                data.bounds.y -= dy;
            }

            entity.parent.data().body.spatial.update(entity);

            if (entity.data().pixi.pixiObject) {
                entity.data().pixi.pixiObject.position.x = data.bounds.x;
                entity.data().pixi.pixiObject.position.y = data.bounds.y;
            }
        }
    })
    .command({
        name: 'move',
        compile: (parser) => (dirStr: string) => {
            var dirs = dirStr.split('/');
            for (var i = 0; i < dirs.length; i++) {
                if (dirs[i].length === 0)
                    continue;

                parser.addOp(Ops.SimpleOp.create('body.move', [dirs[i]]));
                parser.commands['wait'](5);
            }
        },
        run: (entity, data: Data) => (dir: string) => {
            var delta = getDirectionDelta(dir, entity);
            entity.execContext.commands['body']['move_by'](delta.dx, delta.dy);
            data.lastDelta = delta;
        }
    })

export let Physics = {
    PhysicsCommandSet: builder.build('body'),
    Spatial,
    TilemapCollider,
    GridHash
};