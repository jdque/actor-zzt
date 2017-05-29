import {Entity} from '../../core/environment';
import {Bounds, IFinder} from './spatial';

declare var require;
interface PIXIPoint { new(...args: any[]): PIXIPoint; x: any; y: any; };
interface PIXIRectangle { new(...args: any[]): PIXIRectangle; width: any; height: any; x: any; y: any; };
interface IPIXI {
    Point: PIXIPoint;
    Rectangle: PIXIRectangle;
}
var PIXI: IPIXI = require('pixi');

export class GridHash implements IFinder {
    cellSize: number;
    cells: {[key: string]: Entity[]};
    objIdCellMap: {[id: string]: string[]};
    bounds: Bounds;

    constructor(cellSize: number = 64) {
        this.cellSize = cellSize;
        this.cells = {};
        this.objIdCellMap = {};
        this.bounds = {min: new PIXI.Point(0, 0), max: new PIXI.Point(0, 0)};
    }

    getKey(x: number, y: number): string {
        let cellX = Math.floor(x / this.cellSize);
        let cellY = Math.floor(y / this.cellSize);
        return cellX + "," + cellY;
    }

    addObject(object: Entity): void {
        if (this.objIdCellMap[object.id]) {
            return;
        }

        this.objIdCellMap[object.id] = [];

        let bounds = this.getObjectBounds(object);
        let left: number   = bounds.x;
        let right: number  = bounds.x + bounds.width;
        let top: number    = bounds.y;
        let bottom: number = bounds.y + bounds.height;

        //Insert corner points
        this.addObjectForPoint(object, left, top);
        this.addObjectForPoint(object, right, top);
        this.addObjectForPoint(object, left, bottom);
        this.addObjectForPoint(object, right, bottom);

        //Insert intermediate points, spaced by cell size
        for (let y = top + this.cellSize, endY = bottom; y < endY; y += this.cellSize) {
            for (let x = left + this.cellSize, endX = right; x < endX; x += this.cellSize) {
                this.addObjectForPoint(object, x, y);
            }
        }

        //Update global bounds
        if (left < this.bounds.min.x) this.bounds.min.x = left;
        if (top < this.bounds.min.y) this.bounds.min.y = top;
        if (right > this.bounds.max.x) this.bounds.max.x = right;
        if (bottom > this.bounds.max.y) this.bounds.max.y = bottom;
    }

    removeObject(object: Entity): void {
        if (!this.objIdCellMap[object.id]) {
            return;
        }

        for (let i = 0; i < this.objIdCellMap[object.id].length; i++) {
            let cell = this.cells[this.objIdCellMap[object.id][i]];
            cell[cell.indexOf(object)] = cell[cell.length - 1];
            cell.pop();
        }
        this.objIdCellMap[object.id] = null;
    }

    updateObject(object: Entity): void {
        if (!this.objIdCellMap[object.id]) {
            return;
        }

        let bounds = this.getObjectBounds(object);

        //If object corner points are in the same cells as before, no need to update
        if (this.objIdCellMap[object.id].indexOf(this.getKey(bounds.x, bounds.y)) > -1 &&
            this.objIdCellMap[object.id].indexOf(this.getKey(bounds.x + bounds.width, bounds.y)) > -1 &&
            this.objIdCellMap[object.id].indexOf(this.getKey(bounds.x, bounds.y + bounds.height)) > -1 &&
            this.objIdCellMap[object.id].indexOf(this.getKey(bounds.x + bounds.width, bounds.y + bounds.height)) > -1) {
            return;
        }

        this.removeObject(object);
        this.addObject(object);
    }

    addObjectForPoint(object: Entity, x: number, y: number): void {
        let key = this.getKey(x, y);

        if (!this.cells[key]) {
            this.cells[key] = [];
        }

        if (this.cells[key].indexOf(object) === -1) {
            this.cells[key].push(object);
            this.objIdCellMap[object.id].push(key);
        }
    }

    getObjectBounds(object: Entity): PIXIRectangle {
        return object.data('body').bounds;
    }

    getGlobalBounds(): Bounds {
        return this.bounds;
    }

    getNearbyObjects(x: number, y: number, w: number, h: number): Entity[] {
        let objects = [];

        let cellX = Math.floor(x / this.cellSize) - 1;
        let cellY = Math.floor(y / this.cellSize) - 1;
        let cellW = Math.ceil(w / this.cellSize) + 1;
        let cellH = Math.ceil(h / this.cellSize) + 1;
        for (let iy = cellY; iy <= cellY + cellH; iy++) {
            for (let ix = cellX; ix <= cellX + cellW; ix++) {
                let cellObjs = this.getCellObjects(ix + "," + iy);
                for (let i = 0; i < cellObjs.length; i++) {
                    if (objects.indexOf(cellObjs[i]) === -1) {
                        objects.push(cellObjs[i]);
                    }
                }
            }
        }

        return objects;
    }

    getCellObjects(key: string): Entity[] {
        return this.cells[key] || [];
    }

    getCellObjectsForPoint(x: number, y: number): Entity[] {
        let key = this.getKey(x, y);
        return this.cells[key] || [];
    }
}
