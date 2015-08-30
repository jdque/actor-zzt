describe("Oop", function () {
	var Oop = require("../../src/zzt.js");
	var board;

	beforeAll(function () {
		window = global;
		(function () {
		    var oldLog = console.log;
		    console.history = [];
		    console.log = function (message) {
		        console.history.push(message);
		        oldLog.apply(console, arguments);
		    };
		})();
	});

	beforeEach(function () {
		console.history = [];
		board = new Oop.Board();
	});

	describe("Initialization and execution", function () {
		it("should spawn an object and terminate", function (done) {
			board.setup(function () {
				object('Player', function () {
					print('Hello world')
					terminate()
				});
			});
			board.run(function () {
				spawn('Player')
			});
			board.terminated(function () {
				expect(console.history.toString()).toEqual(['Hello world'].toString())
				done();
			});
		});

		it("should ignore trying to spawn a non-existent object", function (done) {
			board.setup(function () {
				object('Player', function () {
					print('Hello world')
					terminate()
				});
			});
			board.run(function () {
				spawn('Dummy1')
				spawn('Player')
				spawn('Dummy2')
			});
			board.terminated(function () {
				expect(console.history.toString()).toEqual(['Hello world'].toString())
				done();
			});
		});

		it("should fail if there are object definitions with identical names", function (done) {
			try {
				board.setup(function () {
					object('Player', function () {
						print('fail')
						terminate()
					});
					object('Player', function () {
						print('fail')
						terminate()
					});
				});
				board.run(function () {
					spawn('Player')
				});
				board.terminated(function () {
					done.fail();
				});
			}
			catch (e) {
				expect(e).toEqual("Duplicate object definition");
				done();
			}
		});
	});

	describe("Variables and expressions", function () {
		it("should set variables and evaluate expressions", function (done) {
			board.setup(function () {
				object('Player', function () {
					set('$var', 'a')
					print(expr('$var'))
					set('$var', 1)
					print(expr('$var'))
					set('$var', expr('$var + 1'))
					print(expr('$var'))
					set('$var', expr('1 === 1'))
					print(expr('$var'))
					set('$var', expr('(Math.cos(0) + 1) * parseFloat("0.75")'))
					print(expr('$var'))
					terminate()
				});
			});
			board.run(function () {
				spawn('Player')
			});
			board.terminated(function () {
				expect(console.history.toString()).toEqual(['a', 1, 2, true, 1.5].toString())
				done();
			});
		});
	});

	describe("Control flow", function () {
		it("should select the correct block in an if-else statement", function (done) {
			board.setup(function () {
				object('Player', function () {
					set('$var', 1)
					_if('$var === 1')
						print(1)
					_endif()

					_if('0 === 1')
						print(-1)
					_elif('$var === 1')
						print(2)
					_else()
						print(-1)
					_endif()

					_if('0 === 1')
						print(-1)
					_elif('$var === 2')
						print(-1)
					_else()
						print(3)
					_endif()

					terminate()
				});
			});
			board.run(function () {
				spawn('Player')
			});
			board.terminated(function () {
				expect(console.history.toString()).toEqual([1, 2, 3].toString())
				done();
			});
		});

		it("should loop a block a fixed number of times", function (done) {
			board.setup(function () {
				object('Player', function () {
					set('$var', 3)
					loop('$var')
						print(expr('$var'))
						set('$var', expr('$var - 1'))
					endloop()
					terminate()
				});
			});
			board.run(function () {
				spawn('Player')
			});
			board.terminated(function () {
				expect(console.history.toString()).toEqual([3, 2, 1].toString())
				done();
			});
		});

		it("should not run a loop if the count expression is non-numeric", function (done) {
			board.setup(function () {
				object('Player', function () {
					set('$var', 'a')
					loop('$var')
						print(expr('fail'))
					endloop()
					terminate()
				});
			});
			board.run(function () {
				spawn('Player')
			});
			board.terminated(function () {
				expect(console.history.toString()).not.toEqual(['fail'].toString())
				done();
			});
		});
	});

	describe("Labels", function () {
		it("should jump between labels", function (done) {
			board.setup(function () {
				object('Player', function () {
					jump('one')
					end()
					label('one')
						print(1)
						jump('two')
					end()
					label('two')
						print(2)
					terminate()
				});
			});
			board.run(function () {
				spawn('Player')
			});
			board.terminated(function () {
				expect(console.history.toString()).toEqual([1, 2].toString())
				done();
			});
		});

		it("should allow jumping to the current label", function (done) {
			board.setup(function () {
				object('Player', function () {
					set('$count', 1)
					jump('do')
					end()
					label('do')
						print(expr('$count'))
						_if('$count === 3')
							terminate()
						_endif()
						set('$count', expr('$count + 1'))
						jump('do')
					end()
				});
			});
			board.run(function () {
				spawn('Player')
			});
			board.terminated(function () {
				expect(console.history.toString()).toEqual([1, 2, 3].toString())
				done();
			});
		});

		/*it("should handle chained labels", function (done) {
			board.setup(function () {
				object('Player', function () {
					set('$var', 1)
					jump('one')
					end()
					label('one')
					label('two')
						_if('$var === 1')
							print(1)
							set('$var', 2)
							jump('two')
						_elif('$var === 2')
							print(2)
							terminate()
						_endif()
					end()
				});
			});
			board.run(function () {
				spawn('Player')
			});
			board.terminated(function () {
				expect(console.history.toString()).toEqual([1, 2].toString())
				done();
			});
		});*/

		it("should enable/disable labels with 'zap' and 'restore'", function (done) {
			board.setup(function () {
				object('Player', function () {
					set('$stop', false)
					jump('do')
					end()
					label('do')
						_if('$stop === true')
							print(3)
							terminate()
						_endif()
						print(1)
						zap('do')
						jump('do')
					end()
					label('do')
						print(2)
						set('$stop', true)
						restore('do')
						jump('do')
					end()
				});
			});
			board.run(function () {
				spawn('Player')
			});
			board.terminated(function () {
				expect(console.history.toString()).toEqual([1, 2, 3].toString())
				done();
			});
		});

		/*it("should ignore non-existent labels", function (done) {
			board.setup(function () {
				object('Player', function () {
					set('$stop', false)
					jump('none')
					print(1)
					jump('zap')
					end()
					label('zap')
						zap('zap')
						jump('zap')
						print(2)
						jump('restore')
					end()
					label('restore')
						wait(1)
						_if('$stop === true')
							print(3)
							terminate()
						_endif()
						restore('restore')
						set('$stop', true)
						jump('restore')
					end()
				});
			});
			board.run(function () {
				spawn('Player')
			});
			board.terminated(function () {
				expect(console.history.toString()).toEqual([1, 2, 3].toString())
				done();
			});
		});*/
	});

	describe("Object-object messaging", function () {
		it("should begin executing a label when sent from another object", function (done) {
			board.setup(function () {
				object('ObjectA', function () {
					end()
					label('do')
						print('A')
					end()
				});
				object('ObjectB', function () {
					print('B')
					send('ObjectA', 'do')
					wait(1)
					terminate()
				});
			});
			board.run(function () {
				spawn('ObjectA')
				spawn('ObjectA')
				spawn('ObjectB')
			});
			board.terminated(function () {
				expect(console.history.toString()).toEqual(['B', 'A', 'A'].toString())
				done();
			});
		});

		it("should ignore messages if an object is locked", function (done) {
			board.setup(function () {
				object('ObjectA', function () {
					end()
					label('do')
						print('A')
						lock()
						send('ObjectB', 'do2')
					end()
				});
				object('ObjectB', function () {
					print('B')
					send('ObjectA', 'do')
					end()
					label('do2')
						print('B2')
						send('ObjectA', 'do')
						wait(1)
					terminate()
				});
			});
			board.run(function () {
				spawn('ObjectA')
				spawn('ObjectB')
			});
			board.terminated(function () {
				expect(console.history.toString()).toEqual(['B', 'A', 'B2'].toString())
				done();
			});
		});
	});

	describe("Execution order", function () {

	});
});