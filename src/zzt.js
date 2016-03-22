var Util = require('./util.js');

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

function Scope(scope) {
    var self   = "[obj].forEach(function (obj) {\n";
    var all    = "children(obj).forEach(function (obj) {\n";
    var name   = "children(obj).filter(function (obj) { return obj.name === '{name}'}).forEach(function (obj) {\n";
    var parent = "[parent(obj)].forEach(function (obj) {\n";
    var board  = "[board(obj)].forEach(function (obj) {\n";
    var out    = "outObjs.push(obj);\n";

    var funcParts = [];
    funcParts.push('var outObjs = [];\n');

    var scopeParts = scope.split('.');
    scopeParts.forEach(function (part, idx) {
        switch (part) {
            case '':
            case '[self]':
                funcParts.push(self);
                break;
            case '*':
            case "[all]":
                if (idx === 0) {
                    funcParts.push(parent);
                }
                funcParts.push(all);
                break;
            case '<':
            case '[parent]':
                funcParts.push(parent);
                break;
            case '$':
            case '[board]':
                funcParts.push(board);
                break;
            default:
                if (idx === 0) {
                    funcParts.push(parent);
                }
                funcParts.push(name.replace('{name}', part));
                break;
        }
    });
    funcParts.push(out);
    var funcStr = funcParts.join("");
    for (var i = 0; i < funcParts.length - 2; i++) {
        funcStr += "});\n";
    }
    funcStr += 'return outObjs;';

    this.scopeFunc = new Function('obj, children, parent, board', funcStr);
}

Scope.prototype.children = function (entity) {
    return entity.board.getChildObjects(entity);
}

Scope.prototype.parent = function (entity) {
    return entity.parent;
}

Scope.prototype.board = function (entity) {
    return entity.board;
}

Scope.prototype.evaluate = function (entity) {
    return this.scopeFunc(entity, this.children, this.parent, this.board) || [];
}

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
        this.variables[varName] = (value instanceof Evaluable) ? value.evaluate() : value;
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
    this.execCount = this.count instanceof Evaluable ? this.count.evaluate() : this.count;
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

function Parser(entity) {
    this.currentBlock = null;
    this.blockStack = [];

    this.modules = [];
}

Parser.prototype.registerModule = function (name, commandSet) {
    for (var i = 0; i < this.modules.length; i++) {
        if (this.modules[i].name === name) {
            return;
        }
    }

    this.modules.push({
        name: name,
        commandSet: commandSet
    });
}

Parser.prototype.parseNewBlock = function (block) {
    this.currentBlock = block;
    this.blockStack.push(this.currentBlock);
}

Parser.prototype.parsePreviousBlock = function () {
    this.blockStack.pop();
    this.currentBlock = this.blockStack[this.blockStack.length - 1];
}

Parser.prototype._defaultParseFunc = function (runCommand) {
    var self = this;
    return function () {
        self.currentBlock.add(Function.fastBind.apply(runCommand, [self.entity].concat(Array.prototype.slice.call(arguments))));
    };
}

Parser.prototype.parse = function (entity) {
    this.entity = entity;
    this.entity.commands = {};
    this.commands = {};

    this.modules.forEach(function (module) {
        var commandSet = module.commandSet;
        Util.extend(this.entity.commands, commandSet.runCommands.call(null, this.entity));
        Util.extend(this.commands, commandSet.parseCommands.call(null, this, this.entity));
    }, this);

    var commandStr = "";
    for (var name in this.commands) {
        commandStr += 'var ' + name + ' = this.commands.' + name + ';';
    }

    var varParams = '["' + this.entity.initVarParams.join('","') + '"]';

    (new Function(
        commandStr +
        'label("_start", ' + varParams + ');' +
        this.entity.script.toString().replace("function ()", "") + ";" +
        'end();'
    )).call(this);

    this.entity = null;
    this.commands = {};
}

function Entity(board, name, script, initVarParams) {
    //Properties
    this.id = Util.generateId().toString();
    this.board = board;
    this.name = name;
    this.script = script;
    this.initVarParams = initVarParams || [];
    this.depth = 0;
    this.parent = null;

    //State
    this.variables = {};
    this.adoptions = [];
    this.ended = false;
    this.cycleEnded = false;
    this.locked = false;

    //Execution
    this.labels = {};
    this.blocks = [];
    this.commands = {};
    this.executingLabelBlock = null;
    this.executingBlock = null;
    this.executingBlockStack = [];
}

