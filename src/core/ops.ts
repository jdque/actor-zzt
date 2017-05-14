import {Util} from './util';
import {IEvaluable} from './evaluables';

export const enum Type {
    SIMPLE_OP,
    ENTER_OP,
    EXIT_OP,
    JUMP_OP,
    IF_OP,
    LOOP_OP
};

export type TBlock       = [string, any[], TAnyOp[]];
export type TLabel       = [string, any[], string, number];
export type TSimpleOp    = [Type.SIMPLE_OP, string, any[]];
export type TEnterOp     = [Type.ENTER_OP, string];
export type TExitOp      = [Type.EXIT_OP, string];
export type TJumpOp      = [Type.JUMP_OP, string, any[]];
export type TIfOp        = [Type.IF_OP, IEvaluable<boolean>, TEnterExitOp, TEnterExitOp];
export type TLoopOp      = [Type.LOOP_OP, IEvaluable<number>, TEnterOp];
export type TEnterExitOp = TEnterOp | TExitOp;
export type TAnyOp       = TSimpleOp | TEnterOp | TExitOp | TJumpOp | TIfOp | TLoopOp;

export class Block {
    static create(params: any[] = []): TBlock {
        return [Util.generateId().toString(), params, []];
    }
}

export class Label {
    static create(name: string, params: any[] = [], blockId: string, offset: number): TLabel {
        return [name, params, blockId, offset];
    }
}

export class SimpleOp {
    static create(commandName: string, args: any[] = []): TSimpleOp {
        return [Type.SIMPLE_OP, commandName, args];
    }
}

export class EnterOp {
    static create(blockId: string): TEnterOp {
        return [Type.ENTER_OP, blockId];
    }
}

export class ExitOp {
    static create(blockId: string): TExitOp {
        return [Type.EXIT_OP, blockId];
    }
}

export class JumpOp {
    static create(labelName: string, args: any[] = []): TJumpOp {
        return [Type.JUMP_OP, labelName, args];
    }
}

export class IfOp {
    static create(condition: IEvaluable<boolean>, successOp: TEnterExitOp, failOp: TEnterExitOp): TIfOp {
        return [Type.IF_OP, condition, successOp, failOp];
    }
}

export class LoopOp {
    static create(count: IEvaluable<number>, op: TEnterOp): TLoopOp {
        return [Type.LOOP_OP, count, op];
    }
}