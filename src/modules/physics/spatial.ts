import {Entity} from '../../core/environment';

interface ISpatialQuery {
    all: () => ISpatialQuery;
    not: () => ISpatialQuery;
    intersect: (rect: PIXI.Rectangle, offsetX: number, offsetY: number) => ISpatialQuery;
    inside: (rect: PIXI.Rectangle, offsetX: number, offsetY: number) => ISpatialQuery;
    distance: (fromRect: PIXI.Rectangle, distance: number) => ISpatialQuery;
    direction: (fromRect: PIXI.Rectangle, dirX: number, dirY: number) => ISpatialQuery;
    get: () => Entity[];
};

export interface Bounds {
    min: PIXI.Point;
    max: PIXI.Point;
}

//TODO - make generic
export interface IFinder {
    addObject: (object: Entity) => void;
    removeObject: (object: Entity) => void;
    updateObject: (object: Entity) => void;
    getNearbyObjects: (x: number, y: number, width: number, height: number) => Entity[];
    getBounds: () => Bounds;
};

export class Spatial {
    finder: IFinder;
    objects: Entity[];

    constructor(finder: IFinder) {
        this.finder = finder;
        this.objects = [];
    }

    register(object: Entity): void {
        if (this.objects.indexOf(object) !== -1) {
            return;
        }
        this.objects.push(object);
        this.finder.addObject(object);
    }

    unregister(object: Entity): void {
        let idx = this.objects.indexOf(object);
        if (idx === -1) {
            return;
        }
        this.objects[idx] = this.objects[this.objects.length - 1];
        this.objects.pop();
        this.finder.removeObject(object);
    }

    update(object: Entity): void {
        this.finder.updateObject(object);
    }

    isIntersect(rect1: PIXI.Rectangle, rect2: PIXI.Rectangle): boolean {
        if (rect1.right > rect2.left &&
            rect1.left < rect2.right &&
            rect1.bottom > rect2.top &&
            rect1.top < rect2.bottom) {
            return true;
        }

        return false;
    }

    isInside(testRect: PIXI.Rectangle, inRect: PIXI.Rectangle): boolean {
        if (testRect.left >= inRect.left &&
            testRect.top >= inRect.top &&
            testRect.right <= inRect.right &&
            testRect.bottom <= inRect.bottom) {
            return true;
        }

        return false;
    }

    isWithin(testRect: PIXI.Rectangle, fromRect: PIXI.Rectangle, distance: number): boolean {
        if (this.isIntersect(testRect, fromRect)) {
            return true;
        }

        let fromX = 0;
        let fromY = 0;
        let testX = 0;
        let testY = 0;

        if (fromRect.right < testRect.left) {
            fromX = fromRect.right;
        }
        else if (testRect.right < fromRect.left) {
            testX = testRect.right
        }

        if (fromRect.bottom < testRect.top) {
            fromY = fromRect.bottom;
        }
        else if (testRect.bottom < fromRect.top) {
            testY = testRect.bottom;
        }

        if (Math.sqrt(Math.pow(fromX - testX, 2) + Math.pow(fromY - testY, 2)) <= distance) {
            return true;
        }

        return false;
    }

    isDirection(testRect: PIXI.Rectangle, fromRect: PIXI.Rectangle, dirX: number, dirY: number): boolean {
        if (dirX === -1 && testRect.right > fromRect.left) return false;
        if (dirX === 1 && testRect.left < fromRect.right) return false;
        if (dirY === -1 && testRect.bottom > fromRect.top) return false;
        if (dirY === 1 && testRect.top < fromRect.bottom) return false;

        return true;
    }

    getAll(): Entity[] {
        return this.objects;
    }

    getIntersect(rect: PIXI.Rectangle, offsetX: number, offsetY: number, excludeObject?: Entity): Entity[] {
        rect.x += offsetX || 0;
        rect.y += offsetY || 0;

        let objs = this.finder.getNearbyObjects(rect.x, rect.y, rect.width, rect.height);
        for (let i = objs.length - 1; i >= 0; i--) {
            if (!this.isIntersect(objs[i].data().body.bounds, rect) || objs[i] === excludeObject) {
                objs[i] = objs[objs.length - 1];
                objs.pop();
            }
        }

        rect.x -= offsetX || 0;
        rect.y -= offsetY || 0;

        return objs;
    }

    anyIntersect(rect: PIXI.Rectangle, offsetX: number, offsetY: number, excludeObject?: Entity): boolean {
        rect.x += offsetX || 0;
        rect.y += offsetY || 0;

        let objs = this.finder.getNearbyObjects(rect.x, rect.y, rect.width, rect.height);
        for (let i = objs.length - 1; i >= 0; i--) {
            if (this.isIntersect(objs[i].data().body.bounds, rect) && objs[i] !== excludeObject) {
                return true;
            }
        }

        rect.x -= offsetX || 0;
        rect.y -= offsetY || 0;

        return false;
    }

