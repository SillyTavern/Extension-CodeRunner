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
 * @param {HTMLElement} block
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
 * @param {HTMLElement} block
 * @returns {{outputElement: HTMLElement, clearClicked: Promise<any>}}
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

function showLoader(outputElement) {
    const loader = outputElement.querySelector('.code-output-hourglass');
    if (!loader) {
        return;
    }
    loader.style.display = 'block';
}

function hideLoader(outputElement) {
    const loader = outputElement.querySelector('.code-output-hourglass');
    if (!loader) {
        return;
    }
    loader.style.display = 'none';
}

class CustomConsole {
    constructor(outputElement) {
        this.#setupShims();
        this.outputElement = outputElement;
    }

    #setupShims() {
        for (const key of Object.keys(console)) {
            if (typeof console[key] === 'function' && !this[key]) {
                this[key] = () => { };
            }
        }
    }

    #addToOutput(args) {
        const div = document.createElement('div');
        let text = '';
        for (const arg of args) {
            switch (typeof arg) {
                case 'object':
                    text += JSON.stringify(arg);
                    break;
                default:
                    text += String(arg);
                    break;
            }
            text += ' ';
        }
        div.textContent = text;
        this.outputElement.appendChild(div);
    }

    info(...args) {
        this.#addToOutput(args);
    }

    log(...args) {
        this.#addToOutput(args);
    }

    error(...args) {
        this.#addToOutput(args);
    }

    warn(...args) {
        this.#addToOutput(args);
    }

    debug(...args) {
        this.#addToOutput(args);
    }

    alert(...args) {
        this.#addToOutput(args);
    }

    addResult(result) {
        const div = document.createElement('div');
        const small = document.createElement('small');
        small.textContent = `Result: ${JSON.stringify(result)}`;
        div.appendChild(small);
        this.outputElement.appendChild(div);
    }
}

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
        const result = await Promise.race([execAsync(scope).run(), clearClicked]);
        hideLoader(outputElement);
        if (result === clearedSymbol) {
            return;
        }
        customConsole.addResult(result);
    } catch (error) {
        console.error('Error running code', error);
        toastr.error('Error running code', error.message);
    }
}
