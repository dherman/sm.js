## sm.js

Run a SpiderMonkey shell as a [node](http://nodejs.org) child process.

## Usage

```javascript
var SM = require('sm');

var sm = new SM({ shell: "js" });

sm.eval('var x = 12; x * 3', function(err, result) {
    // got the result
});
sm.eval('throw 12', function(err, result) {
    // got the thrown exception
});
sm.check('delete for this', function(err, result) {
    // got the syntax error
});
sm.check('function asi() { return 12 }', function(err, result) {
    // syntax successfully checked
});
sm.parse('var x = 12; x * 3', function(err, result) {
    // got the parsed AST
});
sm.load('foo.js', function(err, result) {
    // got the result of evaluating the file
});
sm.parseFile('foo.js', function(err, result) {
    // got the result of parsing the file
});
sm.checkFile('foo.js', function(err, result) {
    // got the result of checking the syntax of the file
});
sm.close(); // request the end of session
sm.on('exit', function() {
    // the SpiderMonkey process exited
});
```

## Constructor

This module is a constructor with a single options object that recognizes one option:

  * `shell="js"` : the path to the SpiderMonkey shell

## Methods

The result of the constructor is an [EventEmitter](http://nodejs.org/api/events.html) object with the following methods:

  * `eval(src, callback)` : evaluates source with SpiderMonkey
  * `load(path, callback)` : evaluates source from a file with SpiderMonkey
  * `parse(src, callback)` : parses source with SpiderMonkey
  * `parseFile(path, callback)` : parses contents of a file with SpiderMonkey
  * `check(src, callback)` : checks source for valid syntax with SpiderMonkey
  * `checkFile(path, callback)` : checks source from a file for valid syntax with SpiderMonkey
  * `close` : sends a message requesting SpiderMonkey to close down after finishing all pending actions

Each method sends a buffered message to SpiderMonkey requesting that it evaluate the corresponding action.

Each callback takes an error object signifying that SpiderMonkey threw an exception or an error occurred communicating with SpiderMonkey, or `null` followed by a return value if the action returned normally.

## Events

  * `"message"` : received a response from the SpiderMonkey shell
  * `"exit"` : the SpiderMonkey shell has exited

## License

Copyright © 2012 Dave Herman

Licensed under the [MIT License](http://mit-license.org).
