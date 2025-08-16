// gemini/bridge.js

const OopisOS_Kernel = {
    isReady: false,
    pyodide: null,
    kernel: null,
    dependencies: null,

    async syscall(module, func, args = [], kwargs = {}) {
        if (!this.isReady || !this.kernel) {
            return JSON.stringify({ "success": false, "error": "Error: Python kernel is not ready for syscall." });
        }
        try {
            const request = { module, "function": func, args, kwargs };
            const resultPromise = this.kernel.syscall_handler(JSON.stringify(request));
            return await resultPromise;
        } catch (error) {
            return JSON.stringify({ "success": false, "error": `Syscall bridge error: ${error.message}` });
        }
    },

    async initialize(dependencies) {
        this.dependencies = dependencies;
        const { OutputManager, Config, CommandRegistry } = this.dependencies;
        try {
            await OutputManager.appendToOutput("Initializing Python runtime via Pyodide...", { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
            this.pyodide = await loadPyodide({
                indexURL: "./dist/pyodide/"
            });
            await this.pyodide.loadPackage(["cryptography", "ssl"]);
            await OutputManager.appendToOutput("Python runtime loaded. Loading kernel...", { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });

            this.pyodide.FS.mkdir('/core');
            this.pyodide.FS.mkdir('/core/commands');
            this.pyodide.FS.mkdir('/core/apps');
            await this.pyodide.runPythonAsync(`import sys\nsys.path.append('/core')`);

            const filesToLoad = {
                '/core/kernel.py': './core/kernel.py',
                '/core/filesystem.py': './core/filesystem.py',
                '/core/executor.py': './core/executor.py',
                '/core/session.py': './core/session.py',
                '/core/groups.py': './core/groups.py',
                '/core/users.py': './core/users.py',
                '/core/sudo.py': './core/sudo.py',
                '/core/audit.py': './core/audit.py',
                '/core/ai_manager.py': './core/ai_manager.py',
                '/core/time_utils.py': './core/time_utils.py',
                '/core/commands/gemini.py': './core/commands/gemini.py',
                '/core/commands/chidi.py': './core/commands/chidi.py',
                '/core/commands/remix.py': './core/commands/remix.py',
                '/core/commands/sudo.py': './core/commands/sudo.py',
                '/core/commands/su.py': './core/commands/su.py',
                '/core/commands/visudo.py': './core/commands/visudo.py',
                '/core/commands/useradd.py': './core/commands/useradd.py',
                '/core/commands/usermod.py': './core/commands/usermod.py',
                '/core/commands/passwd.py': './core/commands/passwd.py',
                '/core/commands/removeuser.py': './core/commands/removeuser.py',
                '/core/commands/groupadd.py': './core/commands/groupadd.py',
                '/core/commands/groupdel.py': './core/commands/groupdel.py',
                '/core/commands/login.py': './core/commands/login.py',
                '/core/commands/logout.py': './core/commands/logout.py',
                '/core/commands/alias.py': './core/commands/alias.py',
                '/core/commands/unalias.py': './core/commands/unalias.py',
                '/core/commands/mv.py': './core/commands/mv.py',
                '/core/commands/set.py': './core/commands/set.py',
                '/core/commands/unset.py': './core/commands/unset.py',
                '/core/commands/run.py': './core/commands/run.py',
                '/core/commands/history.py': './core/commands/history.py',
                '/core/commands/date.py': './core/commands/date.py',
                '/core/commands/pwd.py': './core/commands/pwd.py',
                '/core/commands/echo.py': './core/commands/echo.py',
                '/core/commands/ls.py': './core/commands/ls.py',
                '/core/commands/whoami.py': './core/commands/whoami.py',
                '/core/commands/clear.py': './core/commands/clear.py',
                '/core/commands/help.py': './core/commands/help.py',
                '/core/commands/man.py': './core/commands/man.py',
                '/core/commands/cat.py': './core/commands/cat.py',
                '/core/commands/mkdir.py': './core/commands/mkdir.py',
                '/core/commands/touch.py': './core/commands/touch.py',
                '/core/commands/rm.py': './core/commands/rm.py',
                '/core/commands/grep.py': './core/commands/grep.py',
                '/core/commands/uniq.py': './core/commands/uniq.py',
                '/core/commands/wc.py': './core/commands/wc.py',
                '/core/commands/head.py': './core/commands/head.py',
                '/core/commands/delay.py': './core/commands/delay.py',
                '/core/commands/rmdir.py': './core/commands/rmdir.py',
                '/core/commands/tail.py': './core/commands/tail.py',
                '/core/commands/diff.py': './core/commands/diff.py',
                '/core/commands/beep.py': './core/commands/beep.py',
                '/core/commands/chmod.py': './core/commands/chmod.py',
                '/core/commands/chown.py': './core/commands/chown.py',
                '/core/commands/chgrp.py': './core/commands/chgrp.py',
                '/core/commands/tree.py': './core/commands/tree.py',
                '/core/commands/du.py': './core/commands/du.py',
                '/core/commands/nl.py': './core/commands/nl.py',
                '/core/commands/ln.py': './core/commands/ln.py',
                '/core/commands/patch.py': './core/commands/patch.py',
                '/core/commands/comm.py': './core/commands/comm.py',
                '/core/commands/shuf.py': './core/commands/shuf.py',
                '/core/commands/storyboard.py': './core/commands/storyboard.py',
                '/core/commands/forge.py': './core/commands/forge.py',
                '/core/commands/csplit.py': './core/commands/csplit.py',
                '/core/commands/awk.py': './core/commands/awk.py',
                '/core/commands/expr.py': './core/commands/expr.py',
                '/core/commands/rename.py': './core/commands/rename.py',
                '/core/commands/zip.py': './core/commands/zip.py',
                '/core/commands/unzip.py': './core/commands/unzip.py',
                '/core/commands/reboot.py': './core/commands/reboot.py',
                '/core/commands/ps.py': './core/commands/ps.py',
                '/core/commands/kill.py': './core/commands/kill.py',
                '/core/commands/sync.py': './core/commands/sync.py',
                '/core/commands/ocrypt.py': './core/commands/ocrypt.py',
                '/core/commands/reset.py': './core/commands/reset.py',
                '/core/commands/fsck.py': './core/commands/fsck.py',
                '/core/commands/printf.py': './core/commands/printf.py',
                '/core/commands/xor.py': './core/commands/xor.py',
                '/core/commands/bc.py': './core/commands/bc.py',
                '/core/commands/cp.py': './core/commands/cp.py',
                '/core/commands/sed.py': './core/commands/sed.py',
                '/core/commands/xargs.py': './core/commands/xargs.py',
                '/core/commands/cut.py': './core/commands/cut.py',
                '/core/commands/df.py': './core/commands/df.py',
                '/core/commands/groups.py': './core/commands/groups.py',
                '/core/commands/listusers.py': './core/commands/listusers.py',
                '/core/commands/tr.py': './core/commands/tr.py',
                '/core/commands/base64.py': './core/commands/base64.py',
                '/core/commands/cksum.py': './core/commands/cksum.py',
                '/core/commands/edit.py': './core/commands/edit.py',
                '/core/commands/explore.py': './core/commands/explore.py',
                '/core/commands/log.py': './core/commands/log.py',
                '/core/commands/paint.py': './core/commands/paint.py',
                '/core/commands/top.py': './core/commands/top.py',
                '/core/commands/basic.py': './core/commands/basic.py',
                '/core/commands/upload.py': './core/commands/upload.py',
                '/core/commands/nc.py': './core/commands/nc.py',
                '/core/commands/netstat.py': './core/commands/netstat.py',
                '/core/commands/read_messages.py': './core/commands/read_messages.py',
                '/core/commands/post_message.py': './core/commands/post_message.py',
                '/core/commands/adventure.py': './core/commands/adventure.py',
                '/core/commands/find.py': './core/commands/find.py',
                '/core/commands/sort.py': './core/commands/sort.py',
                '/core/commands/cd.py': './core/commands/cd.py',
                '/core/commands/fg.py': './core/commands/fg.py',
                '/core/commands/bg.py': './core/commands/bg.py',
                '/core/commands/less.py': './core/commands/less.py',
                '/core/commands/more.py': './core/commands/more.py',
                '/core/commands/committee.py': './core/commands/committee.py',
                '/core/commands/jobs.py': './core/commands/jobs.py',
                '/core/commands/binder.py': './core/commands/binder.py',
                '/core/commands/bulletin.py': './core/commands/bulletin.py',
                '/core/commands/agenda.py': './core/commands/agenda.py',
                '/core/commands/clearfs.py': './core/commands/clearfs.py',
                '/core/commands/printscreen.py': './core/commands/printscreen.py',
                '/core/commands/restore.py': './core/commands/restore.py',
                '/core/commands/check_fail.py': './core/commands/check_fail.py',
                '/core/commands/who.py': './core/commands/who.py',
                '/core/commands/uptime.py': './core/commands/uptime.py',
                '/core/commands/_upload_handler.py': './core/commands/_upload_handler.py',
                '/core/commands/__init__.py': null,
                '/core/apps/__init__.py': null,
                '/core/apps/editor.py': './core/apps/editor.py',
                '/core/apps/explorer.py': './core/apps/explorer.py',
                '/core/apps/paint.py': './core/apps/paint.py',
                '/core/apps/adventure.py': './core/apps/adventure.py',
                '/core/apps/top.py': './core/apps/top.py',
                '/core/apps/log.py': './core/apps/log.py',
                '/core/apps/basic.py': './core/apps/basic.py'
            };
            for (const [pyPath, jsPath] of Object.entries(filesToLoad)) {
                if (jsPath) {
                    const code = await (await fetch(jsPath)).text();
                    this.pyodide.FS.writeFile(pyPath, code, { encoding: 'utf8' });
                } else {
                    this.pyodide.FS.writeFile(pyPath, '', { encoding: 'utf8' });
                }
            }

            this.kernel = this.pyodide.pyimport("kernel");
            this.kernel.initialize_kernel();

            const pythonCommands = this.kernel.MODULE_DISPATCHER["executor"].commands.toJs();
            Config.COMMANDS_MANIFEST.push(...pythonCommands);
            Config.COMMANDS_MANIFEST.sort();

            // Inform the Python kernel about the JS-native commands.
            await this.syscall("executor", "set_js_native_commands", [Config.JS_NATIVE_COMMANDS]);

            this.isReady = true;
            await OutputManager.appendToOutput("OopisOS Python Kernel is online.", { typeClass: Config.CSS_CLASSES.SUCCESS_MSG });
        } catch (error) {
            this.isReady = false;
            console.error("Pyodide initialization failed:", error);
            await OutputManager.appendToOutput(`FATAL: Python Kernel failed to load: ${error.message}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
        }
    },

    async execute_command(commandString, jsContextJson, stdinContent = null) {
        return await this.kernel.execute_command(commandString, jsContextJson, stdinContent);
    },
};