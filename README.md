# Code Runner

This extension allows running JavaScript code from code blocks in chat.

If you can't see an execution button, edit the codeblock and specify the language manually after the opening triple backticks.

> \`\`\` => \`\`\`js

Calls to `console` and `alert` are redirected to the output block below the code.

To display anything in the final result, use `return` as the last statement.

## Security

The execution is sandboxed using [SandboxJS](https://github.com/nyariv/SandboxJS), but please don't run anything that looks too sussy.
