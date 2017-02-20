# Char

Char is a Javascript actor model implementation for the browser. Use this library for game scripting, agent-based simulations, or any other application that needs concurrency.

Inspired by [ZZT-OOP](https://en.wikipedia.org/wiki/ZZT-oop).

## Features

* **Embedded scripting language** - Actors are programmed with Char's built-in language, which is parsed and compiled at runtime. Scripts are compiled into a JSON serializable "bytcode", which will eventually allow loading/saving of the complete program state. Modules can be created to extend the language and wrap external Javascript libraries.

* **Multitasking** - Actor scripts are coroutine-like, and so they can be suspended and resumed at will. Any command can be configured to yield execution of the actor. This makes it easy to program sequential behavior over time.

* **Hierarchal actor structure** - All actors live in a World. A World contains Boards, which are the base containers for actor instances. Actors can create and manage child actors. Actors communicate by sending messages composed of a target (parent, children, siblings, etc), label name (eg. mailbox), and data.

## Usage

##### Setup
```javascript
var world = new Char.World();
var board = new Char.Board();

board.setup(() => {
    object('Person', () => {
        label('init')
            jump('give_treats')
        end()

        label('give_treats')
            loop(5)
                send('Dog', 'receive_treat')
                wait(1)
            endloop()
        end()
    })

    object('Dog', () => {
        label('init')
            set('num_eaten', 0)
        end()

        label('receive_treat')
            _if('$num_eaten < 3')
                set('num_eaten', expr('$num_eaten + 1'))
                print("Yum")
            _else()
                print("No thanks")
            _endif()
        end()
    })
});


board.run(() => {
    label('init')
        spawn('Dog')
        spawn('Person')
    end()
});

world.addBoard("Default", board);
world.startBoard("Default");
```

##### Output
```
> Yum
> Yum
> Yum
> No thanks
> No thanks
```
## Command Reference (WIP)

##### label(name: string)
&nbsp;&nbsp;Defines a labeled script block. Actors can only be in one label at any given time. The built-in "init" label always gets executed once when an actor is first spawned.
##### end()
&nbsp;&nbsp;Closes a labeled script block
##### _if(expression: string)
&nbsp;&nbsp;Starts a conditional block. Its inner block will only execute if the expression evaluates to true
##### _elif(expression: string)
&nbsp;&nbsp;Branch of a conditional block
##### _else()
&nbsp;&nbsp;Branch of a conditional block
##### _endif()
&nbsp;&nbsp;Closes a conditional block
##### loop(count: number)
&nbsp;&nbsp;Starts a loop block. The inner block will repeatedly execute the given number of times
##### endloop()
&nbsp;&nbsp;Closes a loop block
##### set(variable: string, value: any)
&nbsp;&nbsp;Defines/assigns a variable in the actor's local memory
##### get(variable: string)
&nbsp;&nbsp;Gets the value of a variable in the actor's local memory
##### $(variable: string)
&nbsp;&nbsp;Alias for the get() command
##### val(function: function)
&nbsp;&nbsp;Executes the given function and reflects its return value
##### expr(expression: string)
&nbsp;&nbsp;Executes the string as a Javascript expression and reflects its value. Any substring prefixed with '$' will evaluate to the value of the matching actor variable.
##### jump(label: string, arguments: array)
&nbsp;&nbsp;Immediately moves the actor's execution to the given label block
##### send(scope: string, label: string, arguments: array)
&nbsp;&nbsp;Tells the actor(s) in the given scope to jump to the given label block
##### lock()
&nbsp;&nbsp;Prevents the actor from receiving any message sent to it
##### unlock()
&nbsp;&nbsp;Allows the actor to receive messages again if it was locked
##### spawn(actor: string, arguments: array)
&nbsp;&nbsp;Instantiates a new instance of an actor as a child
##### die()
&nbsp;&nbsp;Destroys the actor along with its children
##### become(actor: string, arguments: string)
&nbsp;&nbsp;Replaces the actor with a new instance of the given actor. Similar to a die() and subsequence spawn()
##### terminate()
&nbsp;&nbsp;Destroys all actors in the world and halts execution
##### adopt(module: string, data: object)
&nbsp;&nbsp;Extends the actor's capabilities with a module
##### print(message: string)
&nbsp;&nbsp;Print the given message to the console
##### wait(count: number)
&nbsp;&nbsp;Pauses execution of the actor for the given number of cycles