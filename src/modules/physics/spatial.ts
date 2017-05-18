declare var require;
interface PIXIRectangle { new(...args: any[]): PIXIRectangle; width: any; height: any; x: any; y: any; };
interface IPIXI {
    Rectangle: PIXIRectangle;
}
var PIXI: IPIXI = require('pixi');

export function Spatial(finder) {
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

Spatial.prototype.getIntersect = function (rect, offsetX, offsetY, excludeObject) {
    rect.x += offsetX || 0;
    rect.y += offsetY || 0;

    var objs = this.finder.getNearbyObjects(rect.x, rect.y, rect.width, rect.height);
    for (var i = objs.length - 1; i >= 0; i--) {
        if (!this.isIntersect(objs[i].data('body').bounds, rect) || objs[i] === excludeObject) {
            objs[i] = objs[objs.length - 1];
            objs.pop();
        }
    }

    rect.x -= offsetX || 0;
    rect.y -= offsetY || 0;

    return objs;
}

Spatial.prototype.anyIntersect = function (rect, offsetX, offsetY, excludeObject) {
    rect.x += offsetX || 0;
    rect.y += offsetY || 0;

    var objs = this.finder.getNearbyObjects(rect.x, rect.y, rect.width, rect.height);
    for (var i = objs.length - 1; i >= 0; i--) {
        if (this.isIntersect(objs[i].data('body').bounds, rect) && objs[i] !== excludeObject) {
            return true;
        }
    }

    rect.x -= offsetX || 0;
    rect.y -= offsetY || 0;

    return false;
}

Spatial.prototype.getInside = function (rect, offsetX, offsetY) {
    rect.x += offsetX || 0;
    rect.y += offsetY || 0;

    var objs = this.finder.getNearbyObjects(rect.x, rect.y, rect.width, rect.height);
    for (var i = objs.length - 1; i >= 0; i--) {
        if (!this.isInside(objs[i].data('body').bounds, rect)) {
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
        if (!this.isWithin(objs[i].data('body').bounds, rect, distance)) {
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
                    return spatial.isIntersect(obj.data('body').bounds, rect) !== notIsActive;
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
                    return spatial.isInside(obj.data('body').bounds, rect) !== notIsActive;
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
                    return spatial.isWithin(obj.data('body').bounds, fromRect, distance) !== notIsActive;
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
                    return spatial.isDirection(obj.data('body').bounds, fromRect, dirX, dirY) !== notIsActive;
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