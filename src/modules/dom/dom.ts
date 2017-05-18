import {ModuleBuilder} from '../../core/module';

interface InitParams {
    element: HTMLElement;
};

interface Data {
    element: HTMLElement;
};

let builder = new ModuleBuilder();

builder
    .command({
        name: '__init__',
        compile: null,
        run: (entity, data: Data) => (params: InitParams) => {
            if (params.element) {
                data.element = params.element;
                data.element.onclick = function () {
                    this.gotoLabel('@click')
                }.bind(entity);
            }
        }
    })
    .command({
        name: '__destroy__',
        compile: null,
        run: (entity, data: Data) => () => {
            if (data.element.parentNode) {
                data.element.parentNode.removeChild(data.element);
            }
            data.element.onclick = null;
            data.element = null;
        }
    })
    .command({
        name: 'exec',
        compile: (parser) => parser.simpleCommand('html.exec'),
        run: (entity, data: Data) => (func: (element: HTMLElement) => any) => {
            if (data.element) {
                func(data.element);
            }
        }
    })
    .command({
        name: 'transistion',
        compile: (parser) => parser.simpleCommand('html.transition'),
        run: (entity, data: Data) => (attr: string, val: any, settings: any) => {
            function onTransitionEnd() {
                data.element.style.transition = "";
                data.element.removeEventListener('transitionend', onTransitionEnd);
            }
            data.element.addEventListener('transitionend', onTransitionEnd);
            data.element.style.transition = attr + " " + settings;
            data.element.style[attr] = val;
        }
    })

export let DOM = {
    DOMCommandSet: builder.build('html')
};