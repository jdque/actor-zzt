var Util = require('./util.js');
var Evaluables = require('./evaluables.js');
var Blocks = require('./blocks.js');
var Ops = require('./ops.js');
var Executor = require('./executor.js');

function Parser() {
    this.labelStore = null;
    this.blockStore = null;
    this.commands = {};
    this.modules = [];

    this.currentBlock = null;
    this.blockStack = [];
}

Parser.prototype.reset = function () {
    this.labelStore = null;
    this.blockStore = null;
    this.commands = {};

    this.currentBlock = null;
    this.blockStack = [];
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

Parser.prototype.registerBlock = function (block) {
    this.blockStore.add(block);
}

Parser.prototype.registerLabel = function (label) {
    this.labelStore.add(label);
}

Parser.prototype.getRegisteredBlock = function (blockId) {
    return this.blockStore.get(blockId);
}

Parser.prototype.addOp = function (op) {
    this.currentBlock[2].push(op);
}

Parser.prototype.getBlockId = function () {
    return this.currentBlock[0];
}

Parser.prototype.getBlockOffset = function () {
    return this.currentBlock[2].length;
}

Parser.prototype.getFirstBlockOp = function () {
    return this.currentBlock[2][0];
}

Parser.prototype.getLastBlockOp = function () {
    return this.currentBlock[2][this.currentBlock[2].length - 1];
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
}

Parser.prototype.exitCurrentBlock = function () {
    this.blockStack.pop();
    this.currentBlock = this.blockStack[this.blockStack.length - 1];
}

Parser.prototype._defaultParseFunc = function (commandName) {
    var self = this;

    return function () {
        self.addOp(Ops.SimpleOp.create(commandName, arguments));
    };
}

Parser.prototype.parse = function (entity) {
    this.reset();

    var parseCommands = {};
    var runCommands = {};
    this.modules.forEach(function (module) {
        var commandSet = module.commandSet;
        Util.extend(parseCommands, commandSet.parseCommands.call(null, this));
        Util.extend(runCommands, commandSet.runCommands.call(null, entity));
    }, this);

    entity.commands = runCommands;

    this.commands = parseCommands;
    this.labelStore = new Blocks.LabelStore();
    this.blockStore = new Blocks.BlockStore();

    var varParamsStr = '["' + entity.initVarParams.join('","') + '"]';
    var commandKeys = Object.keys(this.commands);
    var commandVals = commandKeys.map(function (key) { return this.commands[key]; }, this);

    (new Function(commandKeys.join(','),
        'label("_start", ' + varParamsStr + ');' +
        entity.script.toString().match(/{([\s\S]*)}/)[1] + ";" +
        'end();'
    )).apply(this, commandVals);

    return new Executor(runCommands, this.labelStore, this.blockStore, entity);
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Parser;
}