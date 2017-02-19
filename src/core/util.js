Function.prototype.fastBind = function (context) {
    var self = this;
    var curriedArgs = Array.prototype.slice.call(arguments, 1);
    if (curriedArgs.length) {
        return function () {
            var allArgs = curriedArgs.slice(0);
            for (var i = 0, n = arguments.length; i < n; ++i) {
                allArgs.push(arguments[i]);
            }
            self.apply(context, allArgs);
        };
    }
    else {
        return function () {
            self.apply(context)
        }
    }
}

var Util = (function () {
    var currentId = 0;

    function generateId() {
        return currentId++;
    }

    function extend(destination, source) {
        for (var k in source) {
            if (source.hasOwnProperty(k)) {
                destination[k] = source[k];
            }
        }
        return destination;
    }

    return {
        generateId: generateId,
        extend: extend
    };
})();

module.exports = Util;