import {ModuleBuilder} from '../../core/module';

let builder = new ModuleBuilder();

builder
    .command({
        name: '__init__',
        compile: null,
        run: (entity: any) => (params) => {
            if (params.element) {
                entity.element = params.element;
                entity.element.onclick = function () {
                    this.gotoLabel('@click')
                }.bind(entity);
            }
        }
    })
    .command({
        name: '__destroy__',
        compile: null,
        run: (entity: any) => () => {
            if (entity.element.parentNode) {
                entity.element.parentNode.removeChild(entity.element);
            }
            entity.element.onclick = null;
            entity.element = null;
        }
    })
    .command({
        name: 'exec',
        compile: (parser) => parser.simpleCommand('html.exec'),
        run: (entity: any) => (func: (element: HTMLElement) => any) => {
            if (entity.element) {
                func(entity.element);
            }
        }
    })
    .command({
        name: 'transistion',
        compile: (parser) => parser.simpleCommand('html.transition'),
        run: (entity: any) => (attr: string, val: any, settings: any) => {
            function onTransitionEnd() {
                entity.element.style.transition = "";
                entity.element.removeEventListener('transitionend', onTransitionEnd);
            }
            entity.element.addEventListener('transitionend', onTransitionEnd);
            entity.element.style.transition = attr + " " + settings;
            entity.element.style[attr] = val;
        }
    })

export let DOM = {
    DOMCommandSet: builder.build('html')
};