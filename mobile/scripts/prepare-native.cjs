// Windows cmd AutoRun may print a profile banner and corrupt autolinking JSON.
// /d disables AutoRun only for build subprocesses; no user registry changes.
const fs = require('node:fs');
const path = require('node:path');
const roots = ['expo-modules-autolinking/android', '@react-native/gradle-plugin'];
for (const name of roots) {
  const root = path.join(__dirname, '../node_modules', name);
  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (item.isDirectory() && item.name !== 'build' && item.name !== '.gradle')
        walk(path.join(dir, item.name));
      else if (item.isFile() && item.name.endsWith('.kt')) {
        const file = path.join(dir, item.name);
        const original = fs.readFileSync(file, 'utf8');
        const updated = original.replaceAll('listOf("cmd", "/c")', 'listOf("cmd", "/d", "/c")');
        if (original !== updated) {
          fs.writeFileSync(file, updated);
          console.log('Applied Windows AutoRun isolation: ' + path.relative(root, file));
        }
      }
    }
  }
  walk(root);
}
