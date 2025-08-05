// scripts/ui_components.js

/**
 * @class UIComponents
 * @classdesc A factory class for creating standardized, reusable UI components
 * such as windows, buttons, and application shells. This ensures a consistent
 * look and feel across all applications in OopisOS.
 */
class UIComponents {
  /**
   * Creates an instance of UIComponents.
   */
  constructor() {
    /**
     * The dependency injection container.
     * @type {object}
     */
    this.dependencies = {};
  }

  /**
   * Sets the dependency injection container.
   * @param {object} dependencies - The dependencies to be injected, typically including `Utils`.
   */
  setDependencies(dependencies) {
    this.dependencies = dependencies;
  }

  /**
   * Creates a draggable window component for the desktop environment.
   * @param {string} title - The text to display in the window's title bar.
   * @param {HTMLElement} contentElement - The main content element to place inside the window.
   * @param {object} [callbacks={}] - Callbacks for window events.
   * @param {Function} [callbacks.onFocus] - Called when the window is focused (e.g., clicked).
   * @param {Function} [callbacks.onClose] - Called when the close button is clicked.
   * @returns {HTMLElement} The complete, draggable window element.
   */
  createWindowComponent(title, contentElement, callbacks = {}) {
    const { onFocus, onClose } = callbacks;
    const { Utils } = this.dependencies;

    const titleSpan = Utils.createElement('span', { className: 'window-title', textContent: title });
    const closeBtn = this.createButton({ text: '×', classes: ['window-close-btn'], onClick: onClose });
    const header = Utils.createElement('header', { className: 'window-header' }, [titleSpan, closeBtn]);
    const content = Utils.createElement('div', { className: 'window-content' }, [contentElement]);
    const windowDiv = Utils.createElement('div', { className: 'app-window' }, [header, content]);

    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      offsetX = e.clientX - windowDiv.offsetLeft;
      offsetY = e.clientY - windowDiv.offsetTop;
      if (onFocus) onFocus();
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        windowDiv.style.left = `${e.clientX - offsetX}px`;
        windowDiv.style.top = `${e.clientY - offsetY}px`;
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    return windowDiv;
  }

  /**
   * Creates a standard application shell for full-screen modal apps.
   * @param {string} title - The title of the application.
   * @param {Function} onExit - The callback function to execute when the exit button is clicked.
   * @param {object} [options={}] - Additional options (currently unused).
   * @returns {{container: HTMLElement, header: HTMLElement, main: HTMLElement, footer: HTMLElement}} An object containing the main container and its sections.
   */
  createAppWindow(title, onExit, options = {}) {
    const { Utils } = this.dependencies;

    const exitBtn = this.createButton({
      text: '×',
      title: 'Exit Application (Esc)',
      classes: ['app-header__exit-btn'],
      onClick: onExit
    });

    const header = Utils.createElement('header', { className: 'app-header' }, [
      Utils.createElement('h2', { className: 'app-header__title', textContent: title }),
      exitBtn
    ]);

    const main = Utils.createElement('main', { className: 'app-main' });
    const footer = Utils.createElement('footer', { className: 'app-footer' });

    const container = Utils.createElement('div', {
      id: `${title.toLowerCase().replace(/\s+/g, '-')}-app-container`,
      className: 'app-container'
    }, [header, main, footer]);

    return { container, header, main, footer };
  }

  /**
   * Creates a standardized button element.
   * @param {object} [options={}] - Configuration options for the button.
   * @param {string} [options.text] - The text content of the button.
   * @param {Function} [options.onClick] - The click event handler.
   * @param {string[]} [options.classes=[]] - An array of additional CSS classes.
   * @param {string|null} [options.id=null] - The ID for the button element.
   * @param {string|null} [options.title=null] - The tooltip text for the button.
   * @param {string|null} [options.icon=null] - An icon character to display on the button.
   * @returns {HTMLButtonElement} The created button element.
   */
  createButton(options = {}) {
    const { Utils } = this.dependencies;
    const { text, onClick, classes = [], id = null, title = null, icon = null } = options;
    const btnClasses = ["btn", ...classes];

    const content = [];
    if (icon) {
      content.push(Utils.createElement('span', { className: 'btn-icon', textContent: icon }));
    }
    if (text) {
      content.push(document.createTextNode(text));
    }

    const attributes = {
      className: btnClasses.join(" "),
    };
    if (id) attributes.id = id;
    if (title) attributes.title = title;
    if (onClick) attributes.eventListeners = { click: onClick };

    return Utils.createElement("button", attributes, content);
  }
}