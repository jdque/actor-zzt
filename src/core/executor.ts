import {Type, TSimpleOp, TEnterOp, TExitOp, TJumpOp, TIfOp, TLoopOp, TAnyOp} from './ops';
import {BlockStore, LabelStore, LabelOffsets} from './blocks';
import {IEvaluable, isEvaluable} from './evaluables';
import {ModuleData} from './module';
import {Entity} from './environment';

const LOOP_COUNT_KEY = '__loopCount';

export const enum StepResult {
    CONTINUE,
    HALT
};

type CommandTree = {[name: string]: CommandTree} | Function;
type VariableSet = {[name: string]: any};

interface IFrame {
    blockId: string;
    offset: number;
    variables: VariableSet;
};

export interface IExecutionContext {
    readonly entity: Entity;
    readonly commands: CommandTree;
    readonly labelStore: LabelStore;
    readonly blockStore: BlockStore;
}

export interface IExecutionState {
    currentLabelFrame: IFrame;
    currentFrame: IFrame;
    frameStack: IFrame[];
    labelOffsets: LabelOffsets;
    moduleData: ModuleData;
}

export class Executor {
    private context: IExecutionContext;
    private state: IExecutionState;

    constructor() {
        this.context = null;
        this.state = null;
    };

    private setCurrentFrame(blockId: string, offset: number): void {
        if (this.state.currentFrame && blockId === this.state.currentFrame.blockId) {
            this.state.currentFrame.offset = offset;
            this.state.currentFrame.variables = {};
        } else {
            this.state.currentFrame = {
                blockId: blockId,
                offset: offset || 0,
                variables: {}
            };
            if (this.state.frameStack.length === 0) {
                this.state.currentLabelFrame = this.state.currentFrame;
            }
            this.state.frameStack.push(this.state.currentFrame);
        }
    }

    private exitCurrentFrame(): void {
        this.state.frameStack.pop();
        this.state.currentFrame = this.state.frameStack[this.state.frameStack.length - 1];
    }

    private clearFrameStack(): void {
        this.state.currentLabelFrame = null;
        this.state.currentFrame = null;
        this.state.frameStack = [];
    }

    private execSimpleOp(op: TSimpleOp): void {
        const name = op[1];
        const args = op[2];

        //TODO: predetermine command path
        let module = this.context.commands;
        let commandPath = name.split('.');
        for (let i = 0; i < commandPath.length - 1; i++) {
            module = module[commandPath[i]];
        }
        let command = module[commandPath[commandPath.length - 1]];

        let evaluatedArgs = new Array(args.length);
        for (let i = 0; i < args.length; i++) {
            evaluatedArgs[i] = isEvaluable(args[i]) ? args[i].evaluate(this.context.entity) : args[i];
        }

        command(...evaluatedArgs);

        if (this.state.currentFrame) {
            this.state.currentFrame.offset++;
        }
    }

    private execEnterOp(op: TEnterOp): void {
        const blockId = op[1];
        this.setCurrentFrame(blockId, 0);
    }

    private execExitOp(op: TExitOp): void {
        const blockId = op[1];
        //TODO: need to validate?
        this.exitCurrentFrame();
        this.state.currentFrame.offset++;
    }

    private execJumpOp(op: TJumpOp): void {
        const label = this.context.labelStore.get(op[1], this.state.labelOffsets.getOffset(op[1]));
        if (!label) {
            this.state.currentFrame.offset++;
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
            let value = isEvaluable(args[i]) ? args[i].evaluate(this.context.entity) : args[i];
            this.state.currentLabelFrame.variables[varName] = value;
        }
    }

    private execIfOp(op: TIfOp): void {
        const condition = op[1];
        const successOp = op[2];
        const failOp = op[3];

        let condVal = isEvaluable(condition) ? condition.evaluate(this.context.entity) : condition;
        if (condVal === true) {
            this.execOp(successOp);
        } else {
            if (failOp != null) {
                this.execOp(failOp);
            } else {
                this.exitCurrentFrame();
                this.state.currentFrame.offset++;
            }
        }
    }

    private execLoopOp(op: TLoopOp): void {
        const count = op[1];
        const loopedOp = op[2];
        const curFrame = this.state.currentFrame;

        if (curFrame.variables[LOOP_COUNT_KEY] === undefined) {
            let countVal = isEvaluable(count) ? count.evaluate(this.context.entity) : count;
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

    execOp(op: TAnyOp, context?: IExecutionContext, state?: IExecutionState): void {
        if (context) {
            this.context = context;
        }
        if (state) {
            this.state = state;
        }

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

    step(context: IExecutionContext, state: IExecutionState): StepResult {
        this.context = context;
        this.state = state;

        const opList = this.context.blockStore.get(this.state.currentFrame.blockId)[2];
        if (this.state.currentFrame.offset === opList.length) {
            return StepResult.HALT;
        }

        const op = opList[this.state.currentFrame.offset];
        this.execOp(op);

        return StepResult.CONTINUE;
    }
}