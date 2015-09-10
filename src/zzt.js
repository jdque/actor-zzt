Util = (function () {
    var currentId = 0;

    function generateId() {
        return currentId++;
    }

    function extend(destination, source) {
        for (var k in source) {
            if (source.hasOwnProperty(k)) {
                destination[k] = source[k];
            }
        }
        return destination;
    }

    return {
        generateId: generateId,
        extend: extend
    };
})();

Expression = function (expr, entity) {
    this.expr = new Function(
        'return ' + expr.replace(/[$]/g, 'this.variables.')
    ).bind(entity);
}

Expression.prototype.evaluate = function () {
    return this.expr();
}

Scope = function (scope, labelName) {
    var self   = "[obj].forEach(function (obj) {\n";
    var all    = "children(obj).forEach(function (obj) {\n";
    var name   = "children(obj).filter(function (obj) { return obj.name === '{name}'}).forEach(function (obj) {\n";
    var parent = "[parent(obj)].forEach(function (obj) {\n";
    var board  = "[board(obj)].forEach(function (obj) {\n";
    var label  = "obj.gotoLabel('{label}');\n";

    var funcParts = [];
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
    funcParts.push(label.replace('{label}', labelName));
    var funcStr = funcParts.join("");
    for (var i = 0; i < funcParts.length - 1; i++) {
        funcStr += "})\n";
    }

    this.scopeFunc = new Function('obj, children, parent, board', funcStr);
}

Scope.prototype.children = function (entity) {
    return entity.board.getChildObjects(entity);
}

Scope.prototype.parent = function (entity) {
    return entity.parent;
}

Scope.prototype.board = function (entity) {
    return entity.board.getEntity();
}

Scope.prototype.execute = function (entity) {
    this.scopeFunc(entity, this.children, this.parent, this.board);
}

