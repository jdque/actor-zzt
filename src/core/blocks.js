var Util = require('./util.js');
var Evaluables = require('./evaluables.js');
var Ops = require('./ops.js');

function LabelStore() {
    this.labels = {};
    this.offsets = {};
}

LabelStore.prototype.add = function (labelOp) {
    var name = labelOp[0];
    if (this.labels[name]) {
        this.labels[name].push(labelOp);
    } else {
        this.labels[name] = [labelOp];
        this.offsets[name] = 0;
    }
}

LabelStore.prototype.get = function (labelName) {
    if (!this.hasEnabled(labelName)) {
        return null;
    }

    return this.labels[labelName][this.offsets[labelName]];
}

LabelStore.prototype.hasEnabled = function (labelName) {
    if (!this.labels[labelName]) {
        return false;
    }
    if (this.offsets[labelName] >= this.labels[labelName].length) {
        return false;
    }

    return true;
}

LabelStore.prototype.disableCurrent = function (labelName) {
    if (!this.hasEnabled(labelName)) {
        return;
    }

    this.offsets[labelName] += 1;
}

LabelStore.prototype.enablePrevious = function (labelName) {
    if (!this.labels[labelName] || this.offsets[labelName] === 0) {
        return;
    }

    this.offsets[labelName] -= 1;
}

function BlockStore() {
    this.blocks = {};
}

BlockStore.prototype.add = function (block) {
    var id = block[0];
    this.blocks[id] = block;
}

BlockStore.prototype.get = function (blockId) {
    return this.blocks[blockId];
}

function Executor(commands, labelStore, blockStore, entity) {
    this.commands = commands;
    this.labelStore = labelStore;
    this.blockStore = blockStore;
    this.entity = entity;

    this.currentLabelFrame = null;
    this.currentFrame = null;
    this.frameStack = [];
}

Executor.prototype.setCurrentFrame = function (blockId, offset) {
    if (this.currentFrame && blockId === this.currentFrame.blockId) {
        this.currentFrame.offset = offset;
        this.currentFrame.variables = {};
        this.currentFrame.loopStates = {};
    } else {
        this.currentFrame = {
            blockId: blockId,
            offset: offset || 0,
            variables: {},
            loopStates: {}
        };
        if (this.frameStack.length === 0) {
            this.currentLabelFrame = this.currentFrame;
        }
        this.frameStack.push(this.currentFrame);
    }
}

Executor.prototype.exitCurrentFrame = function () {
    this.frameStack.pop();
    this.currentFrame = this.frameStack[this.frameStack.length - 1];
}

Executor.prototype.reset = function () {
    this.currentLabelFrame = null;
    this.currentFrame = null;
    this.frameStack = [];
}

Executor.prototype.step = function () {
    var opList = this.blockStore.get(this.currentFrame.blockId)[2];
    if (this.currentFrame.offset === opList.length) {
        return false;
    }

    var op = opList[this.currentFrame.offset];
    var opType = op[0];
    switch (opType) {
        case Ops.Type.SIMPLE_OP:
            this.execSimpleOp(op);
            break;
        case Ops.Type.ENTER_OP:
            this.execEnterOp(op);
            break;
        case Ops.Type.EXIT_OP:
            this.execExitOp(op);
            break;
        case Ops.Type.JUMP_OP:
            this.execJumpOp(op);
            break;
        case Ops.Type.IF_OP:
            this.execIfOp(op);
            break;
        case Ops.Type.LOOP_OP:
            this.execLoopOp(op);
            break;
    }

    return true;
}

Executor.prototype.execSimpleOp = function (op) {
    var name = op[1];
    var args = op[2];

    //TODO: predetermine command path
    var module = this.commands;
    var commandPath = name.split('.');
    for (var i = 0; i < commandPath.length - 1; i++) {
        module = module[commandPath[i]];
    }
    var command = module[commandPath[commandPath.length - 1]];

    var evaluatedArgs = [];
    for (var i = 0; i < args.length; i++) {
        evaluatedArgs.push(args[i] instanceof Evaluables.Evaluable ? args[i].evaluate(this.entity) : args[i]);
    }

    command.apply(null, evaluatedArgs);

    if (this.currentFrame) {
        this.currentFrame.offset++;
    }
}

Executor.prototype.execEnterOp = function (op) {
    var blockId = op[1];
    this.setCurrentFrame(blockId);
}

Executor.prototype.execExitOp = function (op) {
    var blockId = op[1];
    //TODO: need to validate?
    this.exitCurrentFrame();
    this.currentFrame.offset++;
}

Executor.prototype.execJumpOp = function (op) {
    var label = this.labelStore.get(op[1]);
    if (!label) {
        this.currentFrame.offset++;
        return;
    }

    var args = op[2];
    var params = label[1];
    var blockId = label[2];
    var blockOffset = label[3];

    this.reset();
    this.setCurrentFrame(blockId, blockOffset);

    for (var i = 0; i < args.length; i++) {
        if (i > params.length - 1) {
            continue;
        }
        var varName = params[i].replace('\@', '');
        var value = (args[i] instanceof Evaluables.Evaluable) ? args[i].evaluate(this.entity) : args[i];
        this.currentLabelFrame.variables[varName] = value;
    }
}

Executor.prototype.execIfOp = function (op) {
    var condition = op[1];
    var successBlockId = op[2];
    var failBlockId = op[3];

    if (condition.evaluate(this.entity) === true) {
        this.setCurrentFrame(successBlockId);
    } else {
        if (failBlockId != null) {
            this.setCurrentFrame(failBlockId);
        } else {
            this.exitCurrentFrame();
            this.currentFrame.offset++;
        }
    }
}

Executor.prototype.execLoopOp = function (op) {
    var count = op[1];
    var blockId = op[2];

    if (!this.currentFrame.loopStates.hasOwnProperty(blockId)) {
        var count = count instanceof Evaluables.Evaluable ? count.evaluate(this.entity) : count;
        this.currentFrame.loopStates[blockId] = count;
    }

    var curCount = this.currentFrame.loopStates[blockId];
    if (curCount > 0) {
        this.currentFrame.loopStates[blockId] -= 1;
        this.currentFrame.offset--;
        this.setCurrentFrame(blockId);
    } else {
        delete this.currentFrame.loopStates[blockId];
        this.currentFrame.offset++;
    }
}

//BLOCK: <id, param[], op[]>
var Block = {
    create: function (params) {
        return [Util.generateId().toString(), params || [], []];
    }
}

//LABEL: <name, param[], block, offset>
var Label = {
    create: function (name, params, blockId, offset) {
        return [name, params, blockId, offset];
    }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        Executor: Executor,
        LabelStore: LabelStore,
        BlockStore: BlockStore,
        Block: Block,
        Label: Label
    }
}