var Evaluables = require('./evaluables.js');
var Blocks = require('./blocks.js');
var Ops = require('./ops.js');
var Scope = require('./scope.js');

var DefaultCommandSet = {};

DefaultCommandSet.parseCommands = function (parser, entity) { return {
    val: function (varStr) {
        return new Evaluables.Value(varStr);
    },

    expr: function (expr) {
        return new Evaluables.Expression(expr);
    },

    label: function (name, params) {
        if (!parser.hasActiveBlock()) {
            var block = Blocks.Block.create([]);
            var blockId = block[0];
            parser.registerBlock(block);
            parser.setCurrentBlock(blockId);
        }

        var label = Blocks.Label.create(name, params, parser.getBlockId(), parser.getBlockOffset());
        parser.registerLabel(label);
    },

    end: function () {
        if (!parser.hasActiveBlock()) {
            return;
        }

        parser.addOp(Ops.SimpleOp.create('end', []));
        parser.exitCurrentBlock();
    },

    _if: function (condition) {
        var ifBlock = Blocks.Block.create([]);
        var ifBlockId = ifBlock[0];
        parser.registerBlock(ifBlock);

        var successBlock = Blocks.Block.create([]);
        var successBlockId = successBlock[0];
        parser.registerBlock(successBlock);

        var ifOp = Ops.IfOp.create(condition, successBlockId, null);
        parser.addOp(Ops.EnterOp.create(ifBlockId));
        parser.setCurrentBlock(ifBlockId);
        parser.addOp(ifOp);
        parser.addOp(Ops.ExitOp.create(parser.getBlockId()));
        parser.setCurrentBlock(successBlockId);
    },

    _elif: function (condition) {
        var exitOp = Ops.ExitOp.create(parser.getBlockId());
        parser.addOp(exitOp);
        parser.exitCurrentBlock();

        var prevIfOp = parser.getFirstBlockOp();
        var prevFailBlock = Blocks.Block.create([]);
        var prevFailBlockId = prevFailBlock[0];
        parser.registerBlock(prevFailBlock);
        prevIfOp[3] = prevFailBlockId;

        var successBlock = Blocks.Block.create([]);
        var successBlockId = successBlock[0];
        parser.registerBlock(successBlock);

        var ifOp = Ops.IfOp.create(condition, successBlockId, null);
        parser.setCurrentBlock(prevFailBlockId);
        parser.addOp(ifOp);
        parser.addOp(Ops.ExitOp.create(parser.getBlockId()));

        parser.setCurrentBlock(successBlockId);
    },

    _else: function () {
        var exitOp = Ops.ExitOp.create(parser.getBlockId());
        parser.addOp(exitOp);
        parser.exitCurrentBlock();

        var prevIfOp = parser.getFirstBlockOp();
        var prevFailBlock = Blocks.Block.create([]);
        var prevFailBlockId = prevFailBlock[0];
        parser.registerBlock(prevFailBlock);
        prevIfOp[3] = prevFailBlockId;

        var successBlock = Blocks.Block.create([]);
        var successBlockId = successBlock[0];
        parser.registerBlock(successBlock);

        var ifOp = Ops.IfOp.create("true", successBlockId, null);
        parser.setCurrentBlock(prevFailBlockId);
        parser.addOp(ifOp);
        parser.addOp(Ops.ExitOp.create(parser.getBlockId()));

        parser.setCurrentBlock(successBlockId);
    },

    _endif: function () {
        var exitOp = Ops.ExitOp.create(parser.getBlockId());
        parser.addOp(exitOp);
        while(parser.getLastBlockOp()[0] === 2) {
            parser.exitCurrentBlock();
        }
    },

    loop: function (count) {
        var loopBlock = Blocks.Block.create([]);
        var loopBlockId = loopBlock[0];
        parser.registerBlock(loopBlock);

        var loopOp = Ops.LoopOp.create(count, loopBlockId);
        parser.addOp(loopOp);
        parser.setCurrentBlock(loopBlockId);
    },

    endloop: function () {
        var exitOp = Ops.ExitOp.create(parser.getBlockId());
        parser.addOp(exitOp);
        parser.exitCurrentBlock();
    },

    wait: function (count) {
        parser.commands.loop(count);
        parser.addOp(Ops.SimpleOp.create('wait', []));
        parser.commands.endloop();
    },

    send: function (scopeStr, label, args) {
        var scope = typeof scopeStr === 'string' ? new Scope(scopeStr) : scopeStr;
        parser.addOp(Ops.SimpleOp.create('send', [scope, label, args]));
    },

    jump: function (labelName, args) {
        var jumpOp = Ops.JumpOp.create(labelName, args);
        parser.addOp(jumpOp);
    },

    adopt:     parser._defaultParseFunc('adopt'),
    set:       parser._defaultParseFunc('set'),
    terminate: parser._defaultParseFunc('terminate'),
    print:     parser._defaultParseFunc('print'),
    lock:      parser._defaultParseFunc('lock'),
    unlock:    parser._defaultParseFunc('unlock'),
    zap:       parser._defaultParseFunc('zap'),
    restore:   parser._defaultParseFunc('restore'),
    spawn:     parser._defaultParseFunc('spawn'),
    die:       parser._defaultParseFunc('die'),
    become:    parser._defaultParseFunc('become'),
    exec:      parser._defaultParseFunc('exec')
}};

