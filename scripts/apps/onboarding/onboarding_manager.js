// scripts/apps/onboarding/onboarding_manager.js

window.OnboardingManager = class OnboardingManager extends App {
    constructor() {
        super();
        this.state = {};
        this.dependencies = {};
        this.callbacks = {};
        this.ui = null;
    }

    enter(appLayer, options = {}) {
        if (this.isActive) return;
        this.dependencies = options.dependencies;
        this.callbacks = this._createCallbacks();
        this.isActive = true;

        this.state = {
            step: 1,
            maxSteps: 3,
            userData: {
                username: '',
                password: '',
                rootPassword: ''
            },
            error: null,
        };

        this.ui = new window.OnboardingUI(this.state, this.callbacks, this.dependencies);
        this.container = this.ui.getContainer();
        appLayer.appendChild(this.container);
        this.container.focus();
    }

    exit() {
        // Normally we don't allow exiting onboarding, but this is a failsafe.
        if (!this.isActive) return;
        if (this.ui) this.ui.hideAndReset();
        this.dependencies.AppLayerManager.hide(this);
        this.isActive = false;
    }

    _createCallbacks() {
        const { UserManager, Utils, ErrorHandler, StorageManager, Config, GroupManager } = this.dependencies;
        return {
            onNextStep: async (data) => {
                this.state.error = null; // Clear previous errors
                // --- Step Validation ---
                if (this.state.step === 1) { // Create User Account
                    const { username, password, confirmPassword } = data;
                    const validationResult = JSON.parse(await OopisOS_Kernel.syscall("users", "validate_username_format", [username]));

                    if (!validationResult.success) {
                        this.state.error = validationResult.error;
                    } else if (!password || password.length < 4) {
                        this.state.error = "Password must be at least 4 characters long.";
                    } else if (password !== confirmPassword) {
                        this.state.error = "Passwords do not match.";
                    }
                    if (this.state.error) {
                        this.ui.update(this.state);
                        return;
                    }
                    this.state.userData.username = username;
                    this.state.userData.password = password;
                } else if (this.state.step === 2) { // Set Root Password
                    const { rootPassword, confirmRootPassword } = data;
                    if (!rootPassword || rootPassword.length < 4) {
                        this.state.error = "Root password must be at least 4 characters long.";
                    } else if (rootPassword !== confirmRootPassword) {
                        this.state.error = "Passwords do not match.";
                    }
                    if (this.state.error) {
                        this.ui.update(this.state);
                        return;
                    }
                    this.state.userData.rootPassword = rootPassword;
                }

                // --- Advance Step ---
                if (this.state.step < this.state.maxSteps) {
                    this.state.step++;
                    this.ui.update(this.state);
                }
            },
            onFinish: async () => {
                this.ui.showSpinner();
                const result = await UserManager.performFirstTimeSetup(this.state.userData);

                if (result.success && result.data) {
                    // Save the NEW, updated user and group data from Python
                    StorageManager.saveItem(Config.STORAGE_KEYS.USER_CREDENTIALS, result.data.users, "User Credentials");
                    StorageManager.saveItem(Config.STORAGE_KEYS.USER_GROUPS, result.data.groups, "User Groups");

                    StorageManager.saveItem(Config.STORAGE_KEYS.ONBOARDING_COMPLETE, true, "Onboarding Status");
                    StorageManager.saveItem(Config.STORAGE_KEYS.LAST_CREATED_USER, this.state.userData.username, "Last Created User");

                    this.ui.update({ ...this.state, step: 'complete' });

                    setTimeout(() => {
                        window.location.reload();
                    }, 3000);
                } else {
                    const errorMessage = typeof result.error === 'object' && result.error.message
                        ? result.error.message
                        : result.error;
                    this.state.error = `Setup failed: ${errorMessage || 'An unknown error occurred.'}`;
                    this.state.step = 1;
                    this.state.userData = { username: '', password: '', rootPassword: '' };
                    this.ui.update(this.state);
                    this.ui.hideSpinner();
                }
            },
        };
    }
};