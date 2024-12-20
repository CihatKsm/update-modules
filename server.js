#!/usr/bin/env node

require('colors');
const debug = process.argv?.pop() == '--debug';

const log_title = '▲ update-modules: '.cyan;
const log = (text) => console.log(log_title + (text || ''));

const { SingleBar, Presets } = require('cli-progress');
const { exec } = require('node:child_process');
const { createInterface } = require('readline');

const dir = __dirname.split('node_modules')[0].replaceAll(`\\`, '/') + '/';
const package = require(dir + 'package.json');

const checkingUpdateBar = new SingleBar({
    barCompleteChar: '+',
    barIncompleteChar: '-',
    fps: 1,
    clearOnComplete: false,
    hideCursor: true,
    format: log_title + 'Modules Control: {bar} {value} / {total}'.yellow,
}, Presets.shades_grey);

const moduleInstallingBar = new SingleBar({
    barCompleteChar: '+',
    barIncompleteChar: '-',
    fps: 1,
    clearOnComplete: false,
    hideCursor: true,
    format: log_title + 'Modules Install: {bar} {value} / {total}'.yellow,
}, Presets.shades_grey);

if (debug) log('Debug mode is enabled.'.blue);

const ignored_modules = package?.updateModulesConfig?.ignore || [];
const dependencies = Object?.keys(package?.dependencies || []);
const devDependencies = Object?.keys(package?.devDependencies || []);
const normaly_modules = dependencies?.map(name => ({ name, version: package?.dependencies?.[name]?.replace('^', ''), dev: false }));
const dev_modules = devDependencies?.map(name => ({ name, version: package?.devDependencies?.[name]?.replace('^', ''), dev: true }));
const modules = [...normaly_modules, ...dev_modules];

if (debug) log(`Modules: ${modules.map(m => `"${m?.name}"`).join(', ')}`.blue);

/**
 * Fetches the module data from the npm registry.
 * 
 * @param {String} name This is the module name. 
 * @returns 
 */
const fetchModule = async (name) => {
    let output = null;
    const addresses = [
        'registry.npmjs.org/{name}',
        'cdn.jsdelivr.net/npm/{name}@latest/package.json'
    ];

    for (let address of addresses) {
        try {
            output = await fetch('https://' + address.replaceAll('{name}', name)).then(res => res?.json());
            if (output) break;
        } catch (error) {
            if (debug) log(`Error: ${error}`.red);
        }
    }

    return output;
}

(async () => {
    log(`Checking the updates of "${normaly_modules.length}" normal and "${dev_modules.length}" developer modules.`.yellow);

    checkingUpdateBar.start(modules?.length || 0, 0);
    checkingUpdateBar.increment();

    let updatebleModules = (await Promise.all(modules.map(async (module, i) => {
        checkingUpdateBar.update(i + 1);
        const data = await fetchModule(module.name);
        if (!data) return null;

        const newVersion = data?.['dist-tags']?.latest || data?.version;
        if (!newVersion) return { ...module, latest: null };

        const updateble = newVersion != module.version && !ignored_modules.includes(module.name);
        if (updateble) return { ...module, latest: newVersion };
        else return null;
    }))).filter(f => f !== null);

    checkingUpdateBar.stop();

    if (debug) log(`Updateble Modules: ${updatebleModules.length > 0 ? updatebleModules.map(m => m?.name).join(', ') : "None"}`.blue);

    if (updatebleModules.length == 0) return log('No updates available.'.green);

    if (debug) log('\nFound updates for the following modules:'.blue);

    const nameLength = Math.max(...updatebleModules.map(module => module?.name?.length));
    const versionLength = Math.max(...updatebleModules.map(module => module?.version?.length));
    const arrow = '─'.repeat(nameLength + versionLength + 20);

    const notFoundModules = updatebleModules.filter(f => !f.latest);
    if (notFoundModules.length > 0) {
        log(`Please remove ${notFoundModules.length > 0 ? notFoundModules.map(m => `"${m?.name}"`).join(', ') : "None"} modules. Because the latest version could not be found.`.red);
        return;
    }

    updatebleModules = updatebleModules.filter(f => f.latest);

    log();
    console.log(arrow.cyan);
    console.log(`▲  ${'Module'.padEnd(nameLength)}    ${'Version'.padEnd(versionLength)}    Latest`.cyan);
    console.log(arrow.cyan);

    for (let module of updatebleModules) {
        var name = module.name + ' '.repeat(nameLength - module.name.length);
        var version = module.version + ' '.repeat(versionLength - module.version.length);
        console.log(`▲  ${name}  :  ${version}  →  ${module.latest}`.yellow);
    }

    console.log(arrow.cyan);

    if (debug) log('Asking for update confirmation.'.blue);

    const client = createInterface({ input: process.stdin, output: process.stdout });
    client.question(log_title + 'Do you want to update? (yes / no) \n'.yellow + log_title + 'Your Answer: '.yellow, async (answer) => {
        if (debug) log(`Answer: ${answer}`.blue);

        const acceptAnswers = ['yes', 'y', 'true'];
        if (!acceptAnswers.includes(answer.toLowerCase())) {
            if (debug) log('Closing the process.'.blue);
            return client.close();
        }

        if (debug) log('Updating the modules...'.blue);

        moduleInstallingBar.start(updatebleModules.length, 0);
        moduleInstallingBar.increment();

        for (let i = 0; i < updatebleModules.length; i++) {
            moduleInstallingBar.update(i + 1);
            const update = await moduleUpdate(updatebleModules[i].name, 'latest');
            if (!update) {
                if (debug) log('Module update error: '.red + update.red);
                log(`An error occurred while updating the "${updatebleModules[i].name}" module.`.red);
            }
        }

        moduleInstallingBar.stop();

        if (debug) log('Closing the process.'.blue);
        client.close();
    });

    client.on('close', () => {
        if (debug) log('Process closed.'.blue);
        process.exit();
    });
})();

/**
 * Updates the module.
 * 
 * @param {String} name This is the module name.
 * @param {String} verison This is the module version.
 * @returns 
 */
async function moduleUpdate(name, verison) {
    return await new Promise((resolve, reject) => {
        exec(`npm install ${name}@${verison}`, (error) => {
            if (error) {
                setTimeout(() => reject(error), 200)
            } else {
                setTimeout(() => resolve(true), 200)
            }
        });
    });
}