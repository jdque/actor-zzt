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
			board.finish(function () {
				expect(console.history.toString()).toEqual(['Hello world'].toString())
				done();
			});
			board.execute();
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
			board.finish(function () {
				expect(console.history.toString()).toEqual(['Hello world'].toString())
				done();
			});
			board.execute();
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
				board.finish(function () {
					done.fail();
				});
				board.execute();
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
			board.finish(function () {
				expect(console.history.toString()).toEqual(['a', 1, 2, true, 1.5].toString())
				done();
			});
			board.execute();
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
			board.finish(function () {
				expect(console.history.toString()).toEqual([1, 2, 3].toString())
				done();
			});
			board.execute();
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
			board.finish(function () {
				expect(console.history.toString()).toEqual([3, 2, 1].toString())
				done();
			});
			board.execute();
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
			board.finish(function () {
				expect(console.history.toString()).not.toEqual(['fail'].toString())
				done();
			});
			board.execute();
		});

		it("should allow nested blocks", function (done) {
			board.setup(function () {
				object('Player', function () {
					set('$var', 0)
					loop(2)
						loop(2)
							_if('$var % 2 === 0')
								_if('true')
									print('a')
								_endif()
							_else()
								print('b')
							_endif()
							set('$var', expr('$var + 1'))
						endloop()
					endloop()
					terminate()
				});
			});
			board.run(function () {
				spawn('Player')
			});
			board.finish(function () {
				expect(console.history.toString()).toEqual(['a', 'b', 'a', 'b'].toString())
				done();
			});
			board.execute();
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
			board.finish(function () {
				expect(console.history.toString()).toEqual([1, 2].toString())
				done();
			});
			board.execute();
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
			board.finish(function () {
				expect(console.history.toString()).toEqual([1, 2, 3].toString())
				done();
			});
			board.execute();
		});

		it("should handle chained labels", function (done) {
			board.setup(function () {
				object('Player', function () {
					set('$var', 1)
					jump('one')
					end()
					label('one')
						print('a')
					label('two')
						_if('$var === 1')
							print(1)
							set('$var', 2)
							jump('two')
						_elif('$var === 2')
							print(2)
							terminate()
						_endif()
					label('three')
					end()
				});
			});
			board.run(function () {
				spawn('Player')
			});
			board.finish(function () {
				expect(console.history.toString()).toEqual(['a', 1, 2].toString())
				done();
			});
			board.execute();
		});

		it("should handle chained labels with zapping", function (done) {
			board.setup(function () {
				object('Player', function () {
					set('$var', 1)
					jump('label')
					end()
					label('label')
					label('label')
					label('label')
						print(expr('$var'))
						set('$var', expr('$var + 1'))
						zap('label')
						jump('label')
					end()
					label('label')
						print('done')
					terminate()
				});
			});
			board.run(function () {
				spawn('Player')
			});
			board.finish(function () {
				expect(console.history.toString()).toEqual([1, 2, 3, 'done'].toString())
				done();
			});
			board.execute();
		});

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
			board.finish(function () {
				expect(console.history.toString()).toEqual([1, 2, 3].toString())
				done();
			});
			board.execute();
		});

		it("should ignore non-existent labels", function (done) {
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
			board.finish(function () {
				expect(console.history.toString()).toEqual([1, 2, 3].toString())
				done();
			});
			board.execute();
		});
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
					terminate()
				});
			});
			board.run(function () {
				spawn('ObjectA')
				spawn('ObjectA')
				spawn('ObjectB')
			});
			board.finish(function () {
				expect(console.history.toString()).toEqual(['B', 'A', 'A'].toString())
				done();
			});
			board.execute();
		});

		it("should ignore messages if an object is locked", function (done) {
			board.setup(function () {
				object('ObjectA', function () {
					end()
					label('do')
						print('A')
						lock()
						send('[self].[parent].ObjectB', 'do2')
					end()
				});
				object('ObjectB', function () {
					print('B')
					send('[self].[parent].ObjectA', 'do')
					end()
					label('do2')
						print('B2')
						send('[self].[parent].ObjectA', 'do')
					terminate()
				});
			});
			board.run(function () {
				spawn('ObjectA')
				spawn('ObjectB')
			});
			board.finish(function () {
				expect(console.history.toString()).toEqual(['B', 'A', 'B2'].toString())
				done();
			});
			board.execute();
		});
	});

	describe("Entity tree", function () {
		it("should spawn nested (child) entities", function (done) {
			board.setup(function () {
				object('Parent', function () {
					spawn('Child')
					send('[self].Child', 'do')
					end()
					label('done')
						print('B')
					terminate()
				});
				object('Child', function () {
					end()
					label('do')
						spawn('Zygote')
						send('[self].Zygote', 'do2')
					end()
				});
				object('Zygote', function () {
					end()
					label('do2')
						spawn('Zygote')
						send('[self].Zygote', 'do3')
					end()
					label('do3')
						print('A')
						send('[parent].[parent].[parent]', 'done')
					end()
				});
			});
			board.run(function () {
				spawn('Parent')
			});
			board.finish(function () {
				expect(console.history.toString()).toEqual(['A', 'B'].toString())
				done();
			});
			board.execute();
		});

		it("should resolve complex scopes to 0..N entities", function (done) {
			board.setup(function () {
				//A
				//  AA
				//  AA
				//  AB
				//    ABB
				//B
				//  BA
				object('A', function () {
					spawn('AA')
					spawn('AA')
					spawn('AB')
					end()
					label('A_do')
						print('A')
					end()
				});
				object('AA', function () {
					end()
					label('AA_do')
						print('AA')
					end()
				});
				object('AB', function () {
					spawn('ABA')
					end()
					label('AB_do')
						print('AB')
					end()
				});
				object('ABA', function () {
					end()
					label('ABA_do')
						print('ABA')
					end()
				});
				object('B', function () {
					spawn('BA')
					end()
					label('B_do')
						print('B')
					end()
				});
				object('BA', function () {
					wait(1)
					send('$.*.AA.<', 'A_do')		//All board entities that have AA as a child
					send('<.<.<.<.<.*', 'B_do')		//Board's parent should scope to itself
					send('<.BA.<.<.B', 'B_do')		//Self-scoping
					send('<.<.A.*', 'AA_do')		//Send to all instances for a name scope
					send('<.<.A.AB.ABA', 'ABA_do')	//Chained name scopes
					terminate()
				});
			});
			board.run(function () {
				spawn('A')
				spawn('B')
			});
			board.finish(function () {
				expect(console.history.toString()).toEqual(['A', 'B', 'B', 'AA', 'AA', 'ABA'].toString())
				done();
			});
			board.execute();
		});
	});
});