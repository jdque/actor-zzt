import {IStore} from './blocks';
import {Entity} from './environment';

export class GroupStore implements IStore<string, Group> {
    groups: {[name: string]: Group};

    constructor() {
        this.groups = {};
    }

    add(group: Group): void {
        if (this.groups[group.name]) {
            return;
        }
        this.groups[group.name] = group;
    }

    clear(groupName: string): void {
        delete this.groups[groupName];
    }

    get(groupName: string): Group {
        return this.groups[groupName] || null;
    }

    defineGroup(groupName: string): void {
        if (this.groups[groupName]) {
            return;
        }
        this.add(new Group(groupName));
    }

    hasGroup(groupName: string): boolean {
        return this.get(groupName) !== null;
    }
}

export class Group {
    name: string;
    entities: Entity[];

    constructor(name: string) {
        this.name = name;
        this.entities = [];
    }

    addEntity(entity: Entity): void {
        if (this.entities.indexOf(entity) >= 0)
            return;

        this.entities.push(entity);
    }

    removeEntity(entity: Entity): void {
        if (this.entities.indexOf(entity) === -1)
            return;

        this.entities.splice(this.entities.indexOf(entity), 1);
    }

    clear(): void {
        this.entities = [];
    }

    getEntities(): Entity[] {
        return this.entities;
    }
}