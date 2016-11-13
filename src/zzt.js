var Evaluables = require('./core/evaluables.js');
var Environment = require('./core/environment.js');
var Parser = require('./core/parser.js');
var Blocks = require('./core/blocks.js');
var Ops = require('./core/ops.js');
var DefaultCommandSet = require('./modules/default.js');

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        World: Environment.World,
        Board: Environment.Board,
        Parser: Parser,
        Evaluable: Evaluables.Evaluable,
        Ops: Ops,
        DeferredFunction: Evaluables.DeferredFunction,
        DefaultCommandSet: DefaultCommandSet
    };
}