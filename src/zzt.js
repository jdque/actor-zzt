Expression = function (expr, context) {
    this.expr = expr.replace(/[$]/g, 'this.board.variables.');
    this.context = context || window;
}

Expression.prototype.evaluate = function () {
    return eval.call(this.context, this.expr);
}

Command = function (parseFunc, execFunc, scope) {
    this.parseFunc = parseFunc ? parseFunc.bind(scope) : Command._defaultParseFunc.call(scope, execFunc);
    this.execFunc = execFunc ? execFunc.bind(scope) : function () {};
}

Command._defaultParseFunc = function (func) {
    return function () {
        if (!this.parsed) {
            this.currentBlock.add(Function.bind.apply(func, [this].concat(Array.prototype.slice.call(arguments))));
        }
    }.bind(this);
}

Block = function () {
    this.commands = [];
    this.index = 0;
}

Block.prototype.add = function (command) {
    this.commands.push(command);
}

Block.prototype.reset = function () {
    this.index = 0;
}

Block.prototype.execNext = function () {
    if (this.index >= this.commands.length)
        return false;

    this.commands[this.index]();
    this.index++;
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
}

LoopBlock.prototype.iterate = function () {
    this.execCount = this.count instanceof Expression ? this.count.evaluate() : this.count;
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

LabelBlockGroup.prototype.addBlock = function () {
    var block = new Block();
    this.blocks.push(block);

    return block;
}

LabelBlockGroup.prototype.getActiveBlock = function () {
    return this.blocks[this.activeBlockIdx];
}

LabelBlockGroup.prototype.disableActiveBlock = function () {
    if (this.activeBlockIdx < this.blocks.length - 1)
        this.activeBlockIdx++;
}

LabelBlockGroup.prototype.enablePreviousBlock = function () {
    if (this.activeBlockIdx > 0)
        this.activeBlockIdx--;
}

Entity = function (board, name, script) {
    this.board = board;
    this.name = name;
    this.script = script;
    this.labels = {};

    //Parsing
    this.parsed = false;
    this.currentBlock = null;
    this.blockStack = [];
    
    //Execution
    this.ended = false;
    this.cycleEnded = false;
    this.locked = false;

    this.executingBlock = null;
    this.executingBlockStack = [];
}

Entity.prototype.parseNewBlock = function (block) {
    this.currentBlock = block;
    this.blockStack.push(this.currentBlock);
}

Entity.prototype.parsePreviousBlock = function () {
    this.blockStack.pop();
    this.currentBlock = this.blockStack[this.blockStack.length - 1];
}

Entity.prototype.parse = function () {
    var expr      = this.expr.bind(this);

    var label     = new Command(this.label_parse, null, this);
    var end       = new Command(this.end_parse, this.end, this);
    var terminate = new Command(null, this.terminate, this);
    var _if       = new Command(this._if_parse, this._if, this);
    var _elif     = new Command(this._elif_parse, this._elif, this);
    var _else     = new Command(this._else_parse, this._else, this);
    var _endif    = new Command(this._endif_parse, this._endif, this);
    var loop      = new Command(this.loop_parse, this.loop, this);
    var endloop   = new Command(this.endloop_parse, this.endloop, this);
    var print     = new Command(null, this.print, this);
    var jump      = new Command(null, this.jump, this);
    var send      = new Command(null, this.send, this);
    var set       = new Command(null, this.set, this);
    var wait      = new Command(this.wait_parse, this.wait, this);
    var lock      = new Command(null, this.lock, this);
    var unlock    = new Command(null, this.unlock, this);
    var zap       = new Command(null, this.zap, this);
    var restore   = new Command(null, this.restore, this);
    var spawn     = new Command(null, this.spawn, this);
    var die       = new Command(null, this.die, this);

    var element = {};
    element.set = (new Command(null, this.element_set, this)).parseFunc;
    element.exec = (new Command(null, this.element_exec, this)).parseFunc;

    //Default label if no label is specified
    this.label_parse('_start');
    
    this.script.call(this,
        expr,
        label.parseFunc,
        end.parseFunc,
        terminate.parseFunc,
        _if.parseFunc,
        _elif.parseFunc,
        _else.parseFunc,
        _endif.parseFunc,
        loop.parseFunc,
        endloop.parseFunc,
        print.parseFunc,
        jump.parseFunc,
        send.parseFunc,
        set.parseFunc,
        wait.parseFunc,
        lock.parseFunc,
        unlock.parseFunc,
        zap.parseFunc,
        restore.parseFunc,
        spawn.parseFunc,
        die.parseFunc,
        element);

    this.parsed = true;
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

Entity.prototype.expr = function (expr) {
    return new Expression(expr, this);
}

Entity.prototype.label_parse = function (name) {
    if (!this.labels[name])
        this.labels[name] = new LabelBlockGroup();

    var newBlock = this.labels[name].addBlock();
    this.parseNewBlock(newBlock);
}

Entity.prototype.end_parse = function () {
    this.currentBlock.add(this.end.bind(this));
    this.parsePreviousBlock();
}

Entity.prototype.end = function () {
    this.ended = true;
    this.executingBlock = null;
    this.executingBlockStack = [];
}   

Entity.prototype.terminate = function () {
    this.board.ended = true;
}

Entity.prototype._if_parse = function (condition) {
    var block = new IfBlock();
    
    this.currentBlock.add(this.runBlock.bind(this, block));
    
    this.parseNewBlock(block);
    this.currentBlock.addBranch(this._if.bind(this, new Expression(condition, this)));
}

Entity.prototype._if = function (condition) {
    if (!condition.evaluate()) {
        if (!this.executingBlock.nextCondition()) {
            this.runPreviousBlock();
        }
    }
}

Entity.prototype._elif_parse = function (condition) {
    this.currentBlock.add(this.runPreviousBlock.bind(this));
    this.currentBlock.addBranch(this._elif.bind(this, new Expression(condition, this)));
}

Entity.prototype._elif = function (condition) {
    if (!condition.evaluate()) {
        if (!this.executingBlock.nextCondition()) {
            this.runPreviousBlock();
        }
    }
}

Entity.prototype._else_parse = function () {
    this.currentBlock.add(this.runPreviousBlock.bind(this));
    this.currentBlock.addBranch(this._else.bind(this));
}

Entity.prototype._else = function () {
}

Entity.prototype._endif_parse = function () {
    this.currentBlock.add(this.runPreviousBlock.bind(this));
    this.parsePreviousBlock();
}

Entity.prototype._endif = function () {
    this.runPreviousBlock();
}

Entity.prototype.loop_parse = function (count) {
    count = typeof count === 'string' ? new Expression(count, this) : count;
    var block = new LoopBlock(count);
    
    this.currentBlock.add(this.runBlock.bind(this, block));
    
    this.parseNewBlock(block);
    this.currentBlock.add(this.loop.bind(this));
}

Entity.prototype.loop = function () {
    if (!this.executingBlock.iterate()) {
        this.runPreviousBlock();
    }
}

Entity.prototype.endloop_parse = function () {
    this.currentBlock.add(this.endloop.bind(this));
    this.parsePreviousBlock();
}

Entity.prototype.endloop = function () {
    this.executingBlock.restart();
}

Entity.prototype.print = function (text) {
    var printText = (text instanceof Expression) ? text.evaluate() : text;
    console.log(this.name + " " + this.depth + " : " + printText);
    this.cycleEnded = true;
}

Entity.prototype.jump = function (label) {
    this.gotoLabel(label);
}

Entity.prototype.send = function (objName, label) {
    this.board.send(objName, label);
}

Entity.prototype.set = function (varName, value) {
    this.board.variables[varName.replace('$', '')] = (value instanceof Expression) ? value.evaluate() : value;
}

Entity.prototype.wait_parse = function (count) {
    this.loop_parse(count);
    this.currentBlock.add(this.wait.bind(this));
    this.endloop_parse();
}

Entity.prototype.wait = function () {
    console.log(this.name + " wait")
    this.cycleEnded = true;
}

Entity.prototype.lock = function () {
    this.locked = true;
}

Entity.prototype.unlock = function () {
    this.locked = false;
}

Entity.prototype.zap = function (label) {
    if (this.labels[label]) {
        this.labels[label].disableActiveBlock();
    }
}

Entity.prototype.restore = function (label) {
    if (this.labels[label]) {
        this.labels[label].enablePreviousBlock();
    }
}

Entity.prototype.spawn = function (objName) {
    console.log(this.name + " spawned " + objName)
    this.board.spawn(objName, this);
}

Entity.prototype.die = function () {
    this.locked = true;
    this.ended = true;
    this.cycleEnded = true;
    this.board.deletedObjs.push(this);
}

Entity.prototype.element_set = function (id) {
    this.element = document.getElementById(id) || null;
    if (this.element)
        this.element.onclick = function () { this.gotoLabel('@click') }.bind(this);
}

Entity.prototype.element_exec = function (func) {
    if (this.element)
        func(this.element);
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
}

Board.prototype.setup = function (script) {
    var object = this.object.bind(this);
    script.call(this, object);

    return this;
}

Board.prototype.object = function (name, script) {
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
    obj.parse.call(obj);
    obj.begin.call(obj);

    this.spawnedObjs.push(obj);

    return obj;
}

Board.prototype.run = function (script) {
    var spawn = this.spawn.bind(this);
    script.call(this, spawn);

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

        if (this.ended === false)
            window.setTimeout(loop, 100);
    }.bind(this);

    window.setTimeout(loop, 100);

    return this;
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

/*Board.prototype.run = function (script) {
    var spawn = this.spawn.bind(this);
    script.call(this, spawn);

    var loop = function () {
        for (var objName in this.instances) {
            for (var i = 0; i < this.instances[objName].length; i++) {
                this.instances[objName][i].run.call(this.instances[objName][i]);
            }
        }

        //Execute spawned objects
        for (var i = 0; i < this.spawnedObjs.length; i++) {
            this.spawnedObjs[i].run.call(this.spawnedObjs[i]);
        }
        this.spawnedObjs = [];

        //Purge dead objects
        for (var i = 0; i < this.deletedObjs.length; i++) {
            this.instances[this.deletedObjs[i].name].splice(this.deletedObjs, 1);
        }
        this.deletedObjs = [];

        if (this.ended === false)
            window.setTimeout(loop, 100);
    }.bind(this);

    window.setTimeout(loop, 100);

    return this;
}


Board.prototype.spawn = function (name) {
    if (!this.objects[name])
        return;

    if (!this.instances[name])
        this.instances[name] = [];

    var obj = new Entity(this, this.objects[name].name, this.objects[name].script);
    obj.parse.call(obj);
    obj.begin.call(obj);

    this.instances[name].push(obj);

    return obj;
}*/