DefaultCommandSet.runCommands = function (entity) { return {
    end: function () {
        entity.ended = true;
        entity.executor.reset();
    },

    terminate: function () {
        entity.ended = true;
        entity.board.terminate();
    },

    print: function (text) {
        console.log(text);
        entity.cycleEnded = true;
    },

    send: function (scope, label, args) {
        var evaluatedArgs = [];
        if (args instanceof Array) {
            for (var i = 0; i < args.length; i++) {
                evaluatedArgs.push(args[i] instanceof Evaluables.Evaluable ? args[i].evaluate(entity) : args[i]);
            }
        }

        var objects = scope.evaluate(entity);
        for (var i = 0; i < objects.length; i++) {
            objects[i].gotoLabel(label, evaluatedArgs);
        }
    },

    adopt: function (moduleName, initParams) {
        var commandSet = entity.executor.commands[moduleName];
        entity.adoptions.push(commandSet);

        if (typeof initParams === 'object') {
            Object.keys(initParams).forEach(function (key) {
                var initVal = initParams[key];
                initParams[key] = initVal instanceof Evaluables.Evaluable ? initVal.evaluate(entity) : initVal;
            })
        }

        commandSet.__init__(initParams);
    },

    set: function (varName, value) {
        var resolvedName = varName.replace('@', '').replace('$', '');
        if (varName.indexOf('@') === 0) {
            entity.executor.currentLabelFrame.variables[resolvedName] = value;
        }
        else if (varName.indexOf('$') === 0) {
            entity.variables[resolvedName] = value;
        }
    },

    wait: function () {
        entity.cycleEnded = true;
    },

    lock: function () {
        entity.locked = true;
    },

    unlock: function () {
        entity.locked = false;
    },

    zap: function (labelName) {
        entity.executor.labelStore.disableCurrent(labelName);
    },

    restore: function (labelName) {
        entity.executor.labelStore.enablePrevious(labelName);
    },

    spawn: function (objName, initVarArgs) {
        var evaluatedArgs = [];
        if (initVarArgs instanceof Array) {
            for (var i = 0; i < initVarArgs.length; i++) {
                evaluatedArgs.push((initVarArgs[i] instanceof Evaluables.Evaluable) ? initVarArgs[i].evaluate(entity) : initVarArgs[i]);
            }
        }
        entity.board.spawnObject(objName, entity, evaluatedArgs);
    },

    die: function () {
        entity.locked = true;
        entity.ended = true;
        entity.cycleEnded = true;
        entity.destroyAdoptions();

        entity.board.removeObject(entity);
    },

    become: function (name, initVarArgs) {
        var evaluatedArgs = [];
        if (initVarArgs instanceof Array) {
            for (var i = 0; i < initVarArgs.length; i++) {
                evaluatedArgs.push((initVarArgs[i] instanceof Evaluables.Evaluable) ? initVarArgs[i].evaluate(entity) : initVarArgs[i]);
            }
        }

        entity.ended = true;
        entity.cycleEnded = true;
        entity.destroyAdoptions();

        entity.board.replaceObject(entity, name, evaluatedArgs);
    },

    exec: function (func) {
        func(entity);
    }
}};

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = DefaultCommandSet;
}