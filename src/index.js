var Environment = require('./core/environment.js');
var Parser = require('./core/parser.js');
var Default = require('./modules/default.js');
var Graphics = require('./modules/graphics.js');
var Physics = require('./modules/physics.js');
var Input = require('./modules/input.js');
var DOM = require('./modules/dom.js');

module.exports = {
    World: Environment.World,
    Board: Environment.Board,
    Parser: Parser,
    Default: Default,
    Graphics: Graphics,
    Physics: Physics,
    Input: Input,
    DOM: DOM
};