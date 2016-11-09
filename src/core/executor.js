var Evaluables = require('./evaluables.js');
var Ops = require('./ops.js');

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
        this.currentFrame.loopCount = -1;
    } else {
        this.currentFrame = {
            blockId: blockId,
            offset: offset || 0,
            variables: {},
            loopCount: -1
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

Executor.prototype.clearFrameStack = function () {
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
    this.execOp(op);

    return true;
}

Executor.prototype.execOp = function (op) {
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

    this.clearFrameStack();
    this.setCurrentFrame(blockId, blockOffset);

    for (var i = 0; i < args.length; i++) {
        if (i > params.length - 1) {
            continue;
        }
        var varName = params[i].replace('_', '');
        var value = (args[i] instanceof Evaluables.Evaluable) ? args[i].evaluate(this.entity) : args[i];
        this.currentLabelFrame.variables[varName] = value;
    }
}

Executor.prototype.execIfOp = function (op) {
    var condition = op[1];
    var successOp = op[2];
    var failOp = op[3];

    var condVal = condition instanceof Evaluables.Evaluable ? condition.evaluate(this.entity) : condition;
    if (condVal === true) {
        this.execOp(successOp);
    } else {
        if (failOp != null) {
            this.execOp(failOp);
        } else {
            this.exitCurrentFrame();
            this.currentFrame.offset++;
        }
    }
}

Executor.prototype.execLoopOp = function (op) {
    var count = op[1];
    var loopedOp = op[2];

    if (this.currentFrame.loopCount === -1) {
        var countVal = count instanceof Evaluables.Evaluable ? count.evaluate(this.entity) : count;
        this.currentFrame.loopCount = countVal;
    }

    var curCount = this.currentFrame.loopCount;
    if (curCount > 0) {
        this.currentFrame.loopCount -= 1;
        this.currentFrame.offset--;
        this.execOp(loopedOp);
    } else {
        this.currentFrame.loopCount = -1;
        this.currentFrame.offset++;
    }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Executor;
}