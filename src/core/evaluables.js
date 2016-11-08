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
    if (typeof this.varStr === 'string') {
        if (this.varStr[0] === '@') {
            return entity.executor.currentLabelFrame.variables[this.varStr.substr(1)];
        }
        else if (this.varStr[0] === '$') {
            return entity.variables[this.varStr.substr(1)];
        }
    }
    else if (typeof this.varStr === 'function') {
        return this.varStr();
    }
}

function Expression(expr) {
    this.expr = new Function(
        'return ' + expr.replace(/\@/g, 'this.executor.currentLabelFrame.variables.').replace(/\$/g, 'this.variables.')
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