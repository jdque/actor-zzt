function Evaluable() {
}

Evaluable.evaluate = function () {
}

function DeferredFunction(func, entity) {
    this.entity = entity;
    this.func = func;
}

DeferredFunction.prototype = Object.create(Evaluable.prototype);

DeferredFunction.prototype.evaluate = function () {
    return this.func.call(this.entity);
}

function Value(varStr, entity) {
    this.entity = entity;
    this.varStr = varStr;
}

Value.prototype = Object.create(Evaluable.prototype);

Value.prototype.evaluate = function () {
    if (this.varStr[0] === '@') {
        return this.entity.executingLabelBlock.variables[this.varStr.substr(1)];
    }
    else if (this.varStr[0] === '$') {
        return this.entity.variables[this.varStr.substr(1)];
    }
}

function Expression(expr, entity) {
    this.entity = entity;
    this.expr = new Function(
        'return ' + expr.replace(/\@/g, 'this.executingLabelBlock.variables.').replace(/\$/g, 'this.variables.')
    );
}

Expression.prototype = Object.create(Evaluable.prototype);

Expression.prototype.evaluate = function () {
    return this.expr.call(this.entity);
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        Evaluable: Evaluable,
        DeferredFunction: DeferredFunction,
        Value: Value,
        Expression: Expression
    };
}