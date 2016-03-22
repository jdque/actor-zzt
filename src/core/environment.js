var Util = require('./util.js');
var Evaluables = require('./evaluables.js');
var Blocks = require('./blocks.js');
var Scope = require('./scope.js');
var Parser = require('./parser.js')

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
    var block = new Blocks.Block(varParams);
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

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        World: World,
        Board: Board
    };
}