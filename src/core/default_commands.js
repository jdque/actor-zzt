var Evaluables = require('./evaluables.js');
var Blocks = require('./blocks.js');
var Scope = require('./scope.js');

var DefaultCommandSet = {};

DefaultCommandSet.parseCommands = function (parser, entity) { return {
    val: function (varStr) {
        return new Evaluables.Value(varStr, entity);
    },

    expr: function (expr) {
        return new Evaluables.Expression(expr, entity);
    },

    label: function (name, varParams) {
        if (parser.blockStack.length === 0) {
            var block = entity.createBlock(varParams);
            parser.parseNewBlock(block);
        }

        if (!entity.labels[name]) {
            entity.labels[name] = new Blocks.LabelBlockGroup();
        }
        entity.labels[name].addBlockRef(parser.currentBlock.id(), parser.currentBlock.commands.length);
    },

    end: function () {
        if (!parser.currentBlock)
            return;

        parser.currentBlock.add(entity.commands.end.fastBind(entity));
        parser.parsePreviousBlock();
    },

    _if: function (condition) {
        var condition = typeof condition === 'string' ? new Evaluables.Expression(condition, entity) : condition;
        var block = new Blocks.IfBlock();

        parser.currentBlock.add(entity.runBlock.fastBind(entity, block));
        parser.parseNewBlock(block);
        parser.currentBlock.addBranch(entity.commands.if.fastBind(entity, condition));
    },

    _elif: function (condition) {
        var condition = typeof condition === 'string' ? new Evaluables.Expression(condition, entity) : condition;

        parser.currentBlock.add(entity.runPreviousBlock.fastBind(entity));
        parser.currentBlock.addBranch(entity.commands.elif.fastBind(entity, condition));
    },

    _else: function () {
        parser.currentBlock.add(entity.runPreviousBlock.fastBind(entity));
        parser.currentBlock.addBranch(entity.commands.else.fastBind(entity));
    },

    _endif: function () {
        parser.currentBlock.add(entity.runPreviousBlock.fastBind(entity));
        parser.parsePreviousBlock();
    },

    loop: function (count) {
        count = typeof count === 'string' ? new Evaluables.Expression(count, entity) : count;
        var block = new Blocks.LoopBlock(count);

        parser.currentBlock.add(entity.runBlock.fastBind(entity, block));
        parser.parseNewBlock(block);
        parser.currentBlock.add(entity.commands.loop.fastBind(entity));
    },

    endloop: function () {
        parser.currentBlock.add(entity.commands.endloop.fastBind(entity));
        parser.parsePreviousBlock();
    },

    wait: function (count) {
        parser.commands.loop(count);
        parser.currentBlock.add(entity.commands.wait.fastBind(entity));
        parser.commands.endloop();
    },

    send: function (scopeStr, label, varArgs) {
        var scope = typeof scopeStr === 'string' ? new Scope(scopeStr) : scopeStr;
        parser.currentBlock.add(entity.commands.send.fastBind(entity, scope, label, varArgs));
    },

    adopt: function (moduleName, initParams) {
        parser.currentBlock.add(entity.commands.adopt.fastBind(entity, entity.commands[moduleName], initParams));
    },

    set: function (varName, value) {
        parser.currentBlock.add(entity.commands.set.fastBind(entity, varName, value));
    },

    terminate: parser._defaultParseFunc(entity.commands.terminate),
    print:     parser._defaultParseFunc(entity.commands.print),
    jump:      parser._defaultParseFunc(entity.commands.jump),
    lock:      parser._defaultParseFunc(entity.commands.lock),
    unlock:    parser._defaultParseFunc(entity.commands.unlock),
    zap:       parser._defaultParseFunc(entity.commands.zap),
    restore:   parser._defaultParseFunc(entity.commands.restore),
    spawn:     parser._defaultParseFunc(entity.commands.spawn),
    die:       parser._defaultParseFunc(entity.commands.die),
    become:    parser._defaultParseFunc(entity.commands.become),
    exec:      parser._defaultParseFunc(entity.commands.exec)
}};

DefaultCommandSet.runCommands = function (entity) { return {
    end: function () {
        entity.ended = true;
        entity.executingLabelBlock = null;
        entity.executingBlock = null;
        entity.executingBlockStack = [];
    },

    terminate: function () {
        entity.ended = true;
        entity.board.terminate();
    },

    if: function (condition) {
        if (!condition.evaluate()) {
            if (!entity.executingBlock.nextCondition()) {
                entity.runPreviousBlock();
            }
        }
    },

    elif: function (condition) {
        if (!condition.evaluate()) {
            if (!entity.executingBlock.nextCondition()) {
                entity.runPreviousBlock();
            }
        }
    },

    else: function () {
    },

    endif: function () {
        entity.runPreviousBlock();
    },

    loop: function () {
        if (!entity.executingBlock.iterate()) {
            entity.runPreviousBlock();
        }
    },

    endloop: function () {
        entity.executingBlock.restart();
    },

    print: function (text) {
        var printText = (text instanceof Evaluables.Evaluable) ? text.evaluate() : text;
        console.log(printText);
        entity.cycleEnded = true;
    },

    jump: function (label, varArgs) {
        entity.gotoLabel(label, varArgs);
    },

    send: function (scope, label, varArgs) {
        var objects = scope.evaluate(entity);
        for (var i = 0; i < objects.length; i++) {
            objects[i].gotoLabel(label, varArgs);
        }
    },

    adopt: function (commandSet, initParams) {
        entity.adoptions.push(commandSet);
        commandSet.__init__(initParams);
    },

    set: function (varName, value) {
        var resolvedName = varName.replace('@', '').replace('$', '');
        var resolvedValue = (value instanceof Evaluables.Evaluable) ? value.evaluate() : value;
        if (varName.indexOf('@') === 0) {
            entity.executingBlock.variables[resolvedName] = resolvedValue;
        }
        else if (varName.indexOf('$') === 0) {
            entity.variables[resolvedName] = resolvedValue;
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

    zap: function (label) {
        if (entity.labels[label]) {
            entity.labels[label].disableActiveBlockRef();
        }
    },

    restore: function (label) {
        if (entity.labels[label]) {
            entity.labels[label].enablePreviousBlockRef();
        }
    },

    spawn: function (objName, initVarArgs) {
        var evaluatedArgs = [];
        if (initVarArgs instanceof Array) {
            for (var i = 0; i < initVarArgs.length; i++) {
                evaluatedArgs.push((initVarArgs[i] instanceof Evaluables.Evaluable) ? initVarArgs[i].evaluate() : initVarArgs[i]);
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
                evaluatedArgs.push((initVarArgs[i] instanceof Evaluables.Evaluable) ? initVarArgs[i].evaluate() : initVarArgs[i]);
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