Entity.clone = function (entity) {
    return new Entity(entity.board, entity.name, entity.script, entity.initVarParams);
}

Entity.prototype.begin = function (initVarArgs) {
    this.cycleEnded = false;
    this.gotoLabel('_start', initVarArgs);
}

Entity.prototype.gotoLabel = function (name, varArgs) {
    if (this.locked || !this.labels[name])
        return;

    if (!this.labels[name].getActiveBlockRef())
        return;

    var blockRef = this.labels[name].getActiveBlockRef();
    this.executingLabelBlock = this.getBlock(blockRef.blockId);
    this.executingLabelBlock.reset();
    this.executingLabelBlock.gotoOffset(blockRef.offset);
    this.executingLabelBlock.injectArguments(varArgs);

    this.executingBlock = this.executingLabelBlock;
    this.executingBlockStack = [this.executingBlock];

    this.ended = false;
    this.cycleEnded = false;
}

Entity.prototype.createBlock = function (varParams) {
    var block = new Block(varParams);
    this.blocks[block.id()] = block;

    return block;
}

Entity.prototype.getBlock = function (id) {
    return this.blocks[id];
}

Entity.prototype.runBlock = function (block) {
    this.ended = false;

    //new block
    this.executingBlockStack.push(block);
    this.executingBlock = this.executingBlockStack[this.executingBlockStack.length - 1];
    this.executingBlock.reset();
}

Entity.prototype.runPreviousBlock = function () {
    this.executingBlockStack.pop();
    this.executingBlock = this.executingBlockStack[this.executingBlockStack.length - 1];
}

Entity.prototype.execute = function () {
    this.cycleEnded = false;

    if (this.ended)
        return;

    //this.executingBlock.execNext();

    while (this.executingBlock.execNext()) {
        if (this.cycleEnded || this.ended)
            break;
    }
}

Entity.prototype.destroyAdoptions = function () {
    this.adoptions.forEach(function (commandSet) {
       commandSet.__destroy__();
    });
    this.adoptions = [];
}

function Board() {
    Entity.apply(this, [this, "_board", null, []]);

    //Setup
    this.setupFunc = function () {};
    this.finishFunc = function () {};
    this.runScript = function () {};
    this.objects = {};
    this.autoStep = false;
    this.parser = null;

    //Execution
    this.instances = [{}];
    this.spawnedObjs = [];
    this.deletedObjs = [];

    this.terminated = false;
}

Board.prototype = Object.create(Entity.prototype);

Board.prototype.setup = function (func) {
    this.setupFunc = func;
    return this;
}

Board.prototype.run = function (script) {
    this.runScript = script;
    return this;
}

Board.prototype.finish = function (func) {
    this.finishFunc = func;
    return this;
}

Board.prototype.configure = function (config) {
    this.autoStep = config.autoStep || false;
    this.parser = config.parser || new Parser();
    return this;
}

Board.prototype.start = function () {
    //Run setup
    (new Function(
        'var object = this.defineObject.bind(this);' +
        this.setupFunc.toString().replace("function ()", "")
    )).call(this);

    //Run root entity script
    this.script = this.runScript;
    this.depth = 0;
    this.parent = this;
    this.parser.parse(this);
    this.begin();
    this.instances[0]["_board"] = [];
    this.instances[0]["_board"].push(this);

    //Begin execution loop
    if (this.autoStep) {
        while (!this.terminated) {
            this.step();
        }
    }
}

Board.prototype.step = function () {
    if (this.terminated) {
        return;
    }

    //Add spawned objects
    for (var i = 0; i < this.spawnedObjs.length; i++) {
        if (!this.instances[this.spawnedObjs[i].depth][this.spawnedObjs[i].name])
            this.instances[this.spawnedObjs[i].depth][this.spawnedObjs[i].name] = [];

        this.instances[this.spawnedObjs[i].depth][this.spawnedObjs[i].name].push(this.spawnedObjs[i]);
    }
    this.spawnedObjs = [];

    //Purge dead objects
    for (var i = 0; i < this.deletedObjs.length; i++) {
        this.instances[this.deletedObjs[i].depth][this.deletedObjs[i].name].splice(
            this.instances[this.deletedObjs[i].depth][this.deletedObjs[i].name].indexOf(this.deletedObjs[i]), 1);
    }
    this.deletedObjs = [];

    //Execute object tree
    for (var i = this.instances.length - 1; i >= 0; i--) {
        for (var objName in this.instances[i]) {
            for (var j = 0; j < this.instances[i][objName].length; j++) {
                this.instances[i][objName][j].execute();
            }
        }
    }

    if (this.terminated) {
        this.finishFunc();
    }
}

