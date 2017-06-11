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
const fName     = "res = _filter(res, function (e) { return name(e, {entityName}); });\n";
const fGroup    = "res = _filter(res, function (e) { return group(e, {groupName}); });\n";

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

export type ScopePart = [string, {[filter: string]: any}] | string;

export class Scope implements IEvaluable<Entity[]> {
    private scopeFunc: Function;

    constructor(scope: ScopePart[] | string) {
        let scopeArray = typeof scope === 'string' ? this.toScopeArray(scope) : scope;

        let query = _flatMap(scopeArray, this.parsePart);
        query.unshift(fStart);
        query.push(fEnd);

        let queryStr = query.join('');
        this.scopeFunc = new Function('entity, _filter, _map, _flatMap, _first, children, parent, siblings, group, name, board', queryStr);
    }

    /*
     *  scope string format: "part1/part2/part3/..."
     *  part string format: "selector[filter1=value1,filter2=value2,...]"
     */
    toScopeArray(scopeStr: string): ScopePart[] {
        let parts = scopeStr.replace(/ /g, '').split('/');
        let scopeArr: ScopePart[] = [];
        for (let part of parts) {
            let selector = part.split('[')[0];
            let filters: {[name: string]: any} = null;
            let filtersMatch = part.match(/\[(.*?)\]/);
            if (filtersMatch) {
                filters = {};
                for (let filterStr of filtersMatch[1].split(',')) {
                    let [name, val] = filterStr.split('=');
                    filters[name] = val;
                }
            }
            scopeArr.push(filters ? [selector, filters] : selector);
        }
        return scopeArr;
    }

    parsePart(part: ScopePart, idx: number): string[] {
        let query: string[] = [];
        let [selector, filters] = part instanceof Array ? part : [part, null];

        if (typeof selector !== 'string') {
            throw new Error("Invalid selector");
        }

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
                query.push(fName.replace('{entityName}', `"${selector}"`));
                break;
        }

        if (filters) {
            for (let name in filters) {
                let val = filters[name];
                //TODO - support IEValauble filter values
                let valStr = `"${val}"`;
                switch (name) {
                    case 'group':
                        query.push(fGroup.replace('{groupName}', valStr));
                        break;
                    case 'name':
                    case '@':
                        query.push(fName.replace('{entityName}', valStr));
                        break;
                    default:
                        throw new Error("Invalid scope filter");
                }
            }
        }

        return query;
    }

    evaluate(entity: Entity): Entity[] {
        return this.scopeFunc(entity, _filter, _map, _flatMap, _first, children, parent, siblings, group, name, board) || [];
    }
}