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
    getObjectBounds: (object: Entity) => PIXI.Rectangle;
    getGlobalBounds: () => Bounds;
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
        if (rect1.x + rect1.width > rect2.x &&
            rect1.x < rect2.x + rect2.width &&
            rect1.y + rect1.height > rect2.y &&
            rect1.y < rect2.y + rect2.height) {
            return true;
        }

        return false;
    }

    isInside(testRect: PIXI.Rectangle, inRect: PIXI.Rectangle): boolean {
        if (testRect.x >= inRect.x &&
            testRect.y >= inRect.y &&
            testRect.x + testRect.width <= inRect.x + inRect.width &&
            testRect.y + testRect.height <= inRect.y + inRect.height) {
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

        if (fromRect.x + fromRect.width < testRect.x) {
            fromX = fromRect.x + fromRect.width;
        }
        else if (testRect.x + testRect.width < fromRect.x) {
            testX = testRect.x + testRect.width
        }

        if (fromRect.y + fromRect.height < testRect.y) {
            fromY = fromRect.y + fromRect.height;
        }
        else if (testRect.y + testRect.height < fromRect.y) {
            testY = testRect.y + testRect.height;
        }

        if (Math.sqrt(Math.pow(fromX - testX, 2) + Math.pow(fromY - testY, 2)) <= distance) {
            return true;
        }

        return false;
    }

    isDirection(testRect: PIXI.Rectangle, fromRect: PIXI.Rectangle, dirX: number, dirY: number): boolean {
        if (dirX === -1 && testRect.x + testRect.width > fromRect.x) return false;
        if (dirX === 1 && testRect.x < fromRect.x + fromRect.width) return false;
        if (dirY === -1 && testRect.y + testRect.height > fromRect.y) return false;
        if (dirY === 1 && testRect.y < fromRect.y + fromRect.height) return false;

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
            if (!this.isIntersect(objs[i].data('body').bounds, rect) || objs[i] === excludeObject) {
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
            if (this.isIntersect(objs[i].data('body').bounds, rect) && objs[i] !== excludeObject) {
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
            if (!this.isInside(objs[i].data('body').bounds, rect)) {
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
            if (!this.isWithin(objs[i].data('body').bounds, rect, distance)) {
                objs[i] = objs[objs.length - 1];
                objs.pop();
            }
        }

        return objs;
    }

    getDirection(rect: PIXI.Rectangle, dirX: number, dirY: number): Entity[] {
        let queryRect = new PIXI.Rectangle(0, 0, 0, 0);
        let bounds = this.finder.getGlobalBounds();
        if (dirX === -1) {
            queryRect.x = bounds.min.x;
            queryRect.width = rect.x - bounds.min.x;
        }
        else if (dirX === 1) {
            queryRect.x = rect.x + rect.width;
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
            queryRect.y = rect.y + rect.height;
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
                        return spatial.isIntersect(obj.data('body').bounds, rect) !== notIsActive;
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
                        return spatial.isInside(obj.data('body').bounds, rect) !== notIsActive;
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
                        return spatial.isWithin(obj.data('body').bounds, fromRect, distance) !== notIsActive;
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
                        return spatial.isDirection(obj.data('body').bounds, fromRect, dirX, dirY) !== notIsActive;
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