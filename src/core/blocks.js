var Util = require('./util.js');

function LabelStore() {
    this.labels = {};
    this.offsets = {};
}

LabelStore.prototype.add = function (labelOp) {
    var name = labelOp[0];
    if (this.labels[name]) {
        this.labels[name].push(labelOp);
    } else {
        this.labels[name] = [labelOp];
        this.offsets[name] = 0;
    }
}

LabelStore.prototype.clear = function (labelName) {
    delete this.labels[labelName];
    delete this.offsets[labelName];
}

LabelStore.prototype.get = function (labelName) {
    if (!this.hasEnabled(labelName)) {
        return null;
    }

    return this.labels[labelName][this.offsets[labelName]];
}

LabelStore.prototype.hasEnabled = function (labelName) {
    if (!this.labels[labelName]) {
        return false;
    }
    if (this.offsets[labelName] >= this.labels[labelName].length) {
        return false;
    }

    return true;
}

LabelStore.prototype.disableCurrent = function (labelName) {
    if (!this.hasEnabled(labelName)) {
        return;
    }

    this.offsets[labelName] += 1;
}

LabelStore.prototype.enablePrevious = function (labelName) {
    if (!this.labels[labelName] || this.offsets[labelName] === 0) {
        return;
    }

    this.offsets[labelName] -= 1;
}

function BlockStore() {
    this.blocks = {};
}

BlockStore.prototype.add = function (block) {
    var id = block[0];
    this.blocks[id] = block;
}

BlockStore.prototype.get = function (blockId) {
    return this.blocks[blockId];
}

//BLOCK: <id, param[], op[]>
var Block = {
    create: function (params) {
        return [Util.generateId().toString(), params || [], []];
    }
}

//LABEL: <name, param[], block, offset>
var Label = {
    create: function (name, params, blockId, offset) {
        return [name, params, blockId, offset];
    }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        LabelStore: LabelStore,
        BlockStore: BlockStore,
        Block: Block,
        Label: Label
    }
}