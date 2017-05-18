import {isEvaluable, IEvaluable, DeferredFunction, Expression} from '../../core/evaluables';
import {Entity} from '../../core/environment';
import {ModuleBuilder} from '../../core/module';

interface InitParams {};

interface Data {
    downKeys: number[];
    handlers: {[key: string]: (e: Event) => any};
};

let builder = new ModuleBuilder();

builder
    .command({
        name: '__init__',
        compile: null,
        run: (entity, data: Data) => (params: InitParams) => {
            data.downKeys = [];
            data.handlers = {};

            data.handlers.keyDown = (e: KeyboardEvent) => {
                if (data.downKeys.indexOf(e.keyCode) === -1) {
                    data.downKeys.push(e.keyCode);
                }
                entity.gotoLabel('@input.key_down');
            };

            data.handlers.keyUp = (e: KeyboardEvent) => {
                var keyIdx = data.downKeys.indexOf(e.keyCode);
                if (keyIdx !== -1) {
                    data.downKeys[keyIdx] = data.downKeys[data.downKeys.length - 1];
                    data.downKeys.pop();
                }
                entity.gotoLabel('@input.key_up');
            };

            document.addEventListener('keydown', data.handlers.keyDown);
            document.addEventListener('keyup', data.handlers.keyUp);
        }
    })
    .command({
        name: '__destroy__',
        compile: null,
        run: (entity, data: Data) => () => {
            document.removeEventListener('keydown', data.handlers.keyDown);
            document.removeEventListener('keyup', data.handlers.keyUp);
        }
    })
    .command({
        name: 'key_down',
        compile: (parser) => (keyCode: number | IEvaluable<number>): IEvaluable<boolean> => {
            return new DeferredFunction((entity): boolean => {
                let evalKeyCode = isEvaluable(keyCode) ? keyCode.evaluate(entity) : keyCode;
                return entity.data('input').downKeys.indexOf(evalKeyCode) !== -1;
            });
        },
        run: null
    });

export let Input = {
    InputCommandSet: builder.build('input')
};