"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
const child_process_1 = require("child_process");
const DEFAULT_SETTINGS = {
    rsyncBinaryPath: '',
    remoteIP: '',
    sshPort: 22,
    sshUsername: '',
    sshPassword: '',
    privateKeyPath: '',
    localDirPath: '',
    remoteDirPath: '',
    syncDirection: 'push',
    dryRun: false,
    logFilePath: '',
    excludePatterns: [],
    scheduleInterval: 0,
};
class RsyncPlugin extends obsidian_1.Plugin {
    constructor() {
        super(...arguments);
        this.settings = DEFAULT_SETTINGS;
        this.syncInterval = null;
    }
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadSettings();
            // Schedule rsync sync if the interval is set
            if (this.settings.scheduleInterval > 0) {
                this.registerInterval(window.setInterval(() => this.runRsyncCommand(), this.settings.scheduleInterval * 60 * 1000));
            }
            // Add ribbon icon for manual sync
            this.addRibbonIcon('sync', 'Rsync', () => {
                new RsyncModal(this.app, this).open();
            });
            // Add settings tab for configuring Rsync paths and options
            this.addSettingTab(new RsyncPluginSettingTab(this.app, this));
            console.log('Rsync Plugin Loaded...');
        });
    }
    onunload() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        console.log('Rsync Plugin Unloaded...');
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
            // Re-schedule sync if interval changes
            if (this.settings.scheduleInterval > 0) {
                this.scheduleSync(this.settings.scheduleInterval);
            }
            else if (this.syncInterval) {
                clearInterval(this.syncInterval);
                this.syncInterval = null;
            }
        });
    }
    scheduleSync(intervalMinutes) {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        this.syncInterval = setInterval(() => {
            this.runRsyncCommand();
        }, intervalMinutes * 60 * 1000);
    }
    runRsyncCommand(progressCallback = () => { }) {
        const { rsyncBinaryPath, remoteIP, sshPort, sshUsername, sshPassword, privateKeyPath, localDirPath, remoteDirPath, syncDirection, dryRun, logFilePath, excludePatterns } = this.settings;
        let rsyncCommand = '';
        const sshOptions = [];
        const excludeOptions = excludePatterns.map((pattern) => `--exclude '${pattern}'`).join(' ');
        if (privateKeyPath) {
            sshOptions.push(`-e "ssh -p ${sshPort} -i ${privateKeyPath}"`);
        }
        else if (sshUsername && sshPassword) {
            sshOptions.push(`-e "sshpass -p '${sshPassword}' ssh -p ${sshPort} -o StrictHostKeyChecking=no"`);
        }
        else {
            sshOptions.push(`-e "ssh -p ${sshPort}"`);
        }
        if (syncDirection === 'push') {
            rsyncCommand = `${rsyncBinaryPath} -avz --progress --stats --no-links --delete ${sshOptions.join(' ')} ${localDirPath} ${sshUsername}@${remoteIP}:${remoteDirPath}`;
        }
        else if (syncDirection === 'pull') {
            rsyncCommand = `${rsyncBinaryPath} -avz --progress --stats --no-links --delete ${sshOptions.join(' ')} ${sshUsername}@${remoteIP}:${remoteDirPath} ${localDirPath}`;
        }
        if (dryRun) {
            rsyncCommand += ' --dry-run';
        }
        if (logFilePath) {
            rsyncCommand += ` --log-file='${logFilePath}'`;
        }
        rsyncCommand += ` ${excludeOptions}`;
        // Run the rsync command using Node's child_process
        const rsyncProcess = (0, child_process_1.exec)(rsyncCommand, { encoding: 'utf8' }, (error, stdout, stderr) => {
            if (error) {
                new obsidian_1.Notice(`Rsync failed: ${stderr}`);
                console.error(`exec error: ${error}`);
            }
            else {
                new obsidian_1.Notice(`Rsync completed`);
                // Set the progress to 100% when completed
                progressCallback(100);
            }
        });
        if (rsyncProcess.stdout) {
            rsyncProcess.stdout.on('data', (data) => {
                const match = data.match(/(\d+)%/); // Match percentage in output
                if (match) {
                    const percentage = parseInt(match[1], 10);
                    progressCallback(percentage); // Call the provided progress callback
                }
            });
        }
    }
}
exports.default = RsyncPlugin;
class RsyncModal extends obsidian_1.Modal {
    constructor(app, plugin) {
        super(app);
        this.progressBar = null;
        this.plugin = plugin;
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        const syncDirOptions = ['push', 'pull'];
        // Add form for heading
        contentEl.createEl('h2', { text: 'Rsync Plugin' });
        // Container for progress bar and button
        const syncContainer = contentEl.createEl('div', { cls: 'sync-container' });
        // Progress bar on the top left
        this.progressBar = syncContainer.createEl('div', { cls: 'rsync-progress' });
        const progressElement = this.progressBar.createEl('progress', { value: '0' });
        progressElement.setAttribute('max', '100'); // Set max value programmatically
        progressElement.createEl('span', { text: '100%' });
        // Move the sync direction section below the sync button
        //const syncDirectionContainer = syncContainer.createEl('div', { cls: 'sync-direction-container' });
        new obsidian_1.Setting(contentEl)
            .setName('Sync Direction')
            .setDesc('Choose sync direction')
            .addDropdown(dropdown => dropdown
            .addOption('push', 'Push (Local to Remote)')
            .addOption('pull', 'Pull (Remote to Local)')
            .setValue(this.plugin.settings.syncDirection)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.syncDirection = value;
            yield this.plugin.saveSettings();
        })));
        // Sync button on the top right
        const syncButtonContainer = syncContainer.createEl('div', { cls: 'sync-button-container' });
        new obsidian_1.Setting(syncButtonContainer)
            .setName('')
            .setDesc('')
            .addButton(button => button
            .setButtonText('Start Sync')
            .onClick(() => __awaiter(this, void 0, void 0, function* () {
            // Reset progress bar to 0 before starting
            if (this.progressBar) {
                const progressElement = this.progressBar.querySelector('progress');
                if (progressElement) {
                    progressElement.value = 0;
                }
            }
            this.plugin.runRsyncCommand((percentage) => {
                var _a;
                if (this.progressBar) {
                    (_a = this.progressBar.querySelector('progress')) === null || _a === void 0 ? void 0 : _a.setAttribute('value', percentage.toString());
                }
            });
        })));
        // Add a toggle button for collapsing/expanding the settings
        const toggleButton = contentEl.createEl('button', { cls: 'settings-toggle' });
        toggleButton.setText('► Show Settings'); // Change to right triangle
        let settingsVisible = false;
        // Create a container for settings
        const settingsContainer = contentEl.createEl('div', { cls: 'settings-container' });
        settingsContainer.style.display = 'none'; // Initially hidden
        // Toggle the visibility of the settings when the button is clicked
        toggleButton.onclick = () => {
            settingsVisible = !settingsVisible;
            if (settingsVisible) {
                settingsContainer.style.display = 'block'; // Show settings
                toggleButton.setText(String.fromCharCode(0x25BC) + ' Hide Settings'); // ▼ (UTF-8 number U+25BC)
            }
            else {
                settingsContainer.style.display = 'none'; // Hide settings
                toggleButton.setText(String.fromCharCode(0x25B6) + ' Show Settings'); // ► (UTF-8 number U+25B6)
            }
        };
        // Add space here if needed (for visual separation)
        contentEl.createEl('div', { cls: 'spacer' }); // Optional spacer element
        contentEl.createEl('div', { cls: 'spacer' }); // Optional spacer element
        contentEl.createEl('div', { cls: 'spacer' }); // Optional spacer element
        new obsidian_1.Setting(settingsContainer)
            .setName('Rsync Binary Path')
            .setDesc('Path to the rsync binary')
            .addText(text => text
            .setPlaceholder('Enter path to rsync binary')
            .setValue(this.plugin.settings.rsyncBinaryPath)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.rsyncBinaryPath = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(settingsContainer)
            .setName('Remote IP Address')
            .setDesc('IP address of the remote machine')
            .addText(text => text
            .setPlaceholder('Enter remote IP')
            .setValue(this.plugin.settings.remoteIP)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.remoteIP = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(settingsContainer)
            .setName('SSH Port')
            .setDesc('SSH port to connect to the remote machine')
            .addText(text => text
            .setPlaceholder('Enter SSH port')
            .setValue(this.plugin.settings.sshPort.toString())
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.sshPort = parseInt(value);
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(settingsContainer)
            .setName('SSH Username')
            .setDesc('SSH username for remote connection')
            .addText(text => text
            .setPlaceholder('Enter SSH username')
            .setValue(this.plugin.settings.sshUsername)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.sshUsername = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(settingsContainer)
            .setName('SSH Password')
            .setDesc('SSH password for remote connection')
            .addText(text => text
            .setPlaceholder('Enter SSH password')
            .setValue(this.plugin.settings.sshPassword)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.sshPassword = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(settingsContainer)
            .setName('Private Key Path')
            .setDesc('Path to the SSH private key')
            .addText(text => text
            .setPlaceholder('Enter private key path')
            .setValue(this.plugin.settings.privateKeyPath)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.privateKeyPath = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(settingsContainer)
            .setName('Local Directory Path')
            .setDesc('Directory in the local machine to sync')
            .addText(text => text
            .setPlaceholder('Enter local directory path')
            .setValue(this.plugin.settings.localDirPath)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.localDirPath = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(settingsContainer)
            .setName('Remote Directory Path')
            .setDesc('Directory in the remote machine to sync')
            .addText(text => text
            .setPlaceholder('Enter remote directory path')
            .setValue(this.plugin.settings.remoteDirPath)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.remoteDirPath = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(settingsContainer)
            .setName('Dry Run')
            .setDesc('Perform a trial run with no changes made')
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.dryRun)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.dryRun = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(settingsContainer)
            .setName('Log File Path')
            .setDesc('File to save sync logs')
            .addText(text => text
            .setPlaceholder('Enter log file path')
            .setValue(this.plugin.settings.logFilePath)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.logFilePath = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(settingsContainer)
            .setName('Exclude Patterns')
            .setDesc('Patterns to be excluded from sync')
            .addTextArea(textArea => textArea
            .setValue(this.plugin.settings.excludePatterns.join('\n'))
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.excludePatterns = value.split('\n');
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(settingsContainer)
            .setName('Schedule Interval (in minutes)')
            .setDesc('Interval for triggering periodic sync')
            .addText(text => text
            .setPlaceholder('Enter schedule interval in minutes')
            .setValue(this.plugin.settings.scheduleInterval.toString())
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.scheduleInterval = parseInt(value);
            yield this.plugin.saveSettings();
        })));
    }
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
    updateProgress(percentage) {
        if (this.progressBar) {
            const progressElement = this.progressBar.querySelector('progress');
            if (progressElement) {
                progressElement.value = percentage;
            }
        }
    }
}
class RsyncPluginSettingTab extends obsidian_1.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Rsync Plugin Settings' });
        new obsidian_1.Setting(containerEl)
            .setName('Rsync Binary Path')
            .setDesc('Path to the rsync binary')
            .addText((text) => text
            .setPlaceholder('Enter path')
            .setValue(this.plugin.settings.rsyncBinaryPath)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.rsyncBinaryPath = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(containerEl)
            .setName('Remote IP Address')
            .setDesc('IP address of the remote machine')
            .addText((text) => text
            .setPlaceholder('Enter remote IP')
            .setValue(this.plugin.settings.remoteIP)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.remoteIP = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(containerEl)
            .setName('SSH Port')
            .setDesc('SSH port to connect to the remote machine')
            .addText((text) => text
            .setPlaceholder('Enter SSH port')
            .setValue(this.plugin.settings.sshPort.toString())
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.sshPort = parseInt(value);
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(containerEl)
            .setName('SSH Username')
            .setDesc('SSH username for remote connection')
            .addText((text) => text
            .setPlaceholder('Enter SSH username')
            .setValue(this.plugin.settings.sshUsername)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.sshUsername = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(containerEl)
            .setName('SSH Password')
            .setDesc('SSH password for remote connection')
            .addText((text) => text
            .setPlaceholder('Enter SSH password')
            .setValue(this.plugin.settings.sshPassword)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.sshPassword = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(containerEl)
            .setName('Private Key Path')
            .setDesc('Path to the SSH private key')
            .addText((text) => text
            .setPlaceholder('Enter private key path')
            .setValue(this.plugin.settings.privateKeyPath)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.privateKeyPath = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(containerEl)
            .setName('Local Directory Path')
            .setDesc('Directory in the local machine to sync')
            .addText((text) => text
            .setPlaceholder('Enter local directory path')
            .setValue(this.plugin.settings.localDirPath)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.localDirPath = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(containerEl)
            .setName('Remote Directory Path')
            .setDesc('Directory in the remote machine to sync')
            .addText((text) => text
            .setPlaceholder('Enter remote directory path')
            .setValue(this.plugin.settings.remoteDirPath)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.remoteDirPath = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(containerEl)
            .setName('Dry Run')
            .setDesc('Perform a trial run with no changes made')
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.dryRun)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.dryRun = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(containerEl)
            .setName('Log File Path')
            .setDesc('File to save sync logs')
            .addText(text => text
            .setPlaceholder('Enter log file path')
            .setValue(this.plugin.settings.logFilePath)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.logFilePath = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(containerEl)
            .setName('Exclude Patterns')
            .setDesc('Patterns to be excluded from sync')
            .addTextArea(textArea => textArea
            .setValue(this.plugin.settings.excludePatterns.join('\n'))
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.excludePatterns = value.split('\n');
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(containerEl)
            .setName('Schedule Interval')
            .setDesc('Interval in minutes for triggering periodic sync')
            .addText(text => text
            .setPlaceholder('Enter schedule interval')
            .setValue(this.plugin.settings.scheduleInterval.toString())
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.scheduleInterval = parseInt(value);
            yield this.plugin.saveSettings();
        })));
    }
}
