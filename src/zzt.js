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
    this.entity = entity;
    this.expr = new Function(
        'return ' + expr.replace(/\@/g, 'this.executingBlock.variables.').replace(/\$/g, 'this.variables.')
    );
}

Expression.prototype.evaluate = function () {
    return this.expr.call(this.entity);
}

Scope = function (scope) {
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
    return entity.board.getEntity();
}

Scope.prototype.execute = function (entity) {
    return this.scopeFunc(entity, this.children, this.parent, this.board) || [];
}

Block = function (varParams) {
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
        this.variables[varName] = (value instanceof Expression) ? value.evaluate() : value;
    }
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

    this.modules = {};
    this.addedModules = [];
}

Parser.prototype.registerModule = function (name, moduleObj) {
    this.modules[name] = moduleObj;
}

Parser.prototype.addModule = function (name) {
    var moduleObj = this.modules[name];
    if (!moduleObj) {
        return;
    }

    this.addedModules.push(name);
    Util.extend(this.entity.commands, moduleObj.runCommands.call(null, this.entity));
    Util.extend(this.commands, moduleObj.parseCommands.call(null, this, this.entity));
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
    var commands =
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
        'var adopt     = this.commands.adopt;';

    this.addedModules.forEach(function (name) {
        commands += 'var ' + name + ' = this.commands.' + name + ';';
    });

    var varParams = '["' + this.entity.initVarParams.join('","') + '"]';

    (new Function(
        commands +
        'label("_start", ' + varParams + ');' +
        this.entity.script.toString().replace("function ()", "") + ";" +
        'end();'
    )).call(this);
}

DefaultCommandSet = {};

