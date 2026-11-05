![Logo](https://s3.devantage.com.br/devantage-public/logo-100x100.png)

# DocScanify

Detect, crop and correct the perspective of documents in images on Node.js and browsers, and output them as images or PDFs.

# Packages

| Path                   | Package                                                                        | Description                                                         |
| ---------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| [libs/core](libs/core) | [`@devantage/docscanify`](https://www.npmjs.com/package/@devantage/docscanify) | The library published to npm; see its [README](libs/core/README.md) |

## Development

```bash
npm install            # installs every dependency, at the root
npm run build:all      # builds every project into dist/
npm run test:all       # tests every project
npm run lint:all       # lints every project, fixing what it can
npm run format         # formats the workspace with Prettier
```

To run a target in a single project, pass the project: `npm run build core`, `npm run test core`, `npm run lint core`, or `npx nx <target> <project>` for any other target. To run only what a change affects, use `npx nx affected -t test`, and to see how the projects depend on each other, use `npx nx graph`.

## Releases

Pushing a tag `v1.2.3` builds the library and publishes it to npm as `@devantage/docscanify`, with the `version` of `libs/core/package.json`. Bump it first, because npm rejects a version that was already published.

## License

This repository is licensed under [MIT](LICENSE.md) terms.
