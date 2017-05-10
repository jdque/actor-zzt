import {Type, TSimpleOp, TEnterOp, TExitOp, TJumpOp, TIfOp, TLoopOp, TAnyOp} from './ops';
import {BlockStore, LabelStore} from './blocks';
import {IEvaluable, isEvaluable} from './evaluables';
import {Entity} from './environment';

type CommandTree = {[name: string]: CommandTree} | Function;
type VariableSet = {[name: string]: any};

const LOOP_COUNT_KEY = '__loopCount';

interface IFrame {
    blockId: string,
    offset: number,
    variables: VariableSet
};

export class Executor {
    commands: CommandTree;
    labelStore: LabelStore;
    blockStore: BlockStore;
    entity: Entity;
    currentLabelFrame: IFrame;
    currentFrame: IFrame;
    frameStack: IFrame[];

    constructor(commands: CommandTree, labelStore: LabelStore, blockStore: BlockStore, entity: Entity) {
        this.commands = commands;
        this.labelStore = labelStore;
        this.blockStore = blockStore;
        this.entity = entity;
        this.currentLabelFrame = null;
        this.currentFrame = null;
        this.frameStack = [];
    }

    setCurrentFrame(blockId: string, offset: number): void {
        if (this.currentFrame && blockId === this.currentFrame.blockId) {
            this.currentFrame.offset = offset;
            this.currentFrame.variables = {};
        } else {
            this.currentFrame = {
                blockId: blockId,
                offset: offset || 0,
                variables: {}
            };
            if (this.frameStack.length === 0) {
                this.currentLabelFrame = this.currentFrame;
            }
            this.frameStack.push(this.currentFrame);
        }
    }

    exitCurrentFrame(): void {
        this.frameStack.pop();
        this.currentFrame = this.frameStack[this.frameStack.length - 1];
    }

    clearFrameStack(): void {
        this.currentLabelFrame = null;
        this.currentFrame = null;
        this.frameStack = [];
    }

    step(): boolean {
        const opList = this.blockStore.get(this.currentFrame.blockId)[2];
        if (this.currentFrame.offset === opList.length) {
            return false;
        }

        const op = opList[this.currentFrame.offset];
        this.execOp(op);

        return true;
    }

    execOp(op: TAnyOp): void {
        const opType = op[0];
        switch (opType) {
            case Type.SIMPLE_OP:
                this.execSimpleOp(<TSimpleOp>op);
                break;
            case Type.ENTER_OP:
                this.execEnterOp(<TEnterOp>op);
                break;
            case Type.EXIT_OP:
                this.execExitOp(<TExitOp>op);
                break;
            case Type.JUMP_OP:
                this.execJumpOp(<TJumpOp>op);
                break;
            case Type.IF_OP:
                this.execIfOp(<TIfOp>op);
                break;
            case Type.LOOP_OP:
                this.execLoopOp(<TLoopOp>op);
                break;
        }
    }

    execSimpleOp(op: TSimpleOp): void {
        const name = op[1];
        const args = op[2];

        //TODO: predetermine command path
        let module = this.commands;
        let commandPath = name.split('.');
        for (let i = 0; i < commandPath.length - 1; i++) {
            module = module[commandPath[i]];
        }
        let command = module[commandPath[commandPath.length - 1]];

        let evaluatedArgs = [];
        for (let arg of args) {
            evaluatedArgs.push(isEvaluable(arg) ? arg.evaluate(this.entity) : arg);
        }

        command.apply(null, evaluatedArgs);

        if (this.currentFrame) {
            this.currentFrame.offset++;
        }
    }

    execEnterOp(op: TEnterOp): void {
        const blockId = op[1];
        this.setCurrentFrame(blockId, 0);
    }

    execExitOp(op: TExitOp): void {
        const blockId = op[1];
        //TODO: need to validate?
        this.exitCurrentFrame();
        this.currentFrame.offset++;
    }

    execJumpOp(op: TJumpOp): void {
        const label = this.labelStore.get(op[1]);
        if (!label) {
            this.currentFrame.offset++;
            return;
        }

        const args = op[2];
        const params = label[1];
        const blockId = label[2];
        const blockOffset = label[3];

        this.clearFrameStack();
        this.setCurrentFrame(blockId, blockOffset);

        for (let i = 0; i < args.length; i++) {
            if (i >= params.length) {
                break;
            }
            let varName = params[i];
            let value = isEvaluable(args[i]) ? args[i].evaluate(this.entity) : args[i];
            this.currentLabelFrame.variables[varName] = value;
        }
    }

    execIfOp(op: TIfOp): void {
        const condition = op[1];
        const successOp = op[2];
        const failOp = op[3];

        let condVal = isEvaluable(condition) ? condition.evaluate(this.entity) : condition;
        if (condVal === true) {
            this.execOp(successOp);
        } else {
            if (failOp != null) {
                this.execOp(failOp);
            } else {
                this.exitCurrentFrame();
                this.currentFrame.offset++;
            }
        }
    }

    execLoopOp(op: TLoopOp): void {
        const count = op[1];
        const loopedOp = op[2];
        const curFrame = this.currentFrame;

        if (curFrame.variables[LOOP_COUNT_KEY] === undefined) {
            let countVal = isEvaluable(count) ? count.evaluate(this.entity) : count;
            curFrame.variables[LOOP_COUNT_KEY] = countVal;
        }

        let curCount = curFrame.variables[LOOP_COUNT_KEY];
        if (curCount > 0) {
            curFrame.variables[LOOP_COUNT_KEY] -= 1;
            curFrame.offset--;
            this.execOp(loopedOp);
        } else {
            delete curFrame.variables[LOOP_COUNT_KEY];
            curFrame.offset++;
        }
    }
}