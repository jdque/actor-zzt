function Evaluable() {
}

Evaluable.evaluate = function () {
}

function DeferredFunction(func) {
    this.func = func;
}

DeferredFunction.prototype = Object.create(Evaluable.prototype);

DeferredFunction.prototype.evaluate = function (entity) {
    return this.func(entity);
}

function Value(target) {
    this.target = target;
}

Value.prototype = Object.create(Evaluable.prototype);

Value.prototype.evaluate = function (entity) {
    var outValue = null;

    if (typeof this.target === 'string') {
        if (this.target[0] === '_') {
            outValue = entity.executor.currentLabelFrame.variables[this.target.substr(1)];
        } else {
            outValue = entity.variables[this.target];
        }
    } else if (this.target instanceof Array) {
        outValue = this.target.map(function (varStr) {
            if (varStr[0] === '_') {
                return entity.executor.currentLabelFrame.variables[varStr.substr(1)];
            } else {
                return entity.variables[varStr];
            }
        });
    }

    return outValue;
}

function Expression(expr) {
    this.expr = new Function(
        'return ' + expr.replace(/\$\_/g, 'this.executor.currentLabelFrame.variables.').replace(/\$/g, 'this.variables.')
    );
}

Expression.prototype = Object.create(Evaluable.prototype);

Expression.prototype.evaluate = function (entity) {
    return this.expr.call(entity);
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        Evaluable: Evaluable,
        DeferredFunction: DeferredFunction,
        Value: Value,
        Expression: Expression
    };
}