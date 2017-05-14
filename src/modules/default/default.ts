import * as Ops from '../../core/ops';
import {isEvaluable, IEvaluable, ArrayValue, DeferredFunction, Expression, Scope, Value} from '../../core/evaluables';
import {Entity} from '../../core/environment';
import {ModuleBuilder} from '../../core/module';

type SpawnNode = [string, any[], any[]];

let builder = new ModuleBuilder();

builder
    .command({
        name: 'get',
        compile: (parser) => (varSpec: string | Array<any>): IEvaluable<any> => {
            if (typeof varSpec === 'string') {
                return new Value(varSpec);
            } else if (varSpec instanceof Array) {
                return new ArrayValue(varSpec);
            }
        },
        run: null
    })
    .command({
        name: '$',
        compile: (parser) => (varSpec: string | Array<any>): IEvaluable<any> => {
            return parser.commands['get'](varSpec);
        },
        run: null
    })
    .command({
        name: 'val',
        compile: (parser) => (func: Function): IEvaluable<any> => {
            return new DeferredFunction(func);
        },
        run: null
    })
    .command({
        name: 'expr',
        compile: (parser) => (expr: string): IEvaluable<any> => {
            return new Expression(expr);
        },
        run: null
    })
    .command({
        name: 'label',
        compile: (parser) => (name: string, params: any[]) => {
            if (!parser.hasActiveBlock()) {
                var block = Ops.Block.create([]);
                parser.enter(block);
            }

            var label = Ops.Label.create(name, params, parser.cursor.blockId, parser.cursor.offset);
            if (name === 'init') {
                parser.labelStore.clear(name);
            }
            parser.labelStore.add(label);
        },
        run: null
    })
    .command({
        name: 'end',
        compile: (parser) => () => {
            if (!parser.hasActiveBlock()) {
                return;
            }

            parser
                .addOp(Ops.SimpleOp.create('end', []))
                .exit();
        },
        run: (entity) => () => {
            entity.ended = true;
            entity.clearFrameStack();
        }
    })
    .command({
        name: '_if',
        compile: (parser) => (condition: string | Expression) => {
            var ifBlock = Ops.Block.create([]);
            var successBlock = Ops.Block.create([]);

            parser
                .addOp(Ops.EnterOp.create(ifBlock[0]))
                .enter(ifBlock)
                .addOp(Ops.IfOp.create(condition, Ops.EnterOp.create(successBlock[0]), null))
                .addOp(Ops.ExitOp.create(parser.cursor.blockId))
                .enter(successBlock);
        },
        run: null
    })
    .command({
        name: '_elif',
        compile: (parser) => (condition: string | Expression) => {
            parser
                .addOp(Ops.ExitOp.create(parser.cursor.blockId))
                .exit();

            var prevFailBlock = Ops.Block.create([]);
            var successBlock = Ops.Block.create([]);

            var prevIfOp = parser.cursor.prevOp;
            prevIfOp[3] = Ops.EnterOp.create(prevFailBlock[0]);

            parser
                .enter(prevFailBlock)
                .addOp(Ops.IfOp.create(condition, Ops.EnterOp.create(successBlock[0]), null))
                .addOp(Ops.ExitOp.create(parser.cursor.blockId))
                .enter(successBlock);
        },
        run: null
    })
    .command({
        name: '_else',
        compile: (parser) => () => {
            parser.commands['_elif'](true);
        },
        run: null
    })
    .command({
        name: '_endif',
        compile: (parser) => () => {
            parser.addOp(Ops.ExitOp.create(parser.cursor.blockId));
            while (parser.cursor.lastOp[0] === Ops.Type.EXIT_OP) {
                parser.exit();
            }
        },
        run: null
    })
    .command({
        name: 'loop',
        compile: (parser) => (count: number | string | Expression) => {
            if (typeof count === 'number') {
                count = count.toString();
            }

            var loopBlock = Ops.Block.create([]);
            parser
                .addOp(Ops.LoopOp.create(count, Ops.EnterOp.create(loopBlock[0])))
                .enter(loopBlock);
        },
        run: null
    })
    .command({
        name: 'endloop',
        compile: (parser) => () => {
            parser
                .addOp(Ops.ExitOp.create(parser.cursor.blockId))
                .exit();
        },
        run: null
    })
    .command({
        name: 'wait',
        compile: (parser) => (count: number | string | Expression) => {
            parser.commands['loop'](count);
            parser.addOp(Ops.SimpleOp.create('wait', []));
            parser.commands['endloop']();
        },
        run: (entity) => () => {
            entity.cycleEnded = true;
        }
    })
    .command({
        name: 'send',
        compile: (parser) => (scope: string | Scope, label: string, args?: any[]) => {
            var evalScope = typeof scope === 'string' ? new Scope(scope) : scope;
            var op = Ops.SimpleOp.create('send', [evalScope, label, args || []]);
            parser.addOp(op);
        },
        run: (entity) => (objects: Entity[], label: string, args: any[]) => {
            var evaluatedArgs = [];
            for (let arg of args) {
                evaluatedArgs.push(isEvaluable(arg) ? arg.evaluate(entity) : arg);
            }
            for (let obj of objects) {
                obj.gotoLabel(label, evaluatedArgs);
            }
        }
    })
    .command({
        name: 'jump',
        compile: (parser) => (labelName: string, args: any[]) => {
            var jumpOp = Ops.JumpOp.create(labelName, args);
            parser.addOp(jumpOp);
        },
        run: null
    })
    .command({
        name: 'adopt',
        compile: (parser) => parser.simpleCommand('adopt'),
        run: (entity) => (moduleName: string, initParams: {[key: string]: any}) => {
            var commandSet = entity.execContext.commands[moduleName];
            entity.adoptions.push(commandSet);

            var evaluatedParams = {};
            if (typeof initParams === 'object') {
                for (let key of Object.keys(initParams)) {
                    var initVal = initParams[key];
                    evaluatedParams[key] = isEvaluable(initVal) ? initVal.evaluate(entity) : initVal;
                }
            }

            commandSet.__init__(evaluatedParams);
        }
    })
    .command({
        name: 'join',
        compile: (parser) => parser.simpleCommand('join'),
        run: (entity) => (groupName: string) => {
            entity.board.addObjectToGroup(groupName, entity);
        }
    })
    .command({
        name: 'leave',
        compile: (parser) => parser.simpleCommand('leave'),
        run: (entity) => (groupName: string) => {
            entity.board.removeObjectFromGroup(groupName, entity);
        }
    })
    .command({
        name: 'set',
        compile: (parser) => parser.simpleCommand('set'),
        run: (entity) => (varName: string, value: any) => {
            if (varName in entity.execState.currentLabelFrame.variables) {
                entity.execState.currentLabelFrame.variables[varName] = value;
            } else {
                entity.variables[varName] = value;
            }
        }
    })
    .command({
        name: 'terminate',
        compile: (parser) => parser.simpleCommand('terminate'),
        run: (entity) => () => {
            entity.ended = true;
            entity.board.terminate();
        }
    })
    .command({
        name: 'print',
        compile: (parser) => parser.simpleCommand('print'),
        run: (entity) => (text: any) => {
            console.log(text);
            entity.cycleEnded = true;
        }
    })
    .command({
        name: 'lock',
        compile: (parser) => parser.simpleCommand('lock'),
        run: (entity) => () => {
            entity.locked = true;
        }
    })
    .command({
        name: 'unlock',
        compile: (parser) => parser.simpleCommand('unlock'),
        run: (entity) => () => {
            entity.locked = false;
        }
    })
    .command({
        name: 'zap',
        compile: (parser) => parser.simpleCommand('zap'),
        run: (entity) => (labelName: string) => {
            entity.execState.labelOffsets.disableCurrent(labelName);
        }
    })
    .command({
        name: 'restore',
        compile: (parser) => parser.simpleCommand('restore'),
        run: (entity) => (labelName: string) => {
            entity.execState.labelOffsets.enablePrevious(labelName);
        }
    })
    .command({
        name: 'spawn',
        compile: (parser) => parser.simpleCommand('spawn'),
        run: (entity) => (objName: string, initArgs: any[]) => {
            entity.board.spawnObject(objName, entity, initArgs);
        }
    })
    .command({
        name: 'spawn_tree',
        compile: (parser) => parser.simpleCommand('spawn_tree'),
        run: (entity) => (...args: SpawnNode[]) => {
            let spawn = (node: SpawnNode, parent: Entity) => {
                let newEntity = entity.board.spawnObject(node[0], parent, node[1]);
                for (let child of node[2]) {
                    spawn(child, newEntity);
                }
            }
            for (let node of args) {
                spawn(node, entity);
            }
        }
    })
    .command({
        name: 'die',
        compile: (parser) => parser.simpleCommand('die'),
        run: (entity) => () => {
            entity.board.removeObject(entity, true);
        }
    })
    .command({
        name: 'become',
        compile: (parser) => parser.simpleCommand('become'),
        run: (entity) => (objName: string, initArgs: any[]) => {
            entity.ended = true;
            entity.cycleEnded = true;
            entity.destroyAdoptions();
            entity.board.replaceObject(entity, objName, initArgs);
        }
    })
    .command({
        name: 'exec',
        compile: (parser) => parser.simpleCommand('exec'),
        run: (entity) => (func: Function) => {
            func(entity);
        }
    });

export let Default = {
    DefaultCommandSet: builder.build('')
};