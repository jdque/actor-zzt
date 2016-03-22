var Evaluables = require('./core/evaluables.js');
var Environment = require('./core/environment.js');
var DefaultCommandSet = require('./core/default_module.js');
var Parser = require('./core/parser.js');

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        World: Environment.World,
        Board: Environment.Board,
        Parser: Parser,
        Evaluable: Evaluables.Evaluable,
        DeferredFunction: Evaluables.DeferredFunction,
        DefaultCommandSet: DefaultCommandSet
    };
}