#!/usr/bin/env node

const readline = require('readline');
const colors = require('colors');
const { exec } = require('child_process');
const package = require(__dirname.split('node_modules')[0].replaceAll(`\\`, '/') + 'package.json');

const modules = [
    ...Object?.keys(package?.dependencies || [])?.map(name => ({ name, version: package.dependencies[name].replace('^', ''), dev: false })),
    ...Object?.keys(package?.devDependencies || [])?.map(name => ({ name, version: package.devDependencies[name].replace('^', ''), dev: true })),
]

const fetchModule = async (name) => {
    const res = await fetch(`https://registry.npmjs.org/${name}`);
    return await res.json();
}

(async () => {
    console.log('● Checking for updates...\n'.white);

    var updatebleModules = [];

    for (var module of modules) {
        const data = await fetchModule(module.name);
        if (data['dist-tags'].latest == module.version) continue; 
        updatebleModules.push({ ...module, latest: data['dist-tags'].latest });
    }

    if (updatebleModules.length == 0) return console.log('● No updates available.'.green);

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
    
    const client = readline.createInterface({ input: process.stdin, output: process.stdout });

    client.question('● Do you want to update? (yes / no) \n● Your Answer: '.red, async (answer) => {
        if (answer.toLowerCase() !== 'yes') return client.close();
        const moduls = updatebleModules.map(m => m.name + '@' + m.latest).join(' ');
        console.log(`ᴄᴍᴅ : npm install ${moduls}`.white);
        exec(`npm install ${moduls}`, (error) => error ? console.error(error) : console.log('● Update completed.'.green));
        client.close();
    });
})();