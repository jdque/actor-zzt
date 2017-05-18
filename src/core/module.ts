import {Parser} from './parser';
import {Entity} from './environment';

interface CompileFunc { (parser: Parser): Function };
interface RunFunc { (entity: Entity, data?: ModuleData) : Function };

export type ModuleData = {[moduleName: string]: ModuleData} | any;

export interface ICommand {
    name: string;
    compile: CompileFunc;
    run: RunFunc;
}

export interface IModule {
    name: string;
    data: ModuleData;
    compileCommands: {[name: string]: CompileFunc};
    runCommands: {[name: string]: RunFunc};
}

class Module implements IModule {
    name: string;
    data: ModuleData;
    compileCommands: {[name: string]: CompileFunc};
    runCommands: {[name: string]: RunFunc};

    constructor(name: string, data: ModuleData, commands: ICommand[]) {
        this.name = name;
        this.data = data;
        this.compileCommands = {};
        this.runCommands = {};

        for (let cmd of commands) {
            if (cmd.compile) {
                this.compileCommands[cmd.name] = cmd.compile;
            }
            if (cmd.run) {
                this.runCommands[cmd.name] = cmd.run;
            }
        }
    }
}

export class ModuleBuilder {
    private commandMap: {[name: string]: ICommand};
    private dataObj: ModuleData;

    constructor() {
        this.commandMap = {};
        this.dataObj = {};
    }

    command(command: ICommand): ModuleBuilder {
        this.commandMap[command.name] = command;
        return this;
    }

    data(data: ModuleData): ModuleBuilder {
        this.dataObj = data;
        return this;
    }

    build(name: string): IModule {
        const commands = Object.keys(this.commandMap).map(key => this.commandMap[key]);
        return new Module(name, this.dataObj, commands);
    }
}