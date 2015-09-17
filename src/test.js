var board = new Board();

/*board.setup(function (object) {
    object('player', function (expr, label, end, terminate, _if, _elif, _else, _endif, loop, endloop, print, jump, send, set, wait, lock, unlock, zap, restore, spawn, die, element) {
        //eval('var label = this.label.bind(this);');
        jump('do')
        end()
        label('do')
            set('$a', 3)
            set('$b', 7)
            _if('$a + $b === 10')
                print('it computes!')
            _endif()
            print('1')
            wait(2)
            send('enemy', 'something')
            print('3')
            send('enemy', 'something2')
        end()
        label('do2')
            print('777')
        terminate()
    });

    object('enemy', function (expr, label, end, terminate, _if, _elif, _else, _endif, loop, endloop, print, jump, send, set, wait, lock, unlock, zap, restore, spawn, die, element) {
        print('b1')
        print('b2')
        print('b3')
        print('b4')
        print('b5')
        print('b6')
        end()
        label('something')
            lock()
            print('2')
            wait(3)
            send('player', 'do2')
            unlock()
        end()
        label('something2')
            print('interrupted')
        terminate()
    });
});

board.run(function (spawn) {
    spawn('player')
    spawn('enemy')
});*/

/*board.setup(function (object) {
    object('player', function (expr, label, end, terminate, _if, _elif, _else, _endif, loop, endloop, print, jump, send, set, wait, lock, unlock, zap, restore, spawn, die, element) {
        set('$z', 2)
        jump('start')
        end()
        label('start')
            set('$a', 2)
            set('$b', expr('$a + 5'))
            _if('$a + $b === 9')
                print(expr('"Condition evaluated to: " + ($a + $b)'))
            _endif()
            _if('2 < 1')
                print('1')
            _elif('4 < 1')
                print('2')
            _elif('5 < 3')
                print('3')
            _else()
                print('4')
            _endif()
            loop('$z')
                print("HELLO")
                loop(4)
                    print("WORLD")
                endloop()
            endloop()
            zap('start')
            jump('start')
        end()
        label('start')
            print('zapped')
            _if('!$stop')
                zap('start')
                jump('start')
            _endif()
        end()
        label('start')
            set('$stop', true)
            print('zapped again')
            restore('start')
            jump('start')
        end()
    })
});

board.run(function (spawn) {
    spawn('player')
});*/

/*board.setup(function (object) {
    object('player', function (expr, label, end, terminate, _if, _elif, _else, _endif, loop, endloop, print, jump, send, set, wait, lock, unlock, zap, restore, spawn, die, element) {
        jump('start')
        end()
        label('start')
            loop(4)
                spawn('clone')
            endloop()
            send('clone', 'create')
            wait(1)
            send('clone', 'create')
            wait(1)
            send('clone', 'do')
            wait(3)
            send('clone', 'do')
        end()
    });

    object('clone', function (expr, label, end, terminate, _if, _elif, _else, _endif, loop, endloop, print, jump, send, set, wait, lock, unlock, zap, restore, spawn, die, element) {
        end()
        label('create')
            spawn('clone')
        end()
        label('do')
            print('Following orders')
            print('and yet again')
            die()
        end()
    });
});

board.run(function (spawn) {
    spawn('player')
});*/

board.setup(function () {
    object('about', function () {
        adopt('html', {id: 'dom_about'})
        end()
        
        label('@click')
            send('content', 'showabout')
        end()
    });

    object('pictures', function () {
        adopt('html', {id: 'dom_pictures'})
        end()
        
        label('@click')
            send('content', 'showpictures')
        end()
    });

    object('content', function () {
        adopt('html', {id: 'dom_content'})
        end()
        
        label('showabout')
            html.exec(function (elem) {
                elem.innerHTML = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus et tincidunt erat. Morbi mollis, felis non sollicitudin laoreet, diam urna tincidunt nunc, id blandit purus enim at neque. Mauris nec leo a urna fermentum efficitur. Aenean scelerisque nulla egestas neque dignissim, ut pellentesque lectus lobortis. Donec ut odio ac augue ornare dictum ac ut sem. Donec eu justo at mauris dictum ullamcorper. Aliquam erat volutpat. Suspendisse eleifend laoreet odio, a interdum elit mollis nec. Vivamus id erat ante. Vivamus sagittis, dui ut molestie viverra, justo erat varius orci, et consectetur ipsum mi id ligula.";
            })
        end()

        label('showpictures')
            html.exec(function (elem) {
                elem.innerHTML = "Here is an image<br /><br />";
                //create image element
                var image = document.createElement('img');
                image.id = "dom_image";
                image.src = "assets/penguins.jpg";
                image.width = 320;
                image.height = 0;
                elem.appendChild(image);
            })
            spawn('image')
        end()

        label('squawk')
            html.exec(function (elem) {
                elem.innerHTML += "<br /><br />squawk!";
            })
        end()
    });

    object('image', function () {
        adopt('html', {id: 'dom_image'})
        jump('animate')
        end()
        
        label('animate')
            wait(2)
            html.exec(function (elem) { elem.height = 40; })
            wait(2)
            html.exec(function (elem) { elem.height = 80; })
            wait(2)
            html.exec(function (elem) { elem.height = 120; })
            wait(2)
            html.exec(function (elem) { elem.height = 160; })
            wait(2)
            html.exec(function (elem) { elem.height = 200; })
            wait(2)
            html.exec(function (elem) { elem.height = 240; })
            wait(4)
            send('content', 'squawk')
            die()
        end()
    });
});

board.run(function () {
    spawn('about')
    spawn('pictures')
    spawn('content')
});

board.execute();

requestAnimationFrame(update);

function update() {
    board.step();
    requestAnimationFrame(update);
}