    getInside(rect: PIXI.Rectangle, offsetX: number, offsetY: number): Entity[] {
        rect.x += offsetX || 0;
        rect.y += offsetY || 0;

        let objs = this.finder.getNearbyObjects(rect.x, rect.y, rect.width, rect.height);
        for (let i = objs.length - 1; i >= 0; i--) {
            if (!this.isInside(objs[i].data().body.bounds, rect)) {
                objs[i] = objs[objs.length - 1];
                objs.pop();
            }
        }

        rect.x -= offsetX || 0;
        rect.y -= offsetY || 0;

        return objs;
    }

    getWithin(rect: PIXI.Rectangle, distance: number): Entity[] {
        let objs = this.finder.getNearbyObjects(rect.x - distance, rect.y - distance, rect.width + distance * 2, rect.height + distance * 2);
        for (let i = objs.length - 1; i >= 0; i--) {
            if (!this.isWithin(objs[i].data().body.bounds, rect, distance)) {
                objs[i] = objs[objs.length - 1];
                objs.pop();
            }
        }

        return objs;
    }

    getDirection(rect: PIXI.Rectangle, dirX: number, dirY: number): Entity[] {
        let queryRect = new PIXI.Rectangle(0, 0, 0, 0);
        let bounds = this.finder.getBounds();
        if (dirX === -1) {
            queryRect.x = bounds.min.x;
            queryRect.width = rect.x - bounds.min.x;
        }
        else if (dirX === 1) {
            queryRect.x = rect.right;
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
            queryRect.y = rect.bottom;
            queryRect.height = bounds.max.y - queryRect.y;
        }
        else {
            queryRect.y = bounds.min.y;
            queryRect.height = bounds.max.y - bounds.min.y;
        }

        return this.getInside(queryRect, 0, 0);
    }

    query(): ISpatialQuery {
        return (function (spatial: Spatial): ISpatialQuery {
            let resultSet: Entity[] = null;
            let notIsActive: boolean = false;

            function listDiff(list: any[], removeList: any[]): any[] {
                let diffList = [];
                for (let item of list) {
                    if (removeList.indexOf(item) === -1) {
                        diffList.push(item);
                    }
                }

                return diffList;
            }

            function all(): ISpatialQuery {
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

            function not(): ISpatialQuery {
                notIsActive = !notIsActive;
                return closure;
            }

            function intersect(rect: PIXI.Rectangle, offsetX: number, offsetY: number): ISpatialQuery {
                if (!resultSet) {
                    if (notIsActive) {
                        resultSet = listDiff(spatial.getAll(), spatial.getIntersect(rect, offsetX, offsetY));
                    }
                    else {
                        resultSet = spatial.getIntersect(rect, offsetX, offsetY);
                    }
                }
                else {
                    resultSet = resultSet.filter((obj: Entity) => {
                        return spatial.isIntersect(obj.data().body.bounds, rect) !== notIsActive;
                    });
                }

                notIsActive = false;
                return closure;
            }

            function inside(rect: PIXI.Rectangle, offsetX: number, offsetY: number): ISpatialQuery {
                if (!resultSet) {
                    if (notIsActive) {
                        resultSet = listDiff(spatial.getAll(), spatial.getInside(rect, offsetX, offsetY));
                    }
                    else {
                        resultSet = spatial.getInside(rect, offsetX, offsetY);
                    }
                }
                else {
                    resultSet = resultSet.filter((obj: Entity) => {
                        return spatial.isInside(obj.data().body.bounds, rect) !== notIsActive;
                    });
                }

                notIsActive = false;
                return closure;
            }

            function distance(fromRect: PIXI.Rectangle, distance: number): ISpatialQuery {
                if (!resultSet) {
                    if (notIsActive) {
                        resultSet = listDiff(spatial.getAll(), spatial.getWithin(fromRect, distance));
                    }
                    else {
                        resultSet = spatial.getWithin(fromRect, distance);
                    }
                }
                else {
                    resultSet = resultSet.filter((obj: Entity) => {
                        return spatial.isWithin(obj.data().body.bounds, fromRect, distance) !== notIsActive;
                    });
                }

                notIsActive = false;
                return closure;
            }

            function direction(fromRect: PIXI.Rectangle, dirX: number, dirY: number): ISpatialQuery {
                if (!resultSet) {
                    if (notIsActive) {
                        resultSet = listDiff(spatial.getAll(), spatial.getDirection(fromRect, dirX, dirY));
                    }
                    else {
                        resultSet = spatial.getDirection(fromRect, dirX, dirY);
                    }
                }
                else {
                    resultSet = resultSet.filter((obj: Entity) => {
                        return spatial.isDirection(obj.data().body.bounds, fromRect, dirX, dirY) !== notIsActive;
                    });
                }

                notIsActive = false;
                return closure;
            }

            function get(): Entity[] {
                return resultSet;
            }

            let closure: ISpatialQuery = {
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
}