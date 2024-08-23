const debug = process.argv?.pop() == '--debug';
const log = (text) => console.log('▲ update-modules: '.cyan + text);
const dir = __dirname.split('node_modules')[0].replaceAll(`\\`, '/') + '/';
const readline = require('readline');
const child_process = require('child_process');
const package = require(dir + 'package.json');
require('colors');

if (debug) log('Debug mode is enabled.'.blue);

const _normaly_modules = Object?.keys(package?.dependencies || [])?.map(name => ({ name, version: package.dependencies[name].replace('^', ''), dev: false }));
const _dev_modules = Object?.keys(package?.devDependencies || [])?.map(name => ({ name, version: package.devDependencies[name].replace('^', ''), dev: true }));
const modules = [..._normaly_modules, ..._dev_modules];

if (debug) log(`Modules: ${modules.map(m => `"${m?.name}"`).join(', ')}`.blue);

/**
 * Fetches the module data from the npm registry.
 * 
 * @param {String} name This is the module name. 
 * @returns 
 */
const fetchModule = async (name) => await fetch(`https://registry.npmjs.org/${name}`).then((res) => res.json()).catch(() => null);

log(`Checking the updates of "${_normaly_modules.length}" normal and "${_dev_modules.length}" developer modules.`.yellow);

var updatebleModules = [];
modules.forEach(async (module) => {
    const data = await fetchModule(module.name);
    if (data['dist-tags'].latest == module.version) return;
    updatebleModules.push({ ...module, latest: data['dist-tags'].latest });
});

if (debug) log(`Updateble Modules: ${updatebleModules.length > 0 ? updatebleModules.map(m => m.name).join(', ') : "None"}`.blue);

if (updatebleModules.length == 0) return log('No updates available.'.green);

if (debug) log('Found updates for the following modules:'.blue);

const nameLength = Math.max(...updatebleModules.map(module => module.name.length));
const versionLength = Math.max(...updatebleModules.map(module => module.version.length));
const arrow = '─'.repeat(nameLength + versionLength + 20);

console.log(arrow.red);
console.log(`▲  ${'Module'.padEnd(nameLength)}    ${'Version'.padEnd(versionLength)}    Latest`.red);
console.log(arrow.red);

updatebleModules.forEach(module => {
    var name = module.name + ' '.repeat(nameLength - module.name.length);
    var version = module.version + ' '.repeat(versionLength - module.version.length);
    console.log(`▲  ${name}  :  ${version}  →  ${module.latest}`.yellow);
});

console.log(arrow.red);

if (debug) log('Asking for update confirmation.'.blue);

const client = readline.createInterface({ input: process.stdin, output: process.stdout });
client.question('● Do you want to update? (yes / no) \n● Your Answer: '.red, async (answer) => {
    if (debug) log(`Answer: ${answer}`.blue);
    if (answer.toLowerCase() !== 'yes') return client.close();
    if (debug) log('Updating the modules...'.blue);
    const modules = updatebleModules.map(m => m.name + '@' + m.latest).join(' ');
    log(`ᴄᴍᴅ : npm install ${modules}`.white);
    if (debug) log(`Updating the modules: ${modules}`.blue);
    child_process.exec(`npm install ${modules}`, (error) => error ? log(error.red) : log('Update completed.'.green));
    if (debug) log('Closing the process.'.blue);
    client.close();
});

client.on('close', () => {
    if (debug) log('Closing the process.'.blue);
    process.exit(0);
});
