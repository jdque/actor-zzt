import {Entity} from './environment';

export interface IEvaluable<T> {
    evaluate(entity: Entity): T
}

export function isEvaluable(object: any): object is IEvaluable<any> {
    return typeof object === 'object' && typeof object['evaluate'] === 'function';
}

export class DeferredFunction implements IEvaluable<any> {
    private func: (entity: Entity) => any;

    constructor(func: (entity: Entity) => any) {
        this.func = func;
    }

    evaluate(entity: Entity): any {
        return this.func(entity);
    }
}

export class Value implements IEvaluable<any> {
    private varName: string;

    constructor(varName: string) {
        this.varName = varName;
    }

    evaluate(entity: Entity): any {
        if (this.varName in entity.execState.currentLabelFrame.variables) {
            return entity.execState.currentLabelFrame.variables[this.varName];
        } else {
            return entity.variables[this.varName];
        }
    }
}

export class ArrayValue implements IEvaluable<any[]> {
    private varNames: string[];

    constructor(varNames: string[]) {
        this.varNames = varNames;
    }

    evaluate(entity: Entity): any[] {
        let values: any[] = new Array(this.varNames.length);

        for (let varName of this.varNames) {
            if (varName in entity.execState.currentLabelFrame.variables) {
                return entity.execState.currentLabelFrame.variables[varName];
            } else {
                return entity.variables[varName];
            }
        }

        return values;
    }
}

export class Expression implements IEvaluable<any> {
    private expr: Function;

    constructor(expr: string) {
        this.expr = new Function(
            'return ' +
            expr.replace(/\$\_/g, 'this.execState.currentLabelFrame.variables.')
                .replace(/\$/g, 'this.variables.')
        );
    }

    evaluate(entity: Entity): any {
        return this.expr.call(entity);
    }
}

export class Scope implements IEvaluable<Entity[]> {
    private static fSelf     = "[obj].forEach(function (obj) {\n";
    private static fChildren = "children(obj).forEach(function (obj) {\n";
    private static fParent   = "[parent(obj)].forEach(function (obj) {\n";
    private static fSiblings = "siblings(obj).forEach(function (obj) {\n";
    private static fBoard    = "[board(obj)].forEach(function (obj) {\n";
    private static fName     = "name(obj, '{name}').forEach(function (obj) {\n";
    private static fOut      = "outObjs.push(obj);\n";

    private scopeFunc: Function;

    constructor(scope: string) {
        let funcParts = [];
        funcParts.push('var outObjs = [];\n');

        let scopeParts = scope.split('.');
        scopeParts.forEach(function (part, idx) {
            switch (part) {
                case '':
                case '[self]':
                    funcParts.push(Scope.fSelf);
                    break;
                case '*':
                case "[children]":
                    if (idx === 0) {
                        funcParts.push(Scope.fParent);
                    }
                    funcParts.push(Scope.fChildren);
                    break;
                case '<':
                case '[parent]':
                    funcParts.push(Scope.fParent);
                    break;
                case '[siblings]':
                case '<>':
                    funcParts.push(Scope.fSiblings);
                    break;
                case '$':
                case '[board]':
                    funcParts.push(Scope.fBoard);
                    break;
                default:
                    if (idx === 0) {
                        funcParts.push(Scope.fParent);
                    }
                    funcParts.push(Scope.fName.replace('{name}', part));
                    break;
            }
        });
        funcParts.push(Scope.fOut);
        let funcStr = funcParts.join("");
        for (let i = 0; i < funcParts.length - 2; i++) {
            funcStr += "});\n";
        }
        funcStr += 'return outObjs;';

        this.scopeFunc = new Function('obj, children, parent, siblings, name, board', funcStr);
    }

    private children(entity: Entity): Entity[] {
        return entity.board.getChildObjects(entity);
    }

    private parent(entity: Entity): Entity {
        return entity.parent || entity;
    }

    private siblings(entity: Entity): Entity[] {
        return entity.board
            .getChildObjects(entity.parent)
            .filter(function (sibling) {
                return sibling.id !== entity.id;
            });
    }

    private name(entity: Entity, name: string): Entity[] {
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

    private board(entity: Entity): Entity {
        return entity.board;
    }

    evaluate(entity: Entity): Entity[] {
        return this.scopeFunc(entity, this.children, this.parent, this.siblings, this.name, this.board) || [];
    }
}