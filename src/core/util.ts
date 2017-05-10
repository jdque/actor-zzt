/*Function.prototype.fastBind = function (context) {
    var self = this;
    var curriedArgs = Array.prototype.slice.call(arguments, 1);
    if (curriedArgs.length) {
        return function () {
            var allArgs = curriedArgs.slice(0);
            for (var i = 0, n = arguments.length; i < n; ++i) {
                allArgs.push(arguments[i]);
            }
            self.apply(context, allArgs);
        };
    }
    else {
        return function () {
            self.apply(context)
        }
    }
}*/

type ObjLiteral = {[key: string]: any};

export class Util {
    static currentId: number = 0;

    static generateId(): number {
        return Util.currentId++;
    }

    static extend(destination: ObjLiteral, source: ObjLiteral): ObjLiteral {
        for (let k in source) {
            if (source.hasOwnProperty(k)) {
                destination[k] = source[k];
            }
        }
        return destination;
    }
}