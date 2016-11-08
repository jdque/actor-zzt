var Evaluables = require('./core/evaluables.js');
var Environment = require('./core/environment.js');
var DefaultCommandSet = require('./core/default_commands.js');
var Parser = require('./core/parser.js');
var Blocks = require('./core/blocks.js');

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        World: Environment.World,
        Board: Environment.Board,
        Parser: Parser,
        Evaluable: Evaluables.Evaluable,
        Blocks: Blocks,
        DeferredFunction: Evaluables.DeferredFunction,
        DefaultCommandSet: DefaultCommandSet
    };
}