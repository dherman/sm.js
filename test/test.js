var SM = require("../lib/sm.js");

var sm = new SM();

sm.on("message", function(response, request) {
    console.log("RESPONSE FOR: " + JSON.stringify(request));
});

function onmsg(err, x) {
    if (err) {
        console.log("threw: " + JSON.stringify(err));
    } else {
        console.log("returned: " + JSON.stringify(x));
    }
}

sm.eval("17", onmsg);
sm.eval("throw 12", onmsg);
sm.eval("throw new Error('omg')", onmsg);
sm.eval("19", onmsg);
sm.check("delete for this", onmsg);
sm.check("var x = 12; x * 3", onmsg);
sm.parse("x * 2", onmsg);
sm.checkFile("./lib/sm.js", onmsg);
sm.checkFile("./README.md", onmsg);
sm.close();
