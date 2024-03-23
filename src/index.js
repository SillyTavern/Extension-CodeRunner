/* global SillyTavern */
/* global toastr */
import './style.css';
import Sandbox from '@nyariv/sandboxjs';

const {
    eventSource,
    event_types,
} = SillyTavern.getContext();

const events = [
    event_types.CHARACTER_MESSAGE_RENDERED,
    event_types.USER_MESSAGE_RENDERED,
    event_types.CHAT_CHANGED,
    event_types.MESSAGE_EDITED,
    event_types.MESSAGE_SWIPED,
];

const clearedSymbol = Symbol('cancel');

// Set event listeners for chat events.
for (const event of events) {
    eventSource.on(event, addExecuteButtonToCodeBlocks);
}

/**
 * Adds a button to all JS code blocks to run the code.
 */
function addExecuteButtonToCodeBlocks() {
    const blocks = Array.from(document.querySelectorAll('#chat pre code'));
    for (const block of blocks) {
        if (block.classList.contains('code-runner')) {
            continue;
        }
        if (block.classList.contains('language-javascript')) {
            addExecuteButton(block);
            block.classList.add('code-runner');
        }
    }
}

/**
 * Adds a button to the code block to run the code.
 * @param {HTMLElement} block Code block element.
 */
function addExecuteButton(block) {
    const button = document.createElement('i');
    button.title = 'Run code';
    button.classList.add('code-runner-button', 'fa-solid', 'fa-play');
    button.addEventListener('click', () => runCode(block));
    block.appendChild(button);
}

/**
 * Get the output element for the code block.
 * @param {HTMLElement} block Code block element.
 * @returns {{outputElement: HTMLElement, clearClicked: Promise<Symbol>}} Output element and promise that resolves when the clear button is clicked.
 */
function getOutputElement(block) {
    let outputElement = block.parentElement.querySelector('.code-output');
    if (!outputElement) {
        outputElement = document.createElement('blockquote');
        outputElement.classList.add('code-output');
        block.parentElement.appendChild(outputElement);
    }
    outputElement.innerHTML = '';
    const loader = document.createElement('i');
    loader.classList.add('code-output-hourglass', 'fa-solid', 'fa-hourglass', 'fa-2x');
    loader.style.display = 'none';
    const clearButton = document.createElement('i');
    clearButton.classList.add('code-output-clear', 'fa-solid', 'fa-xmark', 'fa-fw');
    clearButton.title = 'Clear output';
    clearButton.onclick = () => {
        outputElement.remove();
    };
    outputElement.appendChild(clearButton);
    outputElement.appendChild(loader);
    const clearClicked = new Promise((resolve) => {
        clearButton.addEventListener('click', () => resolve(clearedSymbol), { once: true });
    });
    return { outputElement, clearClicked };
}

/**
 * Shows the loader icon in the output element.
 * @param {HTMLElement} outputElement Output element.
 * @returns {void}
 */
function showLoader(outputElement) {
    const loader = outputElement.querySelector('.code-output-hourglass');
    if (!loader) {
        return;
    }
    loader.style.display = 'block';
}

/**
 * Hides the loader icon in the output element.
 * @param {HTMLElement} outputElement Output element.
 * @returns {void}
 */
function hideLoader(outputElement) {
    const loader = outputElement.querySelector('.code-output-hourglass');
    if (!loader) {
        return;
    }
    loader.style.display = 'none';
}

/**
 * Proxy console methods to add code output to the output element.
 */
class CustomConsole {
    /**
     * Creates a new CustomConsole instance.
     * @param {HTMLElement} outputElement Output element to log to.
     */
    constructor(outputElement) {
        this.#setupShims();
        this.outputElement = outputElement;
    }

    /**
     * Setup shims for console methods that are not implemented.
     */
    #setupShims() {
        for (const key of Object.keys(console)) {
            if (typeof console[key] === 'function' && !this[key]) {
                this[key] = () => { };
            }
        }
    }

    /**
     * Add the output text to the output element.
     * @param {any[]} args Arguments to log.
     * @returns {void}
     */
    #addToOutput(args) {
        const div = document.createElement('div');
        const text = args.reduce((acc, arg) => {
            switch (typeof arg) {
                case 'object':
                    return acc + JSON.stringify(arg) + ' ';
                default:
                    return acc + String(arg) + ' ';
            }
        }, '');
        div.textContent = text;
        this.outputElement.appendChild(div);
    }

    /**
     * Proxy for console.info.
     * @param  {...any} args Arguments to log.
     * @returns {void}
     */
    info(...args) {
        this.#addToOutput(args);
    }

    /**
     * Proxy for console.log.
     * @param  {...any} args Arguments to log.
     * @returns {void}
     */
    log(...args) {
        this.#addToOutput(args);
    }

    /**
     * Proxy for console.error.
     * @param  {...any} args Arguments to log.
     */
    error(...args) {
        this.#addToOutput(args);
    }

    /**
     * Proxy for console.warn.
     * @param  {...any} args Arguments to log.
     */
    warn(...args) {
        this.#addToOutput(args);
    }

    /**
     * Proxy for console.debug.
     * @param  {...any} args Arguments to log.
     */
    debug(...args) {
        this.#addToOutput(args);
    }

    /**
     * Proxy for console.table.
     * @param  {...any} args Arguments to log.
     */
    table(...args) {
        this.#addToOutput(args);
    }

    /**
     * Proxy for console.trace.
     * @param  {...any} args Arguments to log.
     * @returns {void}
     */
    trace(...args) {
        this.#addToOutput(args);
    }

    /**
     * Proxy for alert.
     * @param  {...any} args Arguments to log.
     */
    alert(...args) {
        this.#addToOutput(args);
    }

    /**
     * Adds the passed time and result of the code to the output element.
     * @param {any} result Returned result of the code.
     * @param {number} time Milliseconds to run the code.
     */
    addResult(result, time) {
        const div = document.createElement('div');
        const small = document.createElement('small');
        const seconds = (time / 1000).toFixed(2);
        small.textContent = `Finished in ${seconds} sec. Result: ${JSON.stringify(result)}`;
        div.appendChild(small);
        this.outputElement.appendChild(div);
    }
}

/**
 * Runs the code in the code block.
 * @param {HTMLElement} block Code block element.
 * @returns {Promise<void>} Promise that resolves when the code is run.
 */
async function runCode(block) {
    try {
        const { outputElement, clearClicked } = getOutputElement(block);
        showLoader(outputElement);
        const customConsole = new CustomConsole(outputElement);
        const code = block.textContent;
        const prototypeWhitelist = Sandbox.SAFE_PROTOTYPES;
        prototypeWhitelist.set(CustomConsole, new Set());
        const globals = {
            ...Sandbox.SAFE_GLOBALS,
            alert: customConsole.alert.bind(customConsole),
            console: customConsole,
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
            setInterval: setInterval,
            clearInterval: clearInterval,
        };
        const sandbox = new Sandbox({ globals, prototypeWhitelist });
        const scope = {};
        const execAsync = sandbox.compileAsync(code);
        const start = Date.now();
        const result = await Promise.race([execAsync(scope).run(), clearClicked]);
        const end = Date.now();
        hideLoader(outputElement);
        if (result === clearedSymbol) {
            return;
        }
        customConsole.addResult(result, (end - start));
    } catch (error) {
        console.error('Error running code', error);
        toastr.error('Error running code', error.message);
    }
}
