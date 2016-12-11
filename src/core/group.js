function GroupStore() {
    this.groups = {};
    this.entityGroupMap = {};
}

GroupStore.prototype.defineGroup = function (groupName) {
    if (this.groups[groupName])
        return;

    this.groups[groupName] = new Group(groupName);
}

GroupStore.prototype.isGroupDefined = function (groupName) {
    return this.groups[groupName] != null;
}

GroupStore.prototype.getGroup = function (groupName) {
    return this.groups[groupName] || null;
}

function Group(name) {
    this.name = name;
    this.entities = [];
}

Group.prototype.addEntity = function (entity) {
    if (this.entities.indexOf(entity) >= 0)
        return;

    this.entities.push(entity);
}

Group.prototype.removeEntity = function (entity) {
    if (this.entities.indexOf(entity) === -1)
        return;

    this.entities.splice(this.entities.indexOf(entity), 1);
}

Group.prototype.clear = function () {
    this.entities = [];
}

Group.prototype.getEntities = function () {
    return this.entities;
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        GroupStore: GroupStore,
        Group: Group
    };
}