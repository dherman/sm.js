var cp = require("child_process");
var events = require("events");
var temp = require('temp');
var fs = require('fs');

var EventEmitter = events.EventEmitter;

function SMEmitter(opts) {
    EventEmitter.call(this);

    opts = opts || {};

    this.shell = opts.shell || "js";
    this.code = opts.code;
    this.file = opts.file;
    this.stdout = opts.stdout || null;
    this.stderr = opts.stderr || null;
    this.stdin = opts.stdin || null;

    this.proc = null;
}

SMEmitter.prototype = Object.create(EventEmitter.prototype);

SMEmitter.prototype.spawn = function spawn(args) {
    var self = this;
    var proc = cp.spawn(this.shell, args);

    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");

    if (this.stdout) {
        proc.stdout.on("data", function(str) {
            self.stdout.write(str);
        });
    }

    if (this.stderr) {
        proc.stderr.on("data", function(str) {
            self.stderr.write(str);
        });
    }

    if (this.stdin) {
        this.stdin.setEncoding("utf8");
        this.stdin.on("data", function(str) {
            proc.stdin.write(str, "utf8");
        });
    }

    proc.on("error", function(err) {
        self.emit("error", err);
    });

    var stderr = "";
    proc.stderr.on("data", function(str) {
        stderr += str;
    });

    proc.on("exit", function(exitCode) {
        self.emit(exitCode ? "throw" : "return", JSON.parse(stderr));
    });

    this.proc = proc;

    return proc;
};

// string[, string="js"] -> EventEmitter
function check(src, shell) {
    var sm = withTemp(src, shell, function(path) {
        sm.spawn(["-e", checkIPC(path)]);
    });
    return sm;
}

// path[, string="js"] -> EventEmitter
function checkFile(path, shell) {
    var sm = new SMEmitter({ shell: shell });
    sm.checkFile(path);
    return sm;
}

// string[, string="js"] -> EventEmitter
function parse(src, shell) {
    var sm = withTemp(src, shell, function(path) {
        sm.spawn(["-e", parseIPC(path)]);
        //sm.parseFile(path);
    });
    return sm;
}

// path[, string="js"] -> EventEmitter
function parseFile(path, shell) {
    var sm = new SMEmitter({ shell: shell });
    sm.parseFile(path);
    return sm;
}

// string[, string="js"] -> EventEmitter
function evaluate(src, shell) {
    var sm = withTemp(src, shell, function(path) {
        sm.spawn(["-e", loadIPC(path)]);
        //sm.loadFile(path);
    });
    return sm;
}

// path[, string="js"] -> EventEmitter
function evaluateFile(path, shell) {
    var sm = new SMEmitter({ shell: shell });
    sm.evalFile(path);
    return sm;
}

function withTemp(src, shell, callback) {
    var sm = new SMEmitter({ shell: shell });
    temp.open("sm", function(err, info) {
        if (err) {
            sm.emit("error", err);
            return;
        }
        fs.close(info.fd, function(err) {
            if (err) {
                sm.emit("error", err);
                return;
            }
            var tmpStream = fs.createWriteStream(info.path, { flags: 'w+', encoding: 'utf8' });
            tmpStream.write(src);
            tmpStream.end();
            callback(info.path);
        });
    });
    return sm;
}

// Generate code for a pseudo-IPC using JSON.
function fakeIPC(expr) {
    var cmd =
        "try { " +
            "printErr(JSON.stringify(" + expr + ")); " +
        "} catch (e) { " +
            "if (e) { " +
                "printErr(JSON.stringify({ " +
                    "message: e.message, " +
                    "lineNumber: e.lineNumber " +
                "})) " +
            "} " +
            "quit(1); " +
        "}";
    return cmd;
}

// pseudo-IPC for checking syntax (discards parse tree to minimize I/O)
function checkIPC(tmpfile) {
    return fakeIPC("(Reflect.parse(snarf('" + tmpfile + "')), true)");
}

// pseudo-IPC for parsing JS code
function parseIPC(tmpfile) {
    return fakeIPC("Reflect.parse(snarf('" + tmpfile + "'))");
}

// pseudo-IPC for evaluating JS to get a result
function loadIPC(tmpfile) {
    return fakeIPC("evalWithLocation(snarf('" + tmpfile + "'), '" + tmpfile + "', 1)");
}


exports.check = check;
exports.checkFile = checkFile;
exports.parse = parse;
exports.parseFile = parseFile;
exports.evaluate = evaluate;
exports.evaluateFile = evaluateFile;
