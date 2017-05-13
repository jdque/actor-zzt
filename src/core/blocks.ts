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

    constructor() {
        this.labels = {};
    }

    add(label: TLabel): void {
        let name = label[0];
        if (this.labels[name]) {
            this.labels[name].push(label);
        } else {
            this.labels[name] = [label];
        }
    }

    clear(labelName: string): void {
        delete this.labels[labelName];
    }

    get(labelName: string, offset?: number): TLabel {
        if (!this.labels[labelName]) {
            return null;
        }
        return this.labels[labelName][offset || 0];
    }

    getLabelCount(labelName: string): number {
        return this.labels[labelName].length;
    }

    getLabelNames(): string[] {
        return Object.keys(this.labels);
    }
}

export class LabelOffsets {
    offsets: {[labelName: string]: [number, number]};

    constructor(labelStore: LabelStore) {
        this.offsets = {};
        for (let name of labelStore.getLabelNames()) {
            this.offsets[name] = [0, labelStore.getLabelCount(name)];
        }
    }

    getOffset(labelName: string): number {
        if (!this.offsets[labelName]) {
            return 0;
        }
        return this.offsets[labelName][0];
    }

    hasEnabled(labelName: string): boolean {
        if (!this.offsets[labelName]) {
            return false;
        }
        if (this.offsets[labelName][0] >= this.offsets[labelName][1]) {
            return false;
        }

        return true;
    }

    disableCurrent(labelName: string): void {
        if (!this.hasEnabled(labelName)) {
            return;
        }

        this.offsets[labelName][0] += 1;
    }

    enablePrevious(labelName: string): void {
        if (!this.offsets[labelName] || this.offsets[labelName][0] === 0) {
            return;
        }

        this.offsets[labelName][0] -= 1;
    }
}