import {Util} from './util';
import {LabelStore, BlockStore} from './blocks';
import {TBlock, TLabel, TAnyOp, SimpleOp} from './ops';
import {Executor} from './executor';
import {Entity} from './environment';
import {IModule} from './module';

export type CommandTree = {[name: string]: CommandTree} | Function;

interface ICursor {
    blockId: string,
    offset: number,
    prevOp: TAnyOp,
    lastOp: TAnyOp
};

export class Parser {
    commands: CommandTree;
    modules: IModule[];
    labelStore: LabelStore;
    blockStore: BlockStore;
    currentBlock: TBlock;
    blockStack: TBlock[];
    cursor: ICursor;

    constructor() {
        this.commands = {};
        this.modules = [];
        this.labelStore = new LabelStore();
        this.blockStore = new BlockStore();
        this.currentBlock = null;
        this.blockStack = [];
        this.cursor = {
            blockId: null,
            offset: null,
            prevOp: null,
            lastOp: null
        };
    }

    reset(): void {
        this.labelStore = new LabelStore();
        this.blockStore = new BlockStore();

        this.currentBlock = null;
        this.blockStack = [];

        this.resetCursor();
    }

    registerModule(module: IModule, customName: string): void {
        let name = module.name;
        if (customName) {
            name = customName;
            module.name = customName;
        }

        for (let module of this.modules) {
            if (module.name === name) {
                return;
            }
        }
        this.modules.push(module);

        let compileCommands = {};
        for (let name in module.compileCommands) {
            compileCommands[name] = module.compileCommands[name](this);
        }

        if (name.length > 0) {
            this.commands[name] = {};
            Util.extend(this.commands[name], compileCommands);
        } else {
            Util.extend(this.commands, compileCommands);
        }

    }

    registerBlock(block: TBlock): void {
        this.blockStore.add(block);
    }

    registerLabel(label: TLabel): void {
        this.labelStore.add(label);
    }

    resetCursor(): void {
        this.cursor.blockId = null;
        this.cursor.offset = null;
        this.cursor.prevOp = null;
        this.cursor.lastOp = null;
    }

    updateCursor(block: TBlock): void {
        if (!block) {
            this.resetCursor();
            return;
        }

        this.cursor.blockId = block[0];
        this.cursor.offset = block[2].length;
        this.cursor.prevOp = block[2][block[2].length - 2] || null;
        this.cursor.lastOp = block[2][block[2].length - 1] || null;
    }

    hasActiveBlock(): boolean {
        return this.currentBlock != null;
    }

    setCurrentBlock(blockId: string): void {
        let block = this.blockStore.get(blockId);
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

    exitCurrentBlock(): void {
        this.blockStack.pop();
        this.currentBlock = this.blockStack[this.blockStack.length - 1];
        this.updateCursor(this.currentBlock);
    }

    enter(block: TBlock): Parser {
        this.registerBlock(block);
        this.setCurrentBlock(block[0]);
        return this;
    }

    exit(): Parser {
        this.exitCurrentBlock();
        return this;
    }

    addOp(op: TAnyOp): Parser {
        this.currentBlock[2].push(op);
        this.updateCursor(this.currentBlock);
        return this;
    }

    _defaultParseFunc(commandName: string): Function {
        let self = this;

        return function () {
            let args = Array.prototype.slice.call(arguments);
            self.addOp(SimpleOp.create(commandName, args));
        };
    }

    parse(entity: Entity): Executor {
        this.reset();

        //TODO - preserve namespaces as in compileCommands
        let runCommands = {};
        for (let module of this.modules) {
            for (let cmdName of Object.keys(module.runCommands)) {
                runCommands[cmdName] = module.runCommands[cmdName](entity);
            }
        }

        let varParamsStr = '["' + entity.initVarParams.join('","') + '"]';
        let commandKeys = Object.keys(this.commands);
        let commandVals = commandKeys.map((key) => this.commands[key]);

        (new Function(commandKeys.join(','),
            'label("init", ' + varParamsStr + ');' +
            entity.script.toString().match(/{([\s\S]*)}/)[1] + ";" +
            'end();'
        )).apply(this, commandVals);

        return new Executor(runCommands, this.labelStore, this.blockStore, entity);
    }
}