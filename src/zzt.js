Util = {};

Util.extend = function (destination, source) {
    for (var k in source) {
        if (source.hasOwnProperty(k)) {
            destination[k] = source[k];
        }
    }
    return destination;
}

Expression = function (expr, context) {
    this.expr = new Function(
        'return ' + expr.replace(/[$]/g, 'this.board.variables.')
    ).bind(context);
}

Expression.prototype.evaluate = function () {
    return this.expr();
}

Block = function () {
    this.commands = [];
    this.index = -1;
}

Block.prototype.add = function (command) {
    this.commands.push(command);
}

Block.prototype.reset = function () {
    this.index = -1;
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

IfBlock = function () {
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

LoopBlock = function (count) {
    Block.apply(this);
    
    this.count = count || 0;
    this.execCount = 0;
    this.currentCount = 0;
}

LoopBlock.prototype = Object.create(Block.prototype);

LoopBlock.prototype.reset = function () {
    Block.prototype.reset.apply(this);
    this.currentCount = 0;
    this.execCount = this.count instanceof Expression ? this.count.evaluate() : this.count;
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

LabelBlockGroup = function () {
    this.blocks = [];
    this.activeBlockIdx = 0;
}

LabelBlockGroup.prototype.addBlock = function (block, offset) {
    this.blocks.push({
        block: block,
        offset: offset || 0
    });
}

LabelBlockGroup.prototype.getActiveBlock = function () {
    return this.blocks[this.activeBlockIdx].block;
}

LabelBlockGroup.prototype.getActiveBlockOffset = function () {
    return this.blocks[this.activeBlockIdx].offset;
}

LabelBlockGroup.prototype.disableActiveBlock = function () {
    if (this.activeBlockIdx < this.blocks.length - 1)
        this.activeBlockIdx++;
}

LabelBlockGroup.prototype.enablePreviousBlock = function () {
    if (this.activeBlockIdx > 0)
        this.activeBlockIdx--;
}

Parser = function (entity) {
    this.entity = entity;
    this.commands = {};
    this.currentBlock = null;
    this.blockStack = [];
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
    return function () {
        this.currentBlock.add(Function.bind.apply(runCommand, [this.entity].concat(Array.prototype.slice.call(arguments))));
    }.bind(this);
}

Parser.prototype.parse = function () {
    (new Function(
        'var expr      = this.commands.expr;' +
        'var label     = this.commands.label;' +
        'var end       = this.commands.end;' +
        'var terminate = this.commands.terminate;' +
        'var _if       = this.commands.if;' +
        'var _elif     = this.commands.elif;' +
        'var _else     = this.commands.else;' +
        'var _endif    = this.commands.endif;' +
        'var loop      = this.commands.loop;' +
        'var endloop   = this.commands.endloop;' +
        'var print     = this.commands.print;' +
        'var jump      = this.commands.jump;' +
        'var send      = this.commands.send;' +
        'var set       = this.commands.set;' +
        'var wait      = this.commands.wait;' +
        'var lock      = this.commands.lock;' +
        'var unlock    = this.commands.unlock;' +
        'var zap       = this.commands.zap;' +
        'var restore   = this.commands.restore;' +
        'var spawn     = this.commands.spawn;' +
        'var die       = this.commands.die;' +
        'var element   = this.commands.element;' +
        'label("_start");' +
        this.entity.script.toString().replace("function ()", "") + ";" +
        'end();'
    ).bind(this))();
}

DefaultCommandSet = {};

DefaultCommandSet.parseCommands = function (parser, entity) { return {
    expr: function (expr) {
        return new Expression(expr, entity);
    },

    label: function (name) {
        var block = new Block();

        if (parser.blockStack.length === 0) {
            parser.parseNewBlock(block);
        }

        if (!entity.labels[name]) {
            entity.labels[name] = new LabelBlockGroup();
        }
        entity.labels[name].addBlock(parser.currentBlock, parser.currentBlock.commands.length);
    },

    end: function () {
        if (!parser.currentBlock)
            return;

        parser.currentBlock.add(entity.commands.end.bind(entity));
        parser.parsePreviousBlock();
    },

    if: function (condition) {
        var block = new IfBlock();

        parser.currentBlock.add(entity.runBlock.bind(entity, block));
        parser.parseNewBlock(block);
        parser.currentBlock.addBranch(entity.commands.if.bind(entity, new Expression(condition, entity)));
    },

    elif: function (condition) {
        parser.currentBlock.add(entity.runPreviousBlock.bind(entity));
        parser.currentBlock.addBranch(entity.commands.elif.bind(entity, new Expression(condition, entity)));
    },

    else: function () {
        parser.currentBlock.add(entity.runPreviousBlock.bind(entity));
        parser.currentBlock.addBranch(entity.commands.else.bind(entity));
    },

    endif: function () {
        parser.currentBlock.add(entity.runPreviousBlock.bind(entity));
        parser.parsePreviousBlock();
    },

    loop: function (count) {
        count = typeof count === 'string' ? new Expression(count, entity) : count;
        var block = new LoopBlock(count);

        parser.currentBlock.add(entity.runBlock.bind(entity, block));
        parser.parseNewBlock(block);
        parser.currentBlock.add(entity.commands.loop.bind(entity));
    },

    endloop: function () {
        parser.currentBlock.add(entity.commands.endloop.bind(entity));
        parser.parsePreviousBlock();
    },

    wait: function (count) {
        parser.commands.loop(count);
        parser.currentBlock.add(entity.commands.wait.bind(entity));
        parser.commands.endloop();
    },

    terminate: parser._defaultParseFunc(entity.commands.terminate),
    print:     parser._defaultParseFunc(entity.commands.print),
    jump:      parser._defaultParseFunc(entity.commands.jump),
    send:      parser._defaultParseFunc(entity.commands.send),
    set:       parser._defaultParseFunc(entity.commands.set),
    lock:      parser._defaultParseFunc(entity.commands.lock),
    unlock:    parser._defaultParseFunc(entity.commands.unlock),
    zap:       parser._defaultParseFunc(entity.commands.zap),
    restore:   parser._defaultParseFunc(entity.commands.restore),
    spawn:     parser._defaultParseFunc(entity.commands.spawn),
    die:       parser._defaultParseFunc(entity.commands.die)
}};

DefaultCommandSet.runCommands = function (entity) { return {
    end: function () {
        entity.ended = true;
        entity.executingBlock = null;
        entity.executingBlockStack = [];
    },

    terminate: function () {
        entity.ended = true;
        entity.board.ended = true;
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
        var printText = (text instanceof Expression) ? text.evaluate() : text;
        console.log(printText);
        entity.cycleEnded = true;
    },

    jump: function (label) {
        entity.gotoLabel(label);
    },

    send: function (objName, label) {
        entity.board.send(objName, label);
    },

    set: function (varName, value) {
        entity.board.variables[varName.replace('$', '')] = (value instanceof Expression) ? value.evaluate() : value;
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
            entity.labels[label].disableActiveBlock();
        }
    },

    restore: function (label) {
        if (entity.labels[label]) {
            entity.labels[label].enablePreviousBlock();
        }
    },

    spawn: function (objName) {
        console.log(entity.name + " spawned " + objName)
        entity.board.spawn(objName, entity);
    },

    die: function () {
        entity.locked = true;
        entity.ended = true;
        entity.cycleEnded = true;
        entity.board.deletedObjs.push(entity);
    }
}};

DOMCommandSet = {};

DOMCommandSet.parseCommands = function (parser, entity) {
    var element = {
        set: parser._defaultParseFunc(entity.commands.element.set),
        exec: parser._defaultParseFunc(entity.commands.element.exec),
    };

    return {
        element: element
    };
};

DOMCommandSet.runCommands = function (entity) {
    var element = {
        set: function (id) {
            entity.element = document.getElementById(id) || null;
            if (entity.element)
                entity.element.onclick = function () { entity.gotoLabel('@click') }.bind(entity);
        },

        exec: function (func) {
            if (entity.element)
                func(entity.element);
        }
    };

    return {
        element: element
    };
};

Entity = function (board, name, script) {
    //Properties
    this.board = board;
    this.name = name;
    this.script = script;

    //State
    this.ended = false;
    this.cycleEnded = false;
    this.locked = false;

    //Execution
    this.labels = {};
    this.commands = {};
    this.executingBlock = null;
    this.executingBlockStack = [];

    //Parsing
    this.parser = new Parser(this);

    Util.extend(this.commands, DefaultCommandSet.runCommands.call(null, this));
    Util.extend(this.parser.commands, DefaultCommandSet.parseCommands.call(null, this.parser, this));
    Util.extend(this.commands, DOMCommandSet.runCommands.call(null, this));
    Util.extend(this.parser.commands, DOMCommandSet.parseCommands.call(null, this.parser, this));
}

Entity.prototype.begin = function () {
    this.cycleEnded = false;
    this.gotoLabel('_start');
}

Entity.prototype.gotoLabel = function (name) {
    if (this.locked)
        return;

    if (this.labels[name]) {
        this.ended = false;
        this.cycleEnded = false;
        this.executingBlock = this.labels[name].getActiveBlock();
        this.executingBlock.reset();
        this.executingBlock.gotoOffset(this.labels[name].getActiveBlockOffset());
        this.executingBlockStack = [this.executingBlock];
    }
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

    while (this.executingBlock.execNext()) {
        if (this.cycleEnded || this.ended)
            break;
    }
}

Board = function () {
    this.objects = {};
    this.instances = [{}];
    this.variables = {};

    this.source = this;

    //Execution
    this.ended = false;
    this.spawnedObjs = [];
    this.deletedObjs = [];

    this.terminateCallback = function () {};
}

Board.prototype.setup = function (script) {
    (new Function(
        'var object = this.object.bind(this);' +
        script.toString().replace('function ()', '')
    ).bind(this))();

    return this;
}

Board.prototype.object = function (name, script) {
    if (this.objects[name]) {
        throw "Duplicate object definition";
    }
    var obj = new Entity(this, name, script);
    this.objects[name] = obj;

    return obj;
}

Board.prototype.spawn = function (name, parent) {
    if (!this.source.objects[name])
        return;

    if (parent) {
        if (this.instances.length <= parent.depth + 1)
            this.instances.push({});
    }

    var obj = new Entity(this, this.source.objects[name].name, this.source.objects[name].script);
    obj.depth = parent ? parent.depth + 1 : 0;
    obj.parser.parse();
    obj.begin();

    this.spawnedObjs.push(obj);

    return obj;
}

Board.prototype.run = function (script) {
    (new Function(
        'var spawn = this.spawn.bind(this); ' +
        script.toString().replace('function ()', '')
    ).bind(this))();

    var loop = function () {
        //Add spawned objects
        for (var i = 0; i < this.spawnedObjs.length; i++) {
            if (!this.instances[this.spawnedObjs[i].depth][this.spawnedObjs[i].name])
                this.instances[this.spawnedObjs[i].depth][this.spawnedObjs[i].name] = [];

            this.instances[this.spawnedObjs[i].depth][this.spawnedObjs[i].name].push(this.spawnedObjs[i]);
        }
        this.spawnedObjs = [];

        //Purge dead objects
        for (var i = 0; i < this.deletedObjs.length; i++) {
            this.instances[this.deletedObjs[i].depth][this.deletedObjs[i].name].splice(this.deletedObjs[i], 1);
        }
        this.deletedObjs = [];

        //Execute object tree
        for (var i = this.instances.length - 1; i >= 0; i--) {
            for (var objName in this.instances[i]) {
                for (var j = 0; j < this.instances[i][objName].length; j++) {
                    this.instances[i][objName][j].execute.call(this.instances[i][objName][j]);
                }
            }   
        }

        if (this.ended === false) {
            window.setTimeout(loop, 100);
        }
        else {
            this.terminateCallback();
        }
    }.bind(this);

    window.setTimeout(loop, 100);

    return this;
}

Board.prototype.terminated = function (func) {
    this.terminateCallback = func;
}

Board.prototype.send = function (objName, label) {
    for (var i = this.instances.length - 1; i >= 0; i--) {
        if (this.instances[i][objName]) {
            for (var j = 0; j < this.instances[i][objName].length; j++) {
                this.instances[i][objName][j].gotoLabel.call(this.instances[i][objName][j], label);
            }
        }
    }

    for (var i = 0; i < this.spawnedObjs.length; i++) {
        if (this.spawnedObjs[i].name === objName)
            this.spawnedObjs[i].gotoLabel.call(this.spawnedObjs[i], label);
    }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        Board: Board
    };
}