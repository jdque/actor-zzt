var PIXI = require('lib/pixi.dev.js');
var ZZT = require('src/zzt.js');

function GridHash(cellSize) {
    this.cellSize = cellSize || 64;
    this.cells = {};
    this.objIdCellMap = {};
    this.bounds = {min: new PIXI.Point(0, 0), max: new PIXI.Point(0, 0)};
}

GridHash.prototype.getKey = function (x, y) {
    var cellX = Math.floor(x / this.cellSize);
    var cellY = Math.floor(y / this.cellSize);
    return cellX + "," + cellY;
}

GridHash.prototype.addObject = function (object) {
    if (this.objIdCellMap[object.id]) {
        return;
    }

    this.objIdCellMap[object.id] = [];

    var bounds = object.body.bounds;

    //Insert corner points
    this.addObjectForPoint(object, bounds.x, bounds.y);
    this.addObjectForPoint(object, bounds.x + bounds.width, bounds.y);
    this.addObjectForPoint(object, bounds.x, bounds.y + bounds.height);
    this.addObjectForPoint(object, bounds.x + bounds.width, bounds.y + bounds.height);

    //Insert intermediate points, spaced by cell size
    for (var y = bounds.y + this.cellSize, endY = bounds.y + bounds.height; y < endY; y += this.cellSize) {
        for (var x = bounds.x + this.cellSize, endX = bounds.x + bounds.width; x < endX; x += this.cellSize) {
            this.addObjectForPoint(x, y, object);
        }
    }

    //Update global bounds
    if (bounds.x < this.bounds.min.x) this.bounds.min.x = bounds.x;
    if (bounds.y < this.bounds.min.y) this.bounds.min.y = bounds.y;
    if (bounds.x + bounds.width > this.bounds.max.x) this.bounds.max.x = bounds.x + bounds.width;
    if (bounds.y + bounds.height > this.bounds.max.y) this.bounds.max.y = bounds.y + bounds.height;
}

GridHash.prototype.removeObject = function (object) {
    if (!this.objIdCellMap[object.id]) {
        return;
    }

    for (var i = 0; i < this.objIdCellMap[object.id].length; i++) {
        var cell = this.cells[this.objIdCellMap[object.id][i]];
        cell[cell.indexOf(object)] = cell[cell.length - 1];
        cell.pop();
    }
    this.objIdCellMap[object.id] = null;
}

