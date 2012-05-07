var cp = require("child_process");
var fs = require('fs');

var EventEmitter = require('events').EventEmitter;

// FIXME: later steps
// - hijack printErr to print to stdout while running user code:
//
//       let (old = printErr) { printErr = ...; try { (1,eval(userCode)) } finally { printErr = old } }
// - come up with a more ironclad separator

var SEPARATOR = "<<<---SPIDERMONKEY-NODE-BRIDGE--->>>";

function SM(opts) {
    EventEmitter.call(this);

    opts = opts || {};

    // Create the child process.
    this._proc = cp.spawn(opts.shell || "js", ["-i"]);
    this._proc.stderr.setEncoding("utf8");
    this._proc.stderr.on("data", this._data.bind(this));
    this._proc.on("error", this._exit.bind(this));
    this._proc.on("exit", this._exit.bind(this));

    // is the child process still alive?
    this._alive = true;
    // callbacks waiting in turn for messages
    this._waiters = [];
    // buffered data from the child process's stderr
    this._buffer = [];
    // index into last buffer chunk of potential SEPARATOR
    this._separatorFragment = -1;
}

SM.prototype = Object.create(EventEmitter.prototype);

// Internal methods

// FIXME: I'm assuming SEPARATOR.length is always smaller than the chunk size (i.e., can't be split across more than two chunks)

SM.prototype._data = function _data(str) {
    var i = this._separatorFragment;
    var n = SEPARATOR.length;
    var buf = this._buffer;

    // Found the separator spread across the previous chunk and the new chunk?
    if (i > -1 && endsWith(SEPARATOR, str.substring(0, n - i))) {
        var m = buf.length;
        var last = buf[m - 1];

        // Remove the separator fragment.
        buf[m - 1] = last.substring(last.length - i);

        // Receive the buffered message.
        this._respond(buf.join(""));
        buf.length = 0;

        // Reduce the current chunk to the remainder.
        str = str.substring(n - i);
    }

    // Look for complete messages.
    var msgs = str.split(SEPARATOR);

    // At least one separator was found.
    if (msgs.length > 1) {

        //        buf                       msgs
        // +---+---+---+---+   +---+---+---+---+---+---+---+
        // |   |   |   |   |   |   |   |   |   |   |   |   |
        // +---+---+---+---+   +---+---+---+---+---+---+---+
        //  \---------------------/ \-/ \-/ \-/ \-/ \-/ \-------....
        //          message         msg msg msg msg msg    message

        // Reduce the current chunk to the remainder.
        str = msgs.pop();

        // Receive the buffered message.
        buf.push(msgs[0]);
        this._respond(buf.join(""));
        buf.length = 0;

        // Receive the additional messages.
        for (var j = 1, m = msgs.length; j < m; j++)
            this._respond(msgs[j]);
    }

    // Buffer the remaining bits of the current chunk.
    buf.push(str);

    // Look for the possible start of a new separator.
    this._separatorFragment = indexOfSubstring(str, SEPARATOR);
};

SM.prototype._exit = function _exit() {
    this._alive = false;
    this.emit("exit");
};

SM.prototype._send = function _send(src, callback) {
    var waiters = this._waiters;
    waiters.push(callback);

    if (!this._alive) {
        for (var i = 0, n = waiters.length; i < n; i++) {
            waiters[i].call(this, new Error("process exited"));
        }
        waiters.length = 0;
        return;
    }

    this._proc.stdin.write(src);
    this._proc.stdin.write("printErr(" + JSON.stringify(SEPARATOR) + ");\n");
};

SM.prototype._respond = function _respond(output) {
    var msgs = output.split(SEPARATOR).map(JSON.parse);
    var n = msgs.length;
    var waiters = this._waiters.splice(0, n);
    for (var i = 0; i < n; i++) {
        var msg = msgs[i];

        switch (msg.type) {
          case "exit":
            this._exit(msg.exitCode);
            return;

          case "return":
            waiters[i].call(this, null, msg.value);
            break;

          case "throw":
            waiters[i].call(this, msg.value);
            break;
        }
    }
};

// Public methods

SM.prototype.close = function close() {
    this._proc.stdin.end("printErr(" +
                         JSON.stringify('{ "type" : "exit", "exitCode" : 0 }') +
                         ");\nprintErr(" +
                         JSON.stringify(SEPARATOR) +
                         ");\n");
};

