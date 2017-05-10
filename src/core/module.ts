import {Parser} from './parser';
import {Entity} from './environment';

export type CommandMap = {[name: string]: Function};

export interface ICommand {
    name: string;
    compile(parser: Parser): Function;
    run(entity: Entity): Function;
}

export interface IModule {
    name: string;
    compileCommands: CommandMap;
    runCommands: CommandMap;
}

export class Module implements IModule {
    name: string;
    compileCommands: CommandMap;
    runCommands: CommandMap;

    constructor(name: string, commands: ICommand[]) {
        this.name = name;
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

    constructor() {
        this.commandMap = {};
    }

    command(command: ICommand): ModuleBuilder {
        this.commandMap[command.name] = command;
        return this;
    }

    build(name: string): Module {
        const commands = Object.keys(this.commandMap).map(key => this.commandMap[key]);
        return new Module(name, commands);
    }
}