Block = function () {
    this._id = Util.generateId().toString();
    this.commands = [];
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
        'var become    = this.commands.become;' +
        'var exec      = this.commands.exec;' +
        'var element   = this.commands.element;' +
        'var pixi      = this.commands.pixi;' +
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
        if (parser.blockStack.length === 0) {
            var block = entity.createBlock();
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

    send: function (scopeStr, label) {
        parser.currentBlock.add(entity.commands.send.bind(entity, new Scope(scopeStr, label)));
    },

    terminate: parser._defaultParseFunc(entity.commands.terminate),
    print:     parser._defaultParseFunc(entity.commands.print),
    jump:      parser._defaultParseFunc(entity.commands.jump),
    set:       parser._defaultParseFunc(entity.commands.set),
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
        var printText = (text instanceof Expression) ? text.evaluate() : text;
        console.log(printText);
        entity.cycleEnded = true;
    },

    jump: function (label) {
        entity.gotoLabel(label);
    },

    send: function (scope) {
        scope.execute(entity);
    },

    set: function (varName, value) {
        entity.variables[varName.replace('$', '')] = (value instanceof Expression) ? value.evaluate() : value;
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

    spawn: function (objName) {
        entity.board.spawnObject(objName, entity);
    },

    die: function () {
        entity.locked = true;
        entity.ended = true;
        entity.cycleEnded = true;
        entity.board.removeObject(entity);
    },

    become: function (name) {
        entity.board.replaceObject(entity, name);
    },

    exec: function (func) {
        func(entity);
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

PIXICommandSet = {};

PIXICommandSet.parseCommands = function (parser, entity) {
    var pixi = {
        set: parser._defaultParseFunc(entity.commands.pixi.set),
        color: parser._defaultParseFunc(entity.commands.pixi.color),
        moveBy: parser._defaultParseFunc(entity.commands.pixi.moveBy),
    };

    return {
        pixi: pixi
    };
};

PIXICommandSet.runCommands = function (entity) {
    var pixi = {
        set: function (tiles, w, h, x, y) {
            var obj = new TileSprite(entity.name, tiles, w, h);
            obj.position.x = x;
            obj.position.y = y;
            window.stage.addChild(obj);

            entity.pixiObject = obj;
        },

        color: function (color) {
            if (entity.pixiObject) {
                entity.pixiObject.tint = color || 0xFFFFFF;
            }
        },

        moveBy: function (dx, dy) {
            if (entity.pixiObject) {
                entity.pixiObject.position.x += dx;
                entity.pixiObject.position.y += dy;
                //entity.cycleEnded = true;
            }
        }
    };

    return {
        pixi: pixi
    };
};

Entity = function (board, name, script) {
    //Properties
    this.board = board;
    this.name = name;
    this.script = script;
    this.depth = 0;
    this.parent = null;

    //State
    this.variables = {};
    this.ended = false;
    this.cycleEnded = false;
    this.locked = false;

    //Execution
    this.labels = {};
    this.blocks = [];
    this.commands = {};
    this.executingBlock = null;
    this.executingBlockStack = [];

    //Parsing
    this.parser = new Parser(this);

    Util.extend(this.commands, DefaultCommandSet.runCommands.call(null, this));
    Util.extend(this.parser.commands, DefaultCommandSet.parseCommands.call(null, this.parser, this));
    Util.extend(this.commands, DOMCommandSet.runCommands.call(null, this));
    Util.extend(this.parser.commands, DOMCommandSet.parseCommands.call(null, this.parser, this));
    Util.extend(this.commands, PIXICommandSet.runCommands.call(null, this));
    Util.extend(this.parser.commands, PIXICommandSet.parseCommands.call(null, this.parser, this));
}

Entity.prototype.begin = function () {
    this.cycleEnded = false;
    this.gotoLabel('_start');
}

Entity.prototype.gotoLabel = function (name) {
    if (this.locked || !this.labels[name])
        return;

    if (!this.labels[name].getActiveBlockRef())
        return;

    var blockRef = this.labels[name].getActiveBlockRef();
    this.executingBlock = this.getBlock(blockRef.blockId); 
    this.executingBlock.reset();
    this.executingBlock.gotoOffset(blockRef.offset);
    this.executingBlockStack = [this.executingBlock];

    this.ended = false;
    this.cycleEnded = false;
}

Entity.prototype.createBlock = function () {
    var block = new Block();
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

    //TODO add consecutive execution as an option
    while (this.executingBlock.execNext()) {
        if (this.cycleEnded || this.ended)
            break;
    }
}

Board = function () {
    //Setup
    this.setupFunc = function () {};
    this.finishFunc = function () {};
    this.runScript = function () {};
    this.objects = {};

    //Execution
    this.boardEntity = null;
    this.instances = [{}];
    this.spawnedObjs = [];
    this.deletedObjs = [];

    this.terminated = false;
}

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

Board.prototype.execute = function () {
    //Run setup
    (new Function(
        'var object = this.defineObject.bind(this);' +
        this.setupFunc.toString().replace("function ()", "")
    ).bind(this))();

    //Run root entity script
    this.boardEntity = new Entity(this, "_board", this.runScript);
    this.boardEntity.depth = 0;
    this.boardEntity.parent = this.boardEntity;
    this.boardEntity.parser.parse();
    this.boardEntity.begin();
    this.instances[0]["_board"] = [];
    this.instances[0]["_board"].push(this.boardEntity);
    while (!this.boardEntity.ended) {
        this.boardEntity.execute();
    }

    //Begin execution loop
    this.runEntityTree();
}

Board.prototype.runEntityTree = function () {
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
                    this.instances[i][objName][j].execute();
                }
            }
        }

        if (this.terminated === false) {
            //loop()
        }
        else {
            this.finishFunc();
        }
    }.bind(this);

    loop();
}

Board.prototype.getEntity = function () {
    return this.boardEntity;
}

Board.prototype.defineObject = function (name, script) {
    if (this.objects[name]) {
        throw "Duplicate object definition";
    }
    var obj = new Entity(this, name, script);
    this.objects[name] = obj;

    return obj;
}

Board.prototype.spawnObject = function (name, parent) {
    if (!this.objects[name])
        return;

    if (parent) {
        if (this.instances.length <= parent.depth + 1)
            this.instances.push({});
    }

    var obj = new Entity(this, this.objects[name].name, this.objects[name].script);
    obj.depth = parent ? parent.depth + 1 : 0;
    obj.parent = parent || obj;
    obj.parser.parse();
    obj.begin();

    this.spawnedObjs.push(obj);

    return obj;
}

Board.prototype.removeObject = function (entity) {
    this.deletedObjs.push(entity);
}

Board.prototype.replaceObject = function (target, newName) {
    var newObject = this.spawnObject(this.objects[newName].name, target.parent);

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


if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        Board: Board
    };
}