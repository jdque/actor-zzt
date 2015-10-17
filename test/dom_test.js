var ZZT = require('src/zzt.js');
var DOM = require('src/modules/dom.js');

var board;

function run() {
    var HTMLParser = new ZZT.Parser();
    HTMLParser.registerModule('default', ZZT.DefaultCommandSet);
    HTMLParser.registerModule('html', DOM.DOMCommandSet);

    board = new ZZT.Board();

    board.configure({
        autoStep: false,
        parser: HTMLParser
    });

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
                send('[parent]', 'squawk')
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
}

function update() {
    board.step();
    requestAnimationFrame(update);
}

var App = {
    run: run
};

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = App;
}