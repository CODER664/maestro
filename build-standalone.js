/* Rebuild maestro-standalone.html from index.html + styles.css + the four JS files.
   Run after any edit:  node build-standalone.js  */
const fs = require("fs"), path = require("path");
const dir = __dirname;
const read = f => fs.readFileSync(path.join(dir, f), "utf8");
let html = read("index.html");
html = html.replace(/<link rel="stylesheet" href="styles.css">/, "<style>\n" + read("styles.css") + "\n</style>");
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, f) => "<script>\n" + read(f) + "\n</script>");
fs.writeFileSync(path.join(dir, "maestro-standalone.html"), html);
console.log("built maestro-standalone.html (" + (html.length / 1024).toFixed(0) + " KB)");
