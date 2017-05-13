import {Util} from './util';
import {LabelStore, BlockStore} from './blocks';
import {TBlock, TLabel, TAnyOp, SimpleOp} from './ops';
import {Executor} from './executor';
import {Entity} from './environment';
import {IModule} from './module';

type CommandMap = {[name: string]: Function};
export type CommandTree = {[name: string]: CommandTree} | Function;

interface ICursor {
    blockId: string,
    offset: number,
    prevOp: TAnyOp,
    lastOp: TAnyOp
};

export class Parser {
    public commands: CommandTree;
    public labelStore: LabelStore;
    public blockStore: BlockStore;
    public cursor: ICursor;
    private modules: IModule[];
    private currentBlock: TBlock;
    private blockStack: TBlock[];

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

    private reset(): void {
        this.labelStore = new LabelStore();
        this.blockStore = new BlockStore();

        this.currentBlock = null;
        this.blockStack = [];

        this.resetCursor();
    }

    private resetCursor(): void {
        this.cursor.blockId = null;
        this.cursor.offset = null;
        this.cursor.prevOp = null;
        this.cursor.lastOp = null;
    }

    private updateCursor(block: TBlock): void {
        if (!block) {
            this.resetCursor();
            return;
        }

        this.cursor.blockId = block[0];
        this.cursor.offset = block[2].length;
        this.cursor.prevOp = block[2][block[2].length - 2] || null;
        this.cursor.lastOp = block[2][block[2].length - 1] || null;
    }

    private setCurrentBlock(blockId: string): void {
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

    private exitCurrentBlock(): void {
        this.blockStack.pop();
        this.currentBlock = this.blockStack[this.blockStack.length - 1];
        this.updateCursor(this.currentBlock);
    }

    hasActiveBlock(): boolean {
        return this.currentBlock != null;
    }

    enter(block: TBlock): Parser {
        this.blockStore.add(block);
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

    registerModule(module: IModule, customNamespace?: string): void {
        let namespace = customNamespace ? customNamespace : module.name;

        for (let module of this.modules) {
            if (module.name === namespace) {
                return;
            }
        }
        this.modules.push(module);

        let compileCommands: CommandMap = {};
        for (let cmdName in module.compileCommands) {
            compileCommands[cmdName] = module.compileCommands[cmdName](this);
        }

        if (namespace.length > 0) {
            if (!(namespace in this.commands)) {
                this.commands[namespace] = {};
            }
            Util.extend(this.commands[namespace], compileCommands);
        } else {
            Util.extend(this.commands, compileCommands);
        }
    }

    simpleCommand(commandName: string): Function {
        let self = this;

        return function () {
            let args = Array.prototype.slice.call(arguments);
            self.addOp(SimpleOp.create(commandName, args));
        };
    }

    parse(entity: Entity): Executor {
        this.reset();

        //TODO - preserve namespaces as in compileCommands
        let runCommands: CommandMap = {};
        for (let module of this.modules) {
            for (let cmdName of Object.keys(module.runCommands)) {
                runCommands[cmdName] = module.runCommands[cmdName](entity);
            }
        }

        let paramsStr = '["' + entity.initParams.join('","') + '"]';
        let commandKeys = Object.keys(this.commands);
        let commandVals = commandKeys.map((key) => this.commands[key]);

        (new Function(commandKeys.join(','),
            'label("init", ' + paramsStr + ');' +
            entity.script.toString().match(/{([\s\S]*)}/)[1] + ";" +
            'end();'
        )).apply(this, commandVals);

        return new Executor(runCommands, this.labelStore, this.blockStore, entity);
    }
}