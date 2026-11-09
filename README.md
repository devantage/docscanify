![Logo](https://s3.devantage.com.br/devantage-public/logo-100x100.png)

# DocScanify

Detect, crop and correct the perspective of documents in images on Node.js and browsers, and output them as images or PDFs.

# Packages

| Path                             | Package                                                                                      | Description                                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [libs/core](libs/core)           | [`@devantage/docscanify`](https://www.npmjs.com/package/@devantage/docscanify)               | The library published to npm; see its [README](libs/core/README.md)                                          |
| [libs/n8n-nodes](libs/n8n-nodes) | [`@devantage/n8n-nodes-scanify`](https://www.npmjs.com/package/@devantage/n8n-nodes-scanify) | n8n community node that scans documents with the library; see its [README](libs/n8n-nodes/README.md)         |
| [apps/web](apps/web)             |                                                                                              | The web app that scans documents in the browser; see its [README](apps/web/README.md)                        |
| [apps/mcp](apps/mcp)             | [`@devantage/docscanify-mcp`](https://www.npmjs.com/package/@devantage/docscanify-mcp)       | MCP server that scans documents for any MCP client, over stdio or HTTP; see its [README](apps/mcp/README.md) |

## Development

```bash
npm install            # installs every dependency, at the root
npm run build:all      # builds every project into dist/
npm run test:all       # tests every project
npm run lint:all       # lints every project, fixing what it can
npm run format:all     # formats every project with Prettier
```

To run n8n locally with the node loaded, use `npx nx serve n8n-nodes` (http://localhost:5678). To run the MCP server over HTTP, use `npx nx serve mcp` (http://127.0.0.1:3000/mcp).

To run a target in a single project, pass the project: `npm run build core`, `npm run test core`, `npm run lint web`, or `npx nx <target> <project>` for any other target, such as `npx nx dev web`. To run only what a change affects, use `npx nx affected -t test`, and to see how the projects depend on each other, use `npx nx graph`.

## Releases

Each project is released by its own tag, which must match the `version` of its `package.json`, because npm rejects a version that was already published:

- `core-v1.2.3` publishes `@devantage/docscanify` (libs/core) to npm.
- `n8n-nodes-v1.2.3` publishes `@devantage/n8n-nodes-docscanify` (libs/n8n-nodes) to npm.
- `mcp-v1.2.3` publishes `@devantage/docscanify-mcp` (apps/mcp) to npm and its [image](apps/mcp/README.md#installation) to the GitHub Container Registry.
- `web-v1.2.3` publishes the [image of the web app](apps/web/README.md#docker) to the GitHub Container Registry.

The n8n node and the MCP server depend on the published library, so release the library first when they need a new version of it.

## License

This repository is licensed under [MIT](LICENSE.md) terms.