Board.prototype.defineObject = function (name, varParamsOrScript, script) {
    if (this.objects[name]) {
        throw "Duplicate object definition";
    }

    var obj;
    if (arguments.length === 3) {
        obj = new Entity(this, name, script, varParamsOrScript);
    }
    else if (arguments.length === 2) {
        obj = new Entity(this, name, varParamsOrScript, []);
    }
    else {
        throw "Bad object definition";
    }

    this.objects[name] = obj;

    return obj;
}

Board.prototype.spawnObject = function (name, parent, initVarArgs) {
    if (!this.objects[name])
        return;

    if (parent) {
        if (this.instances.length <= parent.depth + 1)
            this.instances.push({});
    }

    var obj = Entity.clone(this.objects[name]);
    obj.depth = parent ? parent.depth + 1 : 0;
    obj.parent = parent || obj;
    this.parser.parse(obj);
    obj.begin(initVarArgs);

    this.spawnedObjs.push(obj);

    return obj;
}

Board.prototype.removeObject = function (entity) {
    this.deletedObjs.push(entity);
}

Board.prototype.replaceObject = function (target, newName, initVarArgs) {
    var newObject = this.spawnObject(this.objects[newName].name, target.parent, initVarArgs);

    var children = this.getChildObjects(target);
    for (var i = 0; i < children.length; i++) {
        children[i].parent = newObject;
    }

    this.removeObject(target);
}

Board.prototype.getChildObjects = function (entity) {
    if (entity.depth + 1 >= this.instances.length)
        return [];

    var children = [];

    for (name in this.instances[entity.depth + 1]) {
        children = children.concat(this.instances[entity.depth + 1][name].filter(function (child) {
            return child.parent === entity;
        }));
    }

    for (var i = 0; i < this.spawnedObjs.length; i++) {
        if (this.spawnedObjs[i].parent === entity) {
            children.push(this.spawnedObjs[i]);
        }
    }

    return children;
}

Board.prototype.terminate = function () {
    this.terminated = true;
}

function World() {
    this.boards = {};
    this.activeBoard = null;
}

World.prototype.addBoard = function (name, board) {
    this.boards[name] = board;
}

World.prototype.startBoard = function (name) {
    this.activeBoard = this.boards[name];
    this.activeBoard.start();
}

World.prototype.step = function () {
    if (!this.activeBoard)
        return;

    this.activeBoard.step();
}

var DefaultCommandSet = {};

DefaultCommandSet.parseCommands = function (parser, entity) { return {
    val: function (varStr) {
        return new Value(varStr, entity);
    },

    expr: function (expr) {
        return new Expression(expr, entity);
    },

    label: function (name, varParams) {
        if (parser.blockStack.length === 0) {
            var block = entity.createBlock(varParams);
            parser.parseNewBlock(block);
        }

        if (!entity.labels[name]) {
            entity.labels[name] = new LabelBlockGroup();
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
        var condition = typeof condition === 'string' ? new Expression(condition, entity) : condition;
        var block = new IfBlock();

        parser.currentBlock.add(entity.runBlock.fastBind(entity, block));
        parser.parseNewBlock(block);
        parser.currentBlock.addBranch(entity.commands.if.fastBind(entity, condition));
    },

    _elif: function (condition) {
        var condition = typeof condition === 'string' ? new Expression(condition, entity) : condition;

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
        count = typeof count === 'string' ? new Expression(count, entity) : count;
        var block = new LoopBlock(count);

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
        var printText = (text instanceof Evaluable) ? text.evaluate() : text;
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
        var resolvedValue = (value instanceof Evaluable) ? value.evaluate() : value;
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
                evaluatedArgs.push((initVarArgs[i] instanceof Evaluable) ? initVarArgs[i].evaluate() : initVarArgs[i]);
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
                evaluatedArgs.push((initVarArgs[i] instanceof Evaluable) ? initVarArgs[i].evaluate() : initVarArgs[i]);
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
    module.exports = {
        World: World,
        Board: Board,
        Parser: Parser,
        Evaluable: Evaluable,
        DeferredFunction: DeferredFunction,
        DefaultCommandSet: DefaultCommandSet
    };
}