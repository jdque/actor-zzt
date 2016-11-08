var Util = require('./util.js');
var Evaluables = require('./evaluables.js');

var Type = {
    SIMPLE_OP: 0,
    ENTER_OP:  1,
    EXIT_OP:   2,
    JUMP_OP:   3,
    IF_OP:     4,
    LOOP_OP:   5
};

//OP: <type, command, arg[]>
var SimpleOp = {
    create: function (commandName, args) {
        return [Type.SIMPLE_OP, commandName, args || []];
    }
}

//ENTER: <type, block>
var EnterOp = {
    create: function (blockId) {
        return [Type.ENTER_OP, blockId];
    }
}

//EXIT: <type, block>
var ExitOp = {
    create: function (blockId) {
        return [Type.EXIT_OP, blockId];
    }
}

//JUMP: <type, label, arg[]>
var JumpOp = {
    create: function (labelName, args) {
        return [Type.JUMP_OP, labelName, args || []];
    }
}

//COND: <type, cond, success_block, fail_block>
var IfOp = {
    create: function (condition, successBlockId, failBlockId) {
        if (typeof condition === 'string') {
            condition = new Evaluables.Expression(condition);
        }

        return [Type.IF_OP, condition, successBlockId, failBlockId];
    }
}

//LOOP: <type, count, block>
var LoopOp = {
    create: function (count, blockId) {
        if (typeof count === 'string') {
            count = new Evaluables.Expression(count);
        }

        return [Type.LOOP_OP, count, blockId];
    }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        Type: Type,
        SimpleOp: SimpleOp,
        EnterOp: EnterOp,
        ExitOp: ExitOp,
        JumpOp: JumpOp,
        IfOp: IfOp,
        LoopOp: LoopOp
    }
}