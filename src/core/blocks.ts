import {TBlock, TLabel} from './ops';

export interface IStore<K, V> {
    add(value: V): void;
    clear(key: K): void;
    get(key: K): V;
}

export class BlockStore implements IStore<string, TBlock> {
    blocks: {[blockId: string]: TBlock};

    constructor() {
        this.blocks = {};
    }

    add(block: TBlock): void {
        let id = block[0];
        this.blocks[id] = block;
    }

    clear(blockId: string): void {
        delete this.blocks[blockId];
    }

    get(blockId: string): TBlock {
        return this.blocks[blockId];
    }
}

export class LabelStore implements IStore<string, TLabel> {
    labels: {[labelName: string]: TLabel[]};
    offsets: {[labelName: string]: number};

    constructor() {
        this.labels = {};
        this.offsets = {};
    }

    add(label: TLabel): void {
        let name = label[0];
        if (this.labels[name]) {
            this.labels[name].push(label);
        } else {
            this.labels[name] = [label];
            this.offsets[name] = 0;
        }
    }

    clear(labelName: string): void {
        delete this.labels[labelName];
        delete this.offsets[labelName];
    }

    get(labelName: string): TLabel {
        if (!this.hasEnabled(labelName)) {
            return null;
        }

        return this.labels[labelName][this.offsets[labelName]];
    }

    hasEnabled(labelName: string): boolean {
        if (!this.labels[labelName]) {
            return false;
        }
        if (this.offsets[labelName] >= this.labels[labelName].length) {
            return false;
        }

        return true;
    }

    disableCurrent(labelName: string): void {
        if (!this.hasEnabled(labelName)) {
            return;
        }

        this.offsets[labelName] += 1;
    }

    enablePrevious(labelName: string): void {
        if (!this.labels[labelName] || this.offsets[labelName] === 0) {
            return;
        }

        this.offsets[labelName] -= 1;
    }
}