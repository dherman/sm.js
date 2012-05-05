## sm.js

Run a SpiderMonkey shell as a [node](http://nodejs.org) child process.

## Usage

```javascript
var sm = require('sm');

sm.evaluate('var x = 12; x * 3').on('return', function(result) {
    // got the result
});
sm.evaluate('throw 12').on('throw', function(e) {
    // got the thrown exception
});
sm.check('delete for this').on('throw', function(e) {
    // got the syntax error
});
sm.check('function asi() { return 12 }').on('return', function() {
    // syntax successfully checked
});
sm.parse('var x = 12; x * 3').on('return', function(ast) {
    // got the parsed AST
});
```

## Functions

All the functions provided by this module produce an [EventEmitter](http://nodejs.org/api/events.html) that supports the same set of events.

  * `evaluate(src[, shell="js"])` : evaluates source with SpiderMonkey
  * `evaluateFile(path[, shell="js"])` : evaluates a file with SpiderMonkey
  * `parse(src[, shell="js"])` : parses source with SpiderMonkey, producing an AST with the [Mozilla Parser API](https://developer.mozilla.org/en/SpiderMonkey/Parser_API)
  * `parseFile(path[, shell="js"])` : parses a file with SpiderMonkey
  * `check(src[, shell="js"])` : checks source for syntax errors with SpiderMonkey
  * `checkFile(path[, shell="js"])` : checks a file for syntax errors with SpiderMonkey

## Events

  * `"return"` : the result of a successful evaluation in SpiderMonkey, communicated via JSON
  * `"throw"` : the result of a thrown exception in SpiderMonkey, communicated via JSON
  * `"error"` : an I/O or spawning error occurred

## License

Copyright © 2012 Dave Herman

Licensed under the [MIT License](http://mit-license.org).
