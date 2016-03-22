var Util = require('./util.js');
var Evaluables = require('./evaluables.js');

function Block(varParams) {
    this._id = Util.generateId().toString();
    this.commands = [];
    this.variableParams = varParams || [];
    this.variables = {};
    this.index = -1;
}

Block.prototype.id = function () {
    return this._id;
}

Block.prototype.add = function (command) {
    this.commands.push(command);
}

Block.prototype.reset = function () {
    this.index = -1;
    this.variables = {};
}

Block.prototype.gotoOffset = function (offset) {
    if (offset + 1 > this.commands.length) {
        this.index = this.commands.length - 2;
    }
    else {
        this.index = offset - 1;
    }
}

Block.prototype.execNext = function () {
    if (this.index >= this.commands.length)
        return false;

    this.index++;
    this.commands[this.index]();
    return true;
}

Block.prototype.injectArguments = function (varArgs) {
    if (!varArgs)
        return;

    for (var i = 0; i < varArgs.length; i++) {
        if (i > this.variableParams.length - 1) {
            continue;
        }
        var varName = this.variableParams[i].replace('\@', '');
        var value = varArgs[i];
        this.variables[varName] = (value instanceof Evaluables.Evaluable) ? value.evaluate() : value;
    }
}

function IfBlock() {
    Block.apply(this);

    this.conditionIdxs = [];
    this.currentCondition = 0;
}

IfBlock.prototype = Object.create(Block.prototype);

IfBlock.prototype.reset = function () {
    Block.prototype.reset.apply(this);
    this.currentCondition = 0;

}
IfBlock.prototype.addBranch = function (command) {
    this.commands.push(command);
    this.conditionIdxs.push(this.commands.length - 2);
}

IfBlock.prototype.nextCondition = function () {
    this.currentCondition++;

    if (this.currentCondition === this.conditionIdxs.length) {
        return false;
    }

    this.index = this.conditionIdxs[this.currentCondition];
    return true;
}

function LoopBlock(count) {
    Block.apply(this);

    this.count = count || 0;
    this.execCount = 0;
    this.currentCount = 0;
}

LoopBlock.prototype = Object.create(Block.prototype);

LoopBlock.prototype.reset = function () {
    Block.prototype.reset.apply(this);
    this.currentCount = 0;
    this.execCount = this.count instanceof Evaluables.Evaluable ? this.count.evaluate() : this.count;
}

LoopBlock.prototype.iterate = function () {
    if (typeof this.execCount !== 'number') {
        return false;
    }

    this.currentCount++;
    if (this.currentCount > this.execCount) {
        return false;
    }

    return true;
}

LoopBlock.prototype.restart = function () {
    this.index = -1;
}

function LabelBlockGroup() {
    this.blockRefs = [];
    this.activeBlockIdx = 0;
}

LabelBlockGroup.prototype.addBlockRef = function (blockId, offset) {
    this.blockRefs.push({
        blockId: blockId,
        offset: offset || 0
    });
}

LabelBlockGroup.prototype.getActiveBlockRef = function () {
    return this.blockRefs[this.activeBlockIdx];
}

LabelBlockGroup.prototype.disableActiveBlockRef = function () {
    if (this.activeBlockIdx < this.blockRefs.length)
        this.activeBlockIdx++;
}

LabelBlockGroup.prototype.enablePreviousBlockRef = function () {
    if (this.activeBlockIdx > 0)
        this.activeBlockIdx--;
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        Block: Block,
        IfBlock: IfBlock,
        LoopBlock: LoopBlock,
        LabelBlockGroup: LabelBlockGroup
    };
}