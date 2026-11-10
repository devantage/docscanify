/** Projects of the workspace, the only scopes a commit can have. */
const SCOPES = ['workspace', 'core', 'n8n-nodes', 'web', 'mcp'];

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-empty': [2, 'never'],
    'scope-enum': [2, 'always', SCOPES],
    'header-case': [2, 'always', 'lower-case'],
    'type-case': [2, 'always', 'lower-case'],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-case': [2, 'always', 'lower-case'],
    'body-case': [2, 'always', 'lower-case'],
  },
};