DefaultCommandSet.parseCommands = function (parser, entity) { return {
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

    send: function (scopeStr, label, varArgs) {
        parser.currentBlock.add(entity.commands.send.bind(entity, new Scope(scopeStr), label, varArgs));
    },

    adopt: function (moduleName, initParams) {
        parser.currentBlock.add(entity.commands[moduleName].__init__.bind(entity, initParams));
    },

    set: function (varName, value) {
        parser.currentBlock.add(entity.commands.set.bind(entity, varName, value));
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

    jump: function (label, varArgs) {
        entity.gotoLabel(label, varArgs);
    },

    send: function (scope, label, varArgs) {
        var objects = scope.execute(entity);
        for (var i = 0; i < objects.length; i++) {
            objects[i].gotoLabel(label, varArgs);
        }
    },

    set: function (varName, value) {
        var resolvedName = varName.replace('@', '').replace('$', '');
        var resolvedValue = (value instanceof Expression) ? value.evaluate() : value;
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
        entity.board.spawnObject(objName, entity, initVarArgs);
    },

    die: function () {
        entity.locked = true;
        entity.ended = true;
        entity.cycleEnded = true;
        entity.board.removeObject(entity);
    },

    become: function (name, initVarArgs) {
        entity.board.replaceObject(entity, name, initVarArgs);
    },

    exec: function (func) {
        func(entity);
    }
}};

DOMCommandSet = {};

DOMCommandSet.parseCommands = function (parser, entity) {
    var html = {
        set: parser._defaultParseFunc(entity.commands.html.set),
        exec: parser._defaultParseFunc(entity.commands.html.exec),
    };

    return {
        html: html
    };
};

DOMCommandSet.runCommands = function (entity) {
    var html = {
        __init__: function (params) {
            entity.element = document.getElementById(params.id) || null;
            if (entity.element) {
                entity.element.onclick = function () { entity.gotoLabel('@click') }.bind(entity);
            }
        },

        exec: function (func) {
            if (entity.element) {
                func(entity.element);
            }
        }
    };

    return {
        html: html
    };
};

PIXICommandSet = {};

PIXICommandSet.parseCommands = function (parser, entity) {
    var pixi = {
        set: parser._defaultParseFunc(entity.commands.pixi.set),
        color: parser._defaultParseFunc(entity.commands.pixi.color),
        alpha: parser._defaultParseFunc(entity.commands.pixi.alpha),
        moveBy: parser._defaultParseFunc(entity.commands.pixi.moveBy)
    };

    return {
        pixi: pixi
    };
};

PIXICommandSet.runCommands = function (entity) {
    var pixi = {
        __init__: function (params) {
            var obj = new TileSprite(entity.name, params.tiles, params.width, params.height);
            obj.position.x = params.x;
            obj.position.y = params.y;
            window.stage.addChild(obj);

            entity.pixiObject = obj;
        },

        color: function (color) {
            if (entity.pixiObject) {
                entity.pixiObject.tint = color || 0xFFFFFF;
            }
        },

        alpha: function (alpha) {
            if (entity.pixiObject) {
                entity.pixiObject.alpha = alpha || 1;
            }
        },

        moveBy: function (dx, dy) {
            if (entity.pixiObject) {
                entity.pixiObject.position.x += dx;
                entity.pixiObject.position.y += dy;
            }
        }
    };

    return {
        pixi: pixi
    };
};

PhysicsCommandSet = {};

PhysicsCommandSet.parseCommands = function (parser, entity) {
    var body = {
        set: parser._defaultParseFunc(entity.commands.body.set),
        moveBy: parser._defaultParseFunc(entity.commands.body.moveBy),

        move: function (dirStr) {
            var dirs = dirStr.split('/');
            for (var i = 0; i < dirs.length; i++) {
                if (dirs[i].length === 0)
                    continue;

                parser.currentBlock.add(entity.commands.body.move.bind(entity, dirs[i]));
                parser.commands.wait(5);
            }
        }
    };

    return {
        body: body
    };
};

PhysicsCommandSet.runCommands = function (entity) {
    var body = {
        __init__: function (params) {
            entity.body = {
                bounds: params.bounds,
                spatial: params.spatial
            };

            entity.body.spatial.register(entity);
        },

        moveBy: function (dx, dy) {
            if (!entity.body)
                return;

            var objs = entity.body.spatial.getIntersect(entity.body.bounds, dx, dy);
            if (objs.length <= 1) {
                entity.body.bounds.x += dx;
                entity.body.bounds.y += dy;
            }

            entity.body.spatial.update(entity);

            if (entity.pixiObject) {
                entity.pixiObject.position.x = entity.body.bounds.x;
                entity.pixiObject.position.y = entity.body.bounds.y;
            }
        },

        move: function (dir) {
            var dx = 0;
            var dy = 0;
            switch(dir) {
                case 'n':
                    dy = -8;
                    break;
                case 's':
                    dy = 8;
                    break;
                case 'w':
                    dx = -8;
                    break;
                case 'e':
                    dx = 8;
                    break;
                case 'rnd':
                    var dir = Math.floor(Math.random() * 4);
                    if      (dir === 0) { dy = -8; }
                    else if (dir === 1) { dy = 8;  }
                    else if (dir === 2) { dx = -8; }
                    else                { dx = 8;  }
                    break;
            }
            entity.commands.body.moveBy(dx, dy);
        }
    };

    return {
        body: body
    };
};

Entity = function (board, name, script, initVarParams) {
    //Properties
    this.id = Util.generateId().toString();
    this.board = board;
    this.name = name;
    this.script = script;
    this.depth = 0;
    this.parent = null;
    this.initVarParams = initVarParams || [];

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

    this.parser.registerModule('html', DOMCommandSet);
    this.parser.registerModule('pixi', PIXICommandSet);
    this.parser.registerModule('body', PhysicsCommandSet);
    this.parser.addModule('html');
    this.parser.addModule('pixi');
    this.parser.addModule('body');
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
    this.executingBlock = this.getBlock(blockRef.blockId); 
    this.executingBlock.reset();
    this.executingBlock.gotoOffset(blockRef.offset);
    this.executingBlock.injectArguments(varArgs);
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

Board = function () {
    //Setup
    this.setupFunc = function () {};
    this.finishFunc = function () {};
    this.runScript = function () {};
    this.objects = {};
    this.autoStep = false;

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

Board.prototype.setAutoStep = function (autoStep) {
    this.autoStep = autoStep;
    return this;
}

Board.prototype.execute = function () {
    //Run setup
    (new Function(
        'var object = this.defineObject.bind(this);' +
        this.setupFunc.toString().replace("function ()", "")
    )).call(this);

    //Run root entity script
    this.boardEntity = new Entity(this, "_board", this.runScript, []);
    this.boardEntity.depth = 0;
    this.boardEntity.parent = this.boardEntity;
    this.boardEntity.parser.parse();
    this.boardEntity.begin();
    this.instances[0]["_board"] = [];
    this.instances[0]["_board"].push(this.boardEntity);

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

    if (this.terminated) {
        this.finishFunc();
    }
}

Board.prototype.getEntity = function () {
    return this.boardEntity;
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

    var obj = new Entity(this, this.objects[name].name, this.objects[name].script, this.objects[name].initVarParams);
    obj.depth = parent ? parent.depth + 1 : 0;
    obj.parent = parent || obj;
    obj.parser.parse();
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


if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        Board: Board
    };
}