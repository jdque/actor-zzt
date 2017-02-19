var board;

function run() {
    var HTMLParser = new Char.Parser();
    HTMLParser.registerModule(Char.Default.DefaultCommandSet);
    HTMLParser.registerModule(Char.DOM.DOMCommandSet);

    board = new Char.Board();

    board.configure({
        autoStep: false,
        parser: HTMLParser
    });

    board.setup(function () {
        object('about', function () {
            adopt('html', {element: document.getElementById('dom_about')})
            end()

            label('@click')
                send('content', 'showabout')
            end()
        });

        object('pictures', function () {
            adopt('html', {element: document.getElementById('dom_pictures')})
            end()

            label('@click')
                send('content', 'showpictures')
            end()
        });

        object('content', function () {
            adopt('html', {element: document.getElementById('dom_content')})
            end()

            label('showabout')
                html.exec(function (elem) {
                    elem.innerHTML = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus et tincidunt erat. Morbi mollis, felis non sollicitudin laoreet, diam urna tincidunt nunc, id blandit purus enim at neque. Mauris nec leo a urna fermentum efficitur. Aenean scelerisque nulla egestas neque dignissim, ut pellentesque lectus lobortis. Donec ut odio ac augue ornare dictum ac ut sem. Donec eu justo at mauris dictum ullamcorper. Aliquam erat volutpat. Suspendisse eleifend laoreet odio, a interdum elit mollis nec. Vivamus id erat ante. Vivamus sagittis, dui ut molestie viverra, justo erat varius orci, et consectetur ipsum mi id ligula.";
                })
            end()

            label('showpictures')
                send('[self].[all]', 'die')
                html.exec(function (elem) {
                    elem.innerHTML = "Here is an image<br /><br />";
                })
                spawn('button')
            end()

            label('create_image')
                spawn('image')
            end()

            label('squawk')
                html.exec(function (elem) {
                    elem.insertAdjacentHTML('beforeend', '<div>squawk!</div>');
                })
            end()
        });

        object('button', function () {
            adopt('html', {element: val(function () {
                var button = document.createElement('button');
                button.innerText = "Create Image";
                button.style.display = "block";
                document.getElementById('dom_content').appendChild(button);
                return button;
            })})
            end()

            label('@click')
                send('[parent]', 'create_image')
            end()

            label('die')
                die()
            end()
        })

        object('image', function () {
            adopt('html', {element: val(function () {
                //create image element
                var image = document.createElement('img');
                image.src = "assets/penguins.jpg";
                image.width = 320;
                image.height = 0;
                image.style.display = "block";
                document.getElementById('dom_content').appendChild(image);
                return image;
            })})
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
                send('[parent]', 'squawk')
            end()

            label('die')
                die()
            end()
        });
    });

    board.run(function () {
        spawn('about')
        spawn('pictures')
        spawn('content')
    });

    board.start();

    requestAnimationFrame(update);
}

function update() {
    board.step();
    requestAnimationFrame(update);
}

window.onload = function () {
    run();
}