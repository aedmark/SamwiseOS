// scripts/apps/onboarding/onboarding_ui.js

window.OnboardingUI = class OnboardingUI {
    constructor(initialState, callbacks, dependencies) {
        this.elements = {};
        this.callbacks = callbacks;
        this.dependencies = dependencies;
        this._buildAndShow(initialState);
    }

    getContainer() {
        return this.elements.container;
    }

    hideAndReset() {
        if (this.elements.container) this.elements.container.remove();
        this.elements = {};
    }

    _buildAndShow(initialState) {
        const { Utils } = this.dependencies;
        this.elements.container = Utils.createElement('div', { id: 'onboarding-container', className: 'onboarding-container' });
        this.elements.card = Utils.createElement('div', { className: 'onboarding-card' });
        this.elements.container.appendChild(this.elements.card);
        this.update(initialState);
    }

    update(state) {
        this.elements.card.innerHTML = ''; // Clear previous content
        switch (state.step) {
            case 1: this._renderStep1(state); break;
            case 2: this._renderStep2(state); break;
            case 3: this._renderStep3(state); break;
            case 'complete': this._renderComplete(state); break;
        }
    }

    showSpinner() {
        const { Utils } = this.dependencies;
        this.elements.spinner = Utils.createElement('div', { className: 'onboarding-spinner' });
        this.elements.card.appendChild(this.elements.spinner);
    }

    hideSpinner() {
        if (this.elements.spinner) {
            this.elements.spinner.remove();
            this.elements.spinner = null;
        }
    }

    _renderStep1(state) {
        const { Utils } = this.dependencies;
        const form = Utils.createElement('form');
        const usernameInput = Utils.createElement('input', { type: 'text', placeholder: 'Username', required: true, name: 'username' });
        const passwordInput = Utils.createElement('input', { type: 'password', placeholder: 'Password', required: true, name: 'password' });
        const confirmInput = Utils.createElement('input', { type: 'password', placeholder: 'Confirm Password', required: true, name: 'confirmPassword' });
        const nextButton = Utils.createElement('button', { type: 'submit', textContent: 'Next →' });

        form.append(
            Utils.createElement('h1', { textContent: 'Welcome to SamwiseOS' }),
            Utils.createElement('p', { textContent: 'Let\'s start by creating your main user account.' }),
            usernameInput,
            passwordInput,
            confirmInput,
            nextButton
        );

        if (state.error) {
            form.prepend(Utils.createElement('div', { className: 'onboarding-error', textContent: state.error }));
        }

        form.onsubmit = (e) => {
            e.preventDefault();
            this.callbacks.onNextStep({
                username: usernameInput.value,
                password: passwordInput.value,
                confirmPassword: confirmInput.value
            });
        };

        this.elements.card.append(this._createHeader(state), form);
        usernameInput.focus();
    }

    _renderStep2(state) {
        const { Utils } = this.dependencies;
        const form = Utils.createElement('form');
        const rootPasswordInput = Utils.createElement('input', { type: 'password', placeholder: 'Root Password', required: true, name: 'rootPassword' });
        const confirmRootInput = Utils.createElement('input', { type: 'password', placeholder: 'Confirm Root Password', required: true, name: 'confirmRootPassword' });
        const nextButton = Utils.createElement('button', { type: 'submit', textContent: 'Next →' });

        form.append(
            Utils.createElement('h1', { textContent: 'Set Root Password' }),
            Utils.createElement('p', { textContent: 'The "root" user has full administrative privileges. Secure it with a strong password.' }),
            rootPasswordInput,
            confirmRootInput,
            nextButton
        );

        if (state.error) {
            form.prepend(Utils.createElement('div', { className: 'onboarding-error', textContent: state.error }));
        }

        form.onsubmit = (e) => {
            e.preventDefault();
            this.callbacks.onNextStep({
                rootPassword: rootPasswordInput.value,
                confirmRootPassword: confirmRootInput.value
            });
        };

        this.elements.card.append(this._createHeader(state), form);
        rootPasswordInput.focus();
    }

    _renderStep3(state) {
        const { Utils } = this.dependencies;
        const finishButton = Utils.createElement('button', { textContent: 'Finish & Reboot' });
        finishButton.onclick = this.callbacks.onFinish;

        const summary = Utils.createElement('div', { className: 'onboarding-summary' }, [
            Utils.createElement('h1', { textContent: 'Setup Complete!' }),
            Utils.createElement('p', { textContent: 'Review your setup details below. Click "Finish & Reboot" to start your SamwiseOS session.' }),
            Utils.createElement('ul', {}, [
                Utils.createElement('li', { innerHTML: `<b>Primary User:</b> ${state.userData.username}` }),
                Utils.createElement('li', { innerHTML: '<b>User Password:</b> Set' }),
                Utils.createElement('li', { innerHTML: '<b>Root Password:</b> Set' }),
            ]),
            finishButton
        ]);

        this.elements.card.append(this._createHeader(state), summary);
        finishButton.focus();
    }

    _renderComplete(state) {
        const { Utils } = this.dependencies;
        const completeMessage = Utils.createElement('div', {}, [
            Utils.createElement('h1', { textContent: 'All Set!' }),
            Utils.createElement('p', { textContent: 'Your system is being configured. SamwiseOS will reboot shortly.' })
        ]);
        this.elements.card.append(completeMessage);
    }

    _createHeader(state) {
        const { Utils } = this.dependencies;
        const progress = Utils.createElement('div', { className: 'onboarding-progress' });
        for (let i = 1; i <= state.maxSteps; i++) {
            const stepClass = i < state.step ? 'complete' : (i === state.step ? 'active' : '');
            progress.append(Utils.createElement('div', { className: `step-indicator ${stepClass}` }));
        }
        return Utils.createElement('header', { className: 'onboarding-header' }, progress);
    }
};