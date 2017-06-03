import {IEvaluable} from './evaluables';
import {Entity} from './environment';

type ArrayCallback<T> = (value: any, index: number, array: any[]) => T;

function _filter(array: any[], callback: ArrayCallback<boolean>): any[] {
    return array.filter(callback);
}

function _map(array: any[], callback: ArrayCallback<any>): any[] {
    return array.map(callback);
}

function _flatMap(array: any[], callback: ArrayCallback<any[]>): any[] {
    return [].concat(...array.map(callback));
}

function _first(array: any[], callback: ArrayCallback<any>): any[] {
    return array.length > 0 ? [callback(array[0], 0, array)] : [];
}

const fStart    = "var res = [entity];\n"
const fEnd      = "return res;"
//single selectors
const fSelf     = "res = res;\n";
const fBoard    = "res = _first(res, function (e) { return board(e); });\n";
const fParent   = "res = _first(res, function (e) { return parent(e); });\n";
//multi selectors
const fChildren = "res = _flatMap(res, function (e) { return children(e); });\n";
const fSiblings = "res = _flatMap(res, function (e) { return siblings(e); });\n";
//filters
const fName     = "res = _filter(res, function (e) { return name(e, '{entityName}'); });\n";
const fGroup    = "res = _filter(res, function (e) { return group(e, '{groupName}'); });\n";

function board(entity: Entity): Entity {
    return entity.board;
}

function parent(entity: Entity): Entity {
    return entity.parent || entity;
}

function children(entity: Entity): Entity[] {
    return entity.board
        .getChildObjects(entity);
}

function siblings(entity: Entity): Entity[] {
    return entity.board
        .getChildObjects(entity.parent)
        .filter((sibling) => sibling.id !== entity.id);
}

function name(entity: Entity, entityName: string): boolean {
    return entity.name === entityName;
}

function group(entity: Entity, groupName: string): boolean {
    return entity.board.isObjectInGroup(entity, groupName);
}

export class Scope implements IEvaluable<Entity[]> {
    private scopeFunc: Function;

    /*
     *  scope format: "part1/part2/part3/..."
     *  part format: "selector[filter1=value1,filter2=value2,...]"
     */
    constructor(scope: string) {
        let scopeParts = scope.replace(/ /g, '').split('/');

        let query = _flatMap(scopeParts, this.parsePart);
        query.unshift(fStart);
        query.push(fEnd);

        let queryStr = query.join('');
        this.scopeFunc = new Function('entity, _filter, _map, _flatMap, _first, children, parent, siblings, group, name, board', queryStr);
    }

    parsePart(part: string, idx: number): string[] {
        let query: string[] = [];

        let selector = part.split('[')[0];
        switch (selector) {
            case 'self':
            case '$':
                query.push(fSelf);
                break;
            case "children":
            case '*':
                query.push(fChildren);
                break;
            case 'parent':
            case '<':
                query.push(fParent);
                break;
            case 'siblings':
            case '<>':
                query.push(fSiblings);
                break;
            case 'board':
            case '^':
            case '':
                query.push(fBoard);
                break;
            default:
                if (idx === 0) {
                    query.push(fSiblings);
                } else {
                    query.push(fChildren);
                }
                query.push(fName.replace('{entityName}', selector));
                break;
        }

        let filtersMatch = part.match(/\[(.*?)\]/);
        if (filtersMatch) {
            filtersMatch[1].split(',').forEach((filterStr) => {
                let [name, val] = filterStr.split('=');
                switch (name) {
                    case 'group':
                        query.push(fGroup.replace('{groupName}', val));
                        break;
                    case 'name':
                        query.push(fName.replace('{entityName}', val));
                        break;
                    default:
                        throw new Error("Invalid scope filter");
                }
            });
        }

        return query;
    }

    evaluate(entity: Entity): Entity[] {
        return this.scopeFunc(entity, _filter, _map, _flatMap, _first, children, parent, siblings, group, name, board) || [];
    }
}