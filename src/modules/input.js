var ZZT = require('../zzt.js');

var InputCommandSet = {};

InputCommandSet.parseCommands = function (parser) {
    var input = {
        key_down: function (keyCode) {
            return new ZZT.DeferredFunction(function (entity) {
                var _keyCode = keyCode instanceof ZZT.Evaluable ? keyCode.evaluate() : keyCode;
                return entity.input.downKeys.indexOf(_keyCode) !== -1;
            });
        }
    };

    return {
        input: input
    };
};

InputCommandSet.runCommands = function (entity) {
    var input = {
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
        },
    };

    return {
        input: input
    };
};

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        InputCommandSet: InputCommandSet
    };
}