var ZZT = require('src/zzt.js');

var DOMCommandSet = {};

DOMCommandSet.parseCommands = function (parser, entity) {
    var html = {
        exec: parser._defaultParseFunc(entity.commands.html.exec),
    };

    return {
        html: html
    };
};

DOMCommandSet.runCommands = function (entity) {
    var html = {
        __init__: function (params) {
            entity.element = document.getElementById(params.id) || null;
            if (entity.element) {
                entity.element.onclick = function () { entity.gotoLabel('@click') }.fastBind(entity);
            }
        },

        __destroy__: function () {
            entity.element.onclick = null;
            entity.element = null;
        },

        exec: function (func) {
            if (entity.element) {
                func(entity.element);
            }
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