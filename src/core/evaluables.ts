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