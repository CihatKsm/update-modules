#!/usr/bin/env node

require('colors');
const debug = process.argv?.pop() == '--debug';

const log_title = '▲ update-modules: '.cyan;
const log = (text) => console.log(log_title + (text || ''));

const cli_progress = require('cli-progress');
const child_process = require('node:child_process');
const readline = require('readline');

const dir = __dirname.split('node_modules')[0].replaceAll(`\\`, '/') + '/';
const package = require(dir + 'package.json');

const checkingUpdateBar = new cli_progress.SingleBar({
    barCompleteChar: '+',
    barIncompleteChar: '-',
    fps: 1,
    clearOnComplete: false,
    hideCursor: true,
    format: log_title + 'Modules Control: {bar} {value} / {total}'.yellow,
}, cli_progress.Presets.shades_grey);

const moduleInstallingBar = new cli_progress.SingleBar({
    barCompleteChar: '+',
    barIncompleteChar: '-',
    fps: 1,
    clearOnComplete: false,
    hideCursor: true,
    format: log_title + 'Modules Install: {bar} {value} / {total}'.yellow,
}, cli_progress.Presets.shades_grey);

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
const fetchModule = async (name) => await fetch(`https://registry.npmjs.org/${name}`).then(res => res.json()).catch(() => null);

(async () => {
    log(`Checking the updates of "${_normaly_modules.length}" normal and "${_dev_modules.length}" developer modules.`.yellow);

    checkingUpdateBar.start(modules?.length || 0, 0);
    checkingUpdateBar.increment();

    const updatebleModules = (await Promise.all(modules.map(async (module, i) => {
        checkingUpdateBar.update(i + 1);
        const data = await fetchModule(module.name);
        if (!data) return null;

        const newVersion = data['dist-tags']?.latest;
        if (!newVersion) return { ...module, latest: null };

        const updateble = newVersion != module.version;
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

    log();
    console.log(arrow.cyan);
    console.log(`▲  ${'Module'.padEnd(nameLength)}    ${'Version'.padEnd(versionLength)}    Latest`.cyan);
    console.log(arrow.cyan);

    for (let module of updatebleModules.filter(f => f.latest)) {
        var name = module.name + ' '.repeat(nameLength - module.name.length);
        var version = module.version + ' '.repeat(versionLength - module.version.length);
        console.log(`▲  ${name}  :  ${version}  →  ${module.latest}`.yellow);
    }

    console.log(arrow.cyan);

    if (debug) log('Asking for update confirmation.'.blue);

    const client = readline.createInterface({ input: process.stdin, output: process.stdout });
    client.question(log_title + 'Do you want to update? (yes / no) \n'.yellow + log_title + 'Your Answer: '.yellow, async (answer) => {
        if (debug) log(`Answer: ${answer}`.blue);

        const acceptAnswers = ['yes', 'y', 'true'];
        if (!acceptAnswers.includes(answer.toLowerCase())) {
            if (debug) log('Closing the process.'.blue);
            return client.close();
        }

        if (debug) log('Updating the modules...'.blue);

        moduleInstallingBar.start(modules.length, 0);
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
        child_process.exec(`npm install ${name}@${verison}`, (error) => {
            if (error) {
                setTimeout(() => reject(error), 200)
            } else {
                setTimeout(() => resolve(true), 200)
            }
        });
    });
}

/**
 * Deletes the module.
 * 
 * @param {String} name This is the module name.
 * @returns 
 */
async function deleteModule(name) {
    return await new Promise((resolve, reject) => {
        child_process.exec(`npm uninstall ${name}`, (error) => {
            if (error) {
                setTimeout(() => reject(error), 200)
            } else {
                setTimeout(() => resolve(true), 200)
            }
        });
    });
}