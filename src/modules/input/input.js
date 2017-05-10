var Evaluables = require('../core/evaluables.js');

function parseCommands(parser) { return {
    key_down: function (keyCode) {
        return new Evaluables.DeferredFunction(function (entity) {
            var _keyCode = keyCode instanceof Evaluables.Evaluable ? keyCode.evaluate() : keyCode;
            return entity.input.downKeys.indexOf(_keyCode) !== -1;
        });
    }
}};

function runCommands(entity) { return {
    __init__: function (params) {
        entity.input = {
            downKeys: [],
            handlers: {}
        };

        entity.input.handlers.keyDown = function (e) {
            if (entity.input.downKeys.indexOf(e.keyCode) === -1) {
                entity.input.downKeys.push(e.keyCode);
            }
            entity.gotoLabel('@input.key_down');
        };

        entity.input.handlers.keyUp = function (e) {
            var keyIdx = entity.input.downKeys.indexOf(e.keyCode);
            if (keyIdx !== -1) {
                entity.input.downKeys[keyIdx] = entity.input.downKeys[entity.input.downKeys.length - 1];
                entity.input.downKeys.pop();
            }
            entity.gotoLabel('@input.key_up');
        };

        document.addEventListener('keydown', entity.input.handlers.keyDown);
        document.addEventListener('keyup', entity.input.handlers.keyUp);
    },

    __destroy__: function () {
        document.removeEventListener('keydown', entity.input.handlers.keyDown);
        document.removeEventListener('keyup', entity.input.handlers.keyUp);
        entity.input = null;
    }
}};

var InputCommandSet = {
    parseCommands: parseCommands,
    runCommands: runCommands,
    defaultName: 'input'
};

module.exports = {
    InputCommandSet: InputCommandSet
};