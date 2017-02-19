var Evaluables = require('../core/evaluables.js');
var Blocks = require('../core/blocks.js');
var Ops = require('../core/ops.js');
var Scope = require('../core/scope.js');

function parseCommands(parser) { return {
    get: function (varSpec) {
        if (typeof varSpec === 'string') {
            return new Evaluables.Value(varSpec);
        } else if (varSpec instanceof Array) {
            return new Evaluables.ArrayValue(varSpec);
        }
    },

    $: function (varSpec) {
        return parser.commands.get(varSpec);
    },

    val: function (func) {
        return new Evaluables.DeferredFunction(func);
    },

    expr: function (expr) {
        return new Evaluables.Expression(expr);
    },

    label: function (name, params) {
        if (!parser.hasActiveBlock()) {
            var block = Blocks.Block.create([]);
            parser.enter(block);
        }

        var label = Blocks.Label.create(name, params, parser.cursor.blockId, parser.cursor.offset);
        if (name === 'init') {
            parser.labelStore.clear(name);
        }
        parser.labelStore.add(label);
    },

    end: function () {
        if (!parser.hasActiveBlock()) {
            return;
        }

        parser
            .addOp(Ops.SimpleOp.create('end', []))
            .exit();
    },

    _if: function (condition) {
        var ifBlock = Blocks.Block.create([]);
        var successBlock = Blocks.Block.create([]);

        parser
            .addOp(Ops.EnterOp.create(ifBlock[0]))
            .enter(ifBlock)
            .addOp(Ops.IfOp.create(condition, Ops.EnterOp.create(successBlock[0]), null))
            .addOp(Ops.ExitOp.create(parser.cursor.blockId))
            .enter(successBlock);
    },

    _elif: function (condition) {
        parser
            .addOp(Ops.ExitOp.create(parser.cursor.blockId))
            .exit();

        var prevFailBlock = Blocks.Block.create([]);
        var successBlock = Blocks.Block.create([]);

        var prevIfOp = parser.cursor.prevOp;
        prevIfOp[3] = Ops.EnterOp.create(prevFailBlock[0]);

        parser
            .enter(prevFailBlock)
            .addOp(Ops.IfOp.create(condition, Ops.EnterOp.create(successBlock[0]), null))
            .addOp(Ops.ExitOp.create(parser.cursor.blockId))
            .enter(successBlock);
    },

    _else: function () {
        parser.commands._elif(true);
    },

    _endif: function () {
        parser.addOp(Ops.ExitOp.create(parser.cursor.blockId));
        while (parser.cursor.lastOp[0] === Ops.Type.EXIT_OP) {
            parser.exit();
        }
    },

    loop: function (count) {
        var loopBlock = Blocks.Block.create([]);
        parser
            .addOp(Ops.LoopOp.create(count, Ops.EnterOp.create(loopBlock[0])))
            .enter(loopBlock);
    },

    endloop: function () {
        parser
            .addOp(Ops.ExitOp.create(parser.cursor.blockId))
            .exit();
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
    join:      parser._defaultParseFunc('join'),
    leave:     parser._defaultParseFunc('leave'),
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

function runCommands(entity) { return {
    end: function () {
        entity.ended = true;
        entity.executor.clearFrameStack();
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

    join: function (groupName) {
        entity.board.addObjectToGroup(groupName, entity);
    },

    leave: function (groupName) {
        entity.board.removeObjectFromGroup(groupName, entity);
    },

    set: function (varName, value) {
        var resolvedName = varName.replace('_', '');
        if (varName.indexOf('_') === 0) {
            entity.executor.currentLabelFrame.variables[resolvedName] = value;
        }
        else {
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

    spawn: function (objName, initArgs) {
        entity.board.spawnObject(objName, entity, initArgs);
    },

    die: function () {
        entity.board.removeObject(entity, true);
    },

    become: function (name, initArgs) {
        entity.ended = true;
        entity.cycleEnded = true;
        entity.destroyAdoptions();
        entity.board.replaceObject(entity, name, initArgs);
    },

    exec: function (func) {
        func(entity);
    }
}};

var DefaultCommandSet = {
    parseCommands: parseCommands,
    runCommands: runCommands,
    defaultName: ''
};

module.exports = {
    DefaultCommandSet: DefaultCommandSet
};