SM.prototype.parse = function parse(src, callback) {
    this._send(parseIPC(src), callback);
};

SM.prototype.parseFile = function parseFile(path, callback) {
    this._send(parseFileIPC(path), callback);
};

SM.prototype.check = function check(src, callback) {
    this._send(checkIPC(src), callback);
};

SM.prototype.checkFile = function checkFile(path, callback) {
    this._send(checkFileIPC(path), callback);
};

SM.prototype.eval = function eval_(src, callback) {
    this._send(evalIPC(src), callback);
};

SM.prototype.load = function evaluateFile(path, callback) {
    this._send(loadIPC(path), callback);
};

// Generate code for a pseudo-IPC using JSON.
function fakeIPC(expr) {
    var cmd =
        "try { " +
            "printErr(JSON.stringify({ type: 'return', value: " + expr + " })); " +
        "} catch (e) { " +
            "printErr(JSON.stringify({ " +
                "type: 'throw', " +
                "value: { " +
                    "type: (e && e.constructor && e.constructor.name) || (typeof e), " +
                    "value: e, " +
                    "message: e && e.message, " +
                    "lineNumber: e && e.lineNumber " +
                "} " +
            "})); " +
        "}";
    return cmd;
}

// checking syntax (discards parse tree to minimize I/O)
function checkIPC(src) {
    return fakeIPC("(Reflect.parse(" + JSON.stringify(src) + "), true)");
}

// checking syntax of a file (discards parse tree to minimize I/O)
function checkFileIPC(path) {
    return fakeIPC("(Reflect.parse(snarf(" + JSON.stringify(path) + ")), true)");
}

// parse
function parseIPC(src) {
    return fakeIPC("Reflect.parse(" + JSON.stringify(src) + ")");
}

// parse a file
function parseFileIPC(path) {
    return fakeIPC("Reflect.parse(snarf(" + JSON.stringify(path) + "))");
}

// evaluate
function evalIPC(src) {
    return fakeIPC("(1,eval)(" + JSON.stringify(src) + ")");
}

// load a file
function loadIPC(path) {
    var quoted = JSON.stringify(path);
    return fakeIPC("evalWithLocation(snarf(" + quoted + "), " + quoted + ", 1)");
}

function endsWith(s1, s2) {
    var n = s2.length;
    return s1.substring(s1.length - n) === s2;
}

function indexOfSubstring(haystack, needle) {
    for (var i = 0, j = 0, m = haystack.length, n = needle.length; i < m; i++) {
        if (haystack[i] === needle[j]) {
            j++;
            if (j === n) {
                return i + 1 - n;
            }
        } else {
            j = 0;
        }
    }
    return j === 0 ? -1 : m - j;
}

module.exports = SM;

// function test(haystack, needle, expected) {
//     console.log(JSON.stringify(haystack) + ".indexOfSubstring(" + JSON.stringify(needle) + ") : expect " + expected + ", got " + indexOfSubstring(haystack, needle));
// }

// test("012dave789", "dave", 3);
// test("dave456789", "dave", 0);
// test("0123456789", "dave", -1);
// test("012345dave", "dave", 6);
// test("0123456dav", "dave", 7);
// test("01234567da", "dave", 8);
// test("012345678d", "dave", 9);
// test("0d23456789", "dave", -1);
// test("0da3456789", "dave", -1);
// test("0dav456789", "dave", -1);
// test("0d234d6789", "dave", -1);
// test("0d234da789", "dave", -1);
// test("0d234dav89", "dave", -1);
// test("0da34dav89", "dave", -1);

// var sm = new SM();

// function onmsg(err, x) {
//     if (err) {
//         console.log("threw: " + JSON.stringify(err));
//     } else {
//         console.log("returned: " + JSON.stringify(x));
//     }
// }

// sm.eval("17", onmsg);
// sm.eval("throw 12", onmsg);
// sm.eval("throw new Error('omg')", onmsg);
// sm.eval("19", onmsg);
// sm.check("delete for this", onmsg);
// sm.check("var x = 12; x * 3", onmsg);
// sm.parse("x * 2", onmsg);
// sm.checkFile("./lib/sm.js", onmsg);
// sm.checkFile("./README.md", onmsg);
// sm.close();
