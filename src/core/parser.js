var Util = require('./util.js');
var Evaluables = require('./evaluables.js');
var Blocks = require('./blocks.js');
var Ops = require('./ops.js');
var Executor = require('./executor.js');

function Parser() {
    this.commands = {};
    this.modules = [];

    this.labelStore = new Blocks.LabelStore();
    this.blockStore = new Blocks.BlockStore();

    this.currentBlock = null;
    this.blockStack = [];
    this.cursor = {
        blockId: null,
        offset: null,
        prevOp: null,
        lastOp: null
    };
}

Parser.prototype.reset = function () {
    this.labelStore = new Blocks.LabelStore();
    this.blockStore = new Blocks.BlockStore();

    this.currentBlock = null;
    this.blockStack = [];

    this.resetCursor();
}

Parser.prototype.registerModule = function (module, customName) {
    var name = typeof customName === 'string' ? customName : module.defaultName;

    for (var i = 0; i < this.modules.length; i++) {
        if (this.modules[i].name === name) {
            return;
        }
    }

    var parseCommands = module.parseCommands;
    var runCommands = module.runCommands;
    if (name.length > 0) {
        parseCommands = function (parser) {
            var obj = {};
            obj[name] = module.parseCommands.call(null, parser);
            return obj;
        };
        runCommands = function (entity) {
            var obj = {};
            obj[name] = module.runCommands.call(null, entity);
            return obj;
        };
    }

    this.modules.push({
        name: name,
        parseCommands: parseCommands,
        runCommands: runCommands
    });

    Util.extend(this.commands, parseCommands.call(null, this));
}

Parser.prototype.registerBlock = function (block) {
    this.blockStore.add(block);
}

Parser.prototype.registerLabel = function (label) {
    this.labelStore.add(label);
}

Parser.prototype.resetCursor = function () {
    this.cursor.blockId = null;
    this.cursor.offset = null;
    this.cursor.prevOp = null;
    this.cursor.lastOp = null;
}

Parser.prototype.updateCursor = function (block) {
    if (!block) {
        this.resetCursor();
        return;
    }

    this.cursor.blockId = block[0];
    this.cursor.offset = block[2].length;
    this.cursor.prevOp = block[2][block[2].length - 2] || null;
    this.cursor.lastOp = block[2][block[2].length - 1] || null;
}

Parser.prototype.hasActiveBlock = function () {
    return this.currentBlock != null;
}

Parser.prototype.setCurrentBlock = function (blockId) {
    var block = this.blockStore.get(blockId);
    if (!block) {
        throw new Error("Unregistered block");
    }

    if (this.currentBlock && block[0] === this.currentBlock[0]) {
        return;
    }

    this.currentBlock = block;
    this.blockStack.push(this.currentBlock);
    this.updateCursor(this.currentBlock);
}

Parser.prototype.exitCurrentBlock = function () {
    this.blockStack.pop();
    this.currentBlock = this.blockStack[this.blockStack.length - 1];
    this.updateCursor(this.currentBlock);
}

Parser.prototype.enter = function (block) {
    this.registerBlock(block);
    this.setCurrentBlock(block[0]);
    return this;
}

Parser.prototype.exit = function () {
    this.exitCurrentBlock();
    return this;
}

Parser.prototype.addOp = function (op) {
    this.currentBlock[2].push(op);
    this.updateCursor(this.currentBlock);
    return this;
}

Parser.prototype._defaultParseFunc = function (commandName) {
    var self = this;

    return function () {
        self.addOp(Ops.SimpleOp.create(commandName, arguments));
    };
}

Parser.prototype.parse = function (entity) {
    this.reset();

    var runCommands = {};
    this.modules.forEach(function (module) {
        Util.extend(runCommands, module.runCommands.call(null, entity));
    }, this);

    var varParamsStr = '["' + entity.initVarParams.join('","') + '"]';
    var commandKeys = Object.keys(this.commands);
    var commandVals = commandKeys.map(function (key) { return this.commands[key]; }, this);

    (new Function(commandKeys.join(','),
        'label("init", ' + varParamsStr + ');' +
        entity.script.toString().match(/{([\s\S]*)}/)[1] + ";" +
        'end();'
    )).apply(this, commandVals);

    return new Executor(runCommands, this.labelStore, this.blockStore, entity);
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Parser;
}