var ZZT = require('../zzt.js');

var DOMCommandSet = {};

DOMCommandSet.parseCommands = function (parser, entity) {
    var html = {
        exec: parser._defaultParseFunc(entity.commands.html.exec),
        transition: parser._defaultParseFunc(entity.commands.html.transition)
    };

    return {
        html: html
    };
};

DOMCommandSet.runCommands = function (entity) {
    var html = {
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
    };

    return {
        html: html
    };
};

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        DOMCommandSet: DOMCommandSet
    };
}