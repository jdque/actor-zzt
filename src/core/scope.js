function Scope(scope) {
    var self     = "[obj].forEach(function (obj) {\n";
    var children = "children(obj).forEach(function (obj) {\n";
    var parent   = "[parent(obj)].forEach(function (obj) {\n";
    var siblings = "siblings(obj).forEach(function (obj) {\n";
    var board    = "[board(obj)].forEach(function (obj) {\n";
    var name     = "name(obj, '{name}').forEach(function (obj) {\n";
    var out      = "outObjs.push(obj);\n";

    var funcParts = [];
    funcParts.push('var outObjs = [];\n');

    var scopeParts = scope.split('.');
    scopeParts.forEach(function (part, idx) {
        switch (part) {
            case '':
            case '[self]':
                funcParts.push(self);
                break;
            case '*':
            case "[children]":
                if (idx === 0) {
                    funcParts.push(parent);
                }
                funcParts.push(children);
                break;
            case '<':
            case '[parent]':
                funcParts.push(parent);
                break;
            case '[siblings]':
            case '<>':
                funcParts.push(siblings);
                break;
            case '$':
            case '[board]':
                funcParts.push(board);
                break;
            default:
                if (idx === 0) {
                    funcParts.push(parent);
                }
                funcParts.push(name.replace('{name}', part));
                break;
        }
    });
    funcParts.push(out);
    var funcStr = funcParts.join("");
    for (var i = 0; i < funcParts.length - 2; i++) {
        funcStr += "});\n";
    }
    funcStr += 'return outObjs;';

    this.scopeFunc = new Function('obj, children, parent, siblings, name, board', funcStr);
}

Scope.prototype.children = function (entity) {
    return entity.board.getChildObjects(entity);
}

Scope.prototype.parent = function (entity) {
    return entity.parent || entity;
}

Scope.prototype.siblings = function (entity) {
    return entity.board
        .getChildObjects(entity.parent)
        .filter(function (sibling) {
            return sibling.id !== entity.id;
        });
}

Scope.prototype.name = function (entity, name) {
    var entities = [];

    if (entity.board.isObjectDefined(name)) {
        entities = entity.board
            .getChildObjects(entity)
            .filter(function (child) {
                return child.name === name;
            });
    } else if (entity.board.isGroupDefined(name)) {
        entities = entity.board.getObjectsInGroup(name);
    }

    return entities;
}

Scope.prototype.board = function (entity) {
    return entity.board;
}

Scope.prototype.evaluate = function (entity) {
    return this.scopeFunc(entity, this.children, this.parent, this.siblings, this.name, this.board) || [];
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Scope;
}