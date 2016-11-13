var ZZT = require('../zzt.js');

function parseCommands(parser) { return {
    exec:       parser._defaultParseFunc('html.exec'),
    transition: parser._defaultParseFunc('html.transition')
}};

function runCommands(entity) { return {
    __init__: function (params) {
        if (params.element) {
            entity.element = params.element;
            entity.element.onclick = function () {
                this.gotoLabel('@click')
            }.fastBind(entity);
        }
    },

    __destroy__: function () {
        if (entity.element.parentNode) {
            entity.element.parentNode.removeChild(entity.element);
        }
        entity.element.onclick = null;
        entity.element = null;
    },

    exec: function (func) {
        if (entity.element) {
            func(entity.element);
        }
    },

    transition: function (attr, val, settings) {
        function onTransitionEnd() {
            entity.element.style.transition = "";
            entity.element.removeEventListener('transitionend', onTransitionEnd);
        }
        entity.element.addEventListener('transitionend', onTransitionEnd);
        entity.element.style.transition = attr + " " + settings;
        entity.element.style[attr] = val;
    }
}};

var DOMCommandSet = {
    parseCommands: parseCommands,
    runCommands: runCommands,
    defaultName: 'html'
};

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        DOMCommandSet: DOMCommandSet
    };
}