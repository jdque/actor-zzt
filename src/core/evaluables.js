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

function Value(varStr) {
    this.varStr = varStr;
}

Value.prototype = Object.create(Evaluable.prototype);

Value.prototype.evaluate = function (entity) {
    if (this.varStr[0] === '_') {
        return entity.executor.currentLabelFrame.variables[this.varStr.substr(1)];
    } else {
        return entity.variables[this.varStr];
    }
}

function ArrayValue(varStrs) {
    this.varStrs = varStrs;
}

ArrayValue.prototype = Object.create(Evaluable.prototype);

ArrayValue.prototype.evaluate = function (entity) {
    var values = new Array(this.varStrs.length);

    for (var i = 0; i < this.varStrs.length; i++) {
        if (this.varStrs[i][0] === '_') {
            values[i] = entity.executor.currentLabelFrame.variables[this.varStrs[i].substr(1)];
        } else {
            values[i] = entity.variables[this.varStrs[i]];
        }
    }

    return values;
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

module.exports = {
    Evaluable: Evaluable,
    DeferredFunction: DeferredFunction,
    Value: Value,
    ArrayValue: ArrayValue,
    Expression: Expression
};