GridHash.prototype.updateObject = function (object) {
    if (!this.objIdCellMap[object.id]) {
        return;
    }

    var bounds = object.body.bounds;

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

GridHash.prototype.addObjectForPoint = function (object, x, y) {
    var key = this.getKey(x, y);

    if (!this.cells[key]) {
        this.cells[key] = [];
    }

    if (this.cells[key].indexOf(object) === -1) {
        this.cells[key].push(object);
        this.objIdCellMap[object.id].push(key);
    }
}

GridHash.prototype.getNearbyObjects = function (x, y, w, h) {
    var objects = [];

    var cellX = Math.floor(x / this.cellSize) - 1;
    var cellY = Math.floor(y / this.cellSize) - 1;
    var cellW = Math.ceil(w / this.cellSize) + 1;
    var cellH = Math.ceil(h / this.cellSize) + 1;
    for (var y = cellY; y <= cellY + cellH; y++) {
        for (var x = cellX; x <= cellX + cellW; x++) {
            var cellObjs = this.getCellObjects(x + "," + y);
            for (var i = 0; i < cellObjs.length; i++) {
                if (objects.indexOf(cellObjs[i]) === -1) {
                    objects.push(cellObjs[i]);
                }
            }
        }
    }

    return objects;
}

GridHash.prototype.getBounds = function () {
    return this.bounds;
}

GridHash.prototype.getCellObjects = function (key) {
    return this.cells[key] || [];
}

GridHash.prototype.getCellObjectsForPoint = function (x, y) {
    var key = this.getKey(x, y);
    return this.cells[key] || [];
}

function Spatial(finder) {
    this.finder = finder;
    this.objects = [];
}

Spatial.prototype.register = function (object) {
    if (this.objects.indexOf(object) !== -1) {
        return;
    }
    this.objects.push(object);
    this.finder.addObject(object);
}

Spatial.prototype.unregister = function (object) {
    var idx = this.objects.indexOf(object);
    if (idx === -1) {
        return;
    }
    this.objects[idx] = this.objects[this.objects.length - 1];
    this.objects.pop();
    this.finder.removeObject(object);
}

Spatial.prototype.update = function (object) {
    this.finder.updateObject(object);
}

Spatial.prototype.isIntersect = function (rect1, rect2) {
    if (rect1.x + rect1.width > rect2.x &&
        rect1.x < rect2.x + rect2.width &&
        rect1.y + rect1.height > rect2.y &&
        rect1.y < rect2.y + rect2.height) {
        return true;
    }

    return false;
}

Spatial.prototype.isInside = function (testRect, inRect) {
    if (testRect.x >= inRect.x &&
        testRect.y >= inRect.y &&
        testRect.x + testRect.width <= inRect.x + inRect.width &&
        testRect.y + testRect.height <= inRect.y + inRect.height) {
        return true;
    }

    return false;
}

Spatial.prototype.isWithin = function (testRect, fromRect, distance) {
    if (this.isIntersect(testRect, fromRect)) {
        return true;
    }

    var fromX = 0;
    var fromY = 0;
    var testX = 0;
    var testY = 0;

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

Spatial.prototype.isDirection = function (testRect, fromRect, dirX, dirY) {
    if (dirX === -1 && testRect.x + testRect.width > fromRect.x) return false;
    if (dirX === 1 && testRect.x < fromRect.x + fromRect.width) return false;
    if (dirY === -1 && testRect.y + testRect.height > fromRect.y) return false;
    if (dirY === 1 && testRect.y < fromRect.y + fromRect.height) return false;

    return true;
}

Spatial.prototype.getAll = function () {
    return this.objects;
}

Spatial.prototype.getIntersect = function (rect, offsetX, offsetY) {
    rect.x += offsetX || 0;
    rect.y += offsetY || 0;

    var objs = this.finder.getNearbyObjects(rect.x, rect.y, rect.width, rect.height);
    for (var i = objs.length - 1; i >= 0; i--) {
        if (!this.isIntersect(objs[i].body.bounds, rect)) {
            objs[i] = objs[objs.length - 1];
            objs.pop();
        }
    }

    rect.x -= offsetX || 0;
    rect.y -= offsetY || 0;

    return objs;
}

Spatial.prototype.getInside = function (rect, offsetX, offsetY) {
    rect.x += offsetX || 0;
    rect.y += offsetY || 0;

    var objs = this.finder.getNearbyObjects(rect.x, rect.y, rect.width, rect.height);
    for (var i = objs.length - 1; i >= 0; i--) {
        if (!this.isInside(objs[i].body.bounds, rect)) {
            objs[i] = objs[objs.length - 1];
            objs.pop();
        }
    }

    rect.x -= offsetX || 0;
    rect.y -= offsetY || 0;

    return objs;
}

Spatial.prototype.getWithin = function (rect, distance) {
    var objs = this.finder.getNearbyObjects(rect.x - distance, rect.y - distance, rect.width + distance * 2, rect.height + distance * 2);
    for (var i = objs.length - 1; i >= 0; i--) {
        if (!this.isWithin(objs[i].body.bounds, rect, distance)) {
            objs[i] = objs[objs.length - 1];
            objs.pop();
        }
    }

    return objs;
}

Spatial.prototype.getDirection = function (rect, dirX, dirY) {
    var queryRect = new PIXI.Rectangle(0, 0, 0, 0);
    var bounds = this.finder.getBounds();
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

Spatial.prototype.query = function () {
    return (function (spatial) {
        var resultSet = null;
        var notIsActive = false;

        function listDiff(list, removeList) {
            var diffList = []
            for (var i = 0; i < list.length; i++) {
                if (removeList.indexOf(list[i]) === -1) {
                    diffList.push(list[i]);
                }
            }

            return diffList;
        }

        function all() {
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

        function intersect(rect, offsetX, offsetY) {
            if (!resultSet) {
                if (notIsActive) {
                    resultSet = listDiff(spatial.getAll(), spatial.getIntersect(rect, offsetX, offsetY));
                }
                else {
                    resultSet = spatial.getIntersect(rect, offsetX, offsetY);
                }
            }
            else {
                resultSet = resultSet.filter(function (obj) {
                    return spatial.isIntersect(obj.body.bounds, rect) !== notIsActive;
                });
            }

            notIsActive = false;
            return closure;
        }

        function inside(rect, offsetX, offsetY) {
            if (!resultSet) {
                if (notIsActive) {
                    resultSet = listDiff(spatial.getAll(), spatial.getInside(rect, offsetX, offsetY));
                }
                else {
                    resultSet = spatial.getInside(rect, offsetX, offsetY);
                }
            }
            else {
                resultSet = resultSet.filter(function (obj) {
                    return spatial.isInside(obj.body.bounds, rect) !== notIsActive;
                });
            }

            notIsActive = false;
            return closure;
        }

        function distance(fromRect, distance) {
            if (!resultSet) {
                if (notIsActive) {
                    resultSet = listDiff(spatial.getAll(), spatial.getWithin(fromRect, distance));
                }
                else {
                    resultSet = spatial.getWithin(fromRect, distance);
                }
            }
            else {
                resultSet = resultSet.filter(function (obj) {
                    return spatial.isWithin(obj.body.bounds, fromRect, distance) !== notIsActive;
                });
            }

            notIsActive = false;
            return closure;
        }

        function direction(fromRect, dirX, dirY) {
            if (!resultSet) {
                if (notIsActive) {
                    resultSet = listDiff(spatial.getAll(), spatial.getDirection(fromRect, dirX, dirY));
                }
                else {
                    resultSet = spatial.getDirection(fromRect, dirX, dirY);
                }
            }
            else {
                resultSet = resultSet.filter(function (obj) {
                    return spatial.isDirection(obj.body.bounds, fromRect, dirX, dirY) !== notIsActive;
                });
            }

            notIsActive = false;
            return closure;
        }

        function not() {
            notIsActive = !notIsActive;
            return closure;
        }

        function get() {
            return resultSet;
        }

        var closure = {
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

var PhysicsCommandSet = {};

PhysicsCommandSet.getDirectionDelta = function (dir, entity) {
    var dx = 0;
    var dy = 0;

    if (dir === 'flow') {
        return entity.body.lastDelta;
    }

    switch(dir) {
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
    }

    return {dx: dx, dy: dy};
}

PhysicsCommandSet.parseCommands = function (parser, entity) {
    var body = {
        blocked: function (dir) {
            return new ZZT.DeferredFunction(function () {
                var blocked = false;
                var delta = PhysicsCommandSet.getDirectionDelta(dir, entity);

                entity.body.bounds.x += delta.dx;
                entity.body.bounds.y += delta.dy;

                var objs = entity.body.spatial.getIntersect(entity.body.bounds);
                if (objs.length > 1) {
                    blocked = true;
                }

                var tileMapCollide = entity.board.boardEntity.pixiObject.anyTileInRect(entity.body.bounds);
                if (tileMapCollide) {
                    blocked = true;
                }

                entity.body.bounds.x -= delta.dx;
                entity.body.bounds.y -= delta.dy;

                return blocked;
            }, entity);
        },

        dir: function (dir) {
            return {
                evaluate: function (entity) {
                    var delta = PhysicsCommandSet.getDirectionDelta(dir, entity);
                    var objs = entity.body.spatial.query()
                        .distance(entity.body.bounds, 1)
                        .direction(entity.body.bounds, delta.dx / 8, delta.dy / 8)
                        .get();
                    return objs;
                }
            };
        },

        move_to: parser._defaultParseFunc(entity.commands.body.move_to),
        move_by: parser._defaultParseFunc(entity.commands.body.move_by),

        move: function (dirStr) {
            var dirs = dirStr.split('/');
            for (var i = 0; i < dirs.length; i++) {
                if (dirs[i].length === 0)
                    continue;

                parser.currentBlock.add(entity.commands.body.move.fastBind(entity, dirs[i]));
                parser.commands.wait(5);
            }
        }
    };

    return {
        body: body
    };
};

PhysicsCommandSet.runCommands = function (entity) {
    var body = {
        __init__: function (params) {
            entity.body = {
                bounds: params.bounds.clone(),
                spatial: params.spatial,
                lastDelta: {dx: 0, dy: 0}
            };

            entity.body.spatial.register(entity);
        },

        __destroy__: function () {
            entity.body.spatial.unregister(entity);
            entity.body = null;
        },

        move_to: function (x, y) {
            if (!entity.body)
                return;

            var x = x instanceof ZZT.Evaluable ? x.evaluate() : x;
            var y = y instanceof ZZT.Evaluable ? y.evaluate() : y;

            entity.body.bounds.x = x;
            entity.body.bounds.y = y;
            entity.body.spatial.update(entity);

            if (entity.pixiObject) {
                entity.pixiObject.position.x = entity.body.bounds.x;
                entity.pixiObject.position.y = entity.body.bounds.y;
            }
        },

        move_by: function (dx, dy) {
            if (!entity.body)
                return;

            var dx = dx instanceof ZZT.Evaluable ? dx.evaluate() : dx;
            var dy = dy instanceof ZZT.Evaluable ? dy.evaluate() : dy;

            entity.body.bounds.x += dx;
            entity.body.bounds.y += dy;

            var objs = entity.body.spatial.getIntersect(entity.body.bounds);
            if (objs.length > 1) {
                entity.body.bounds.x -= dx;
                entity.body.bounds.y -= dy;
            }

            if (entity.board.boardEntity.pixiObject.anyTileInRect(entity.body.bounds)) {
                entity.body.bounds.x -= dx;
                entity.body.bounds.y -= dy;
            }

            entity.body.spatial.update(entity);

            if (entity.pixiObject) {
                entity.pixiObject.position.x = entity.body.bounds.x;
                entity.pixiObject.position.y = entity.body.bounds.y;
            }
        },

        move: function (dir) {
            var delta = PhysicsCommandSet.getDirectionDelta(dir, entity);
            entity.commands.body.move_by(delta.dx, delta.dy);
            entity.body.lastDelta = delta;
        }
    };

    return {
        body: body
    };
};

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        GridHash: GridHash,
        Spatial: Spatial,
        PhysicsCommandSet: PhysicsCommandSet
    };
}