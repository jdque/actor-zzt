import {isEvaluable, IEvaluable, DeferredFunction, Expression} from '../../core/evaluables';
import {Entity} from '../../core/environment';
import {ModuleBuilder} from '../../core/module';

interface IInitParams {};

let builder = new ModuleBuilder();

builder
    .command({
        name: '__init__',
        compile: null,
        run: (entity: any) => (params: IInitParams) => {
            entity.input = {
                downKeys: [],
                handlers: {}
            };

            entity.input.handlers.keyDown = (e: KeyboardEvent) => {
                if (entity.input.downKeys.indexOf(e.keyCode) === -1) {
                    entity.input.downKeys.push(e.keyCode);
                }
                entity.gotoLabel('@input.key_down');
            };

            entity.input.handlers.keyUp = (e: KeyboardEvent) => {
                var keyIdx = entity.input.downKeys.indexOf(e.keyCode);
                if (keyIdx !== -1) {
                    entity.input.downKeys[keyIdx] = entity.input.downKeys[entity.input.downKeys.length - 1];
                    entity.input.downKeys.pop();
                }
                entity.gotoLabel('@input.key_up');
            };

            document.addEventListener('keydown', entity.input.handlers.keyDown);
            document.addEventListener('keyup', entity.input.handlers.keyUp);
        }
    })
    .command({
        name: '__destroy__',
        compile: null,
        run: (entity: any) => () => {
            document.removeEventListener('keydown', entity.input.handlers.keyDown);
            document.removeEventListener('keyup', entity.input.handlers.keyUp);
            entity.input = null;
        }
    })
    .command({
        name: 'key_down',
        compile: (parser) => (keyCode: number | IEvaluable<number>): IEvaluable<boolean> => {
            return new DeferredFunction((entity: any): boolean => {
                let evalKeyCode = isEvaluable(keyCode) ? keyCode.evaluate(entity) : keyCode;
                return entity.input.downKeys.indexOf(evalKeyCode) !== -1;
            });
        },
        run: null
    });

export let Input = {
    InputCommandSet: builder.build('input')
};