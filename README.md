![Logo](https://s3.devantage.com.br/devantage-public/logo-100x100.png)

# DocScanify

Detect, crop and correct the perspective of documents in images on Node.js and browsers, and output them as images or PDFs.

# Packages

| Path                             | Package                                                                                      | Description                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [libs/core](libs/core)           | [`@devantage/docscanify`](https://www.npmjs.com/package/@devantage/docscanify)               | The library published to npm; see its [README](libs/core/README.md)                                  |
| [libs/n8n-nodes](libs/n8n-nodes) | [`@devantage/n8n-nodes-scanify`](https://www.npmjs.com/package/@devantage/n8n-nodes-scanify) | n8n community node that scans documents with the library; see its [README](libs/n8n-nodes/README.md) |
| [apps/web](apps/web)             |                                                                                              | The web app that scans documents in the browser; see its [README](apps/web/README.md)                |

## Development

```bash
npm install            # installs every dependency, at the root
npm run build:all      # builds every project into dist/
npm run test:all       # tests every project
npm run lint:all       # lints every project, fixing what it can
npm run format:all     # formats every project with Prettier
```

To run n8n locally with the node loaded, use `npx nx serve n8n-nodes` (http://localhost:5678).

To run a target in a single project, pass the project: `npm run build core`, `npm run test core`, `npm run lint web`, or `npx nx <target> <project>` for any other target, such as `npx nx dev web`. To run only what a change affects, use `npx nx affected -t test`, and to see how the projects depend on each other, use `npx nx graph`.

## Releases

- Pushing a tag `v1.2.3` builds both libraries and publishes them to npm: `@devantage/docscanify` (libs/core) and `@devantage/n8n-nodes-docscanify` (libs/n8n-nodes), each with the `version` of its own `package.json`. Bump both first, because npm rejects a version that was already published.
- Pushing a tag `v1.2.3` builds both libraries and publishes them to npm: `@devantage/docscanify` (libs/core) and `@devantage/n8n-nodes-scanify` (libs/n8n-nodes), each with the `version` of its own `package.json`. Bump both first, because npm rejects a version that was already published.
- Pushing a tag `web-v1.2.3` builds the [image of the web app](apps/web/README.md#docker) and publishes it to the GitHub Container Registry. The tag must match the `version` of `apps/web/package.json`.

## License

This repository is licensed under [MIT](LICENSE.md) terms.
