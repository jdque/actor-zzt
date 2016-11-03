var Util = require('./util.js');
var Evaluables = require('./evaluables.js');

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
        self.currentBlock.add(Function.fastBind.apply(
            function () {
                for (var i = 0; i < arguments.length; i++) {
                    if (arguments[i] instanceof Evaluables.Evaluable) {
                        arguments[i] = arguments[i].evaluate();
                    }
                }
                runCommand.apply(this, arguments);
            },
            [self.entity].concat(Array.prototype.slice.call(arguments))
        ));
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

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Parser;
}