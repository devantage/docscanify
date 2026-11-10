![Logo](https://s3.devantage.com.br/devantage-public/logo-100x100.png)

# DocScanify MCP server

An [MCP](https://modelcontextprotocol.io) server that works like a "CamScanner": give it a photo of a document and get back only the document, cropped, with its perspective corrected, as a PDF or an image. It works with any MCP client, such as Claude Desktop, Claude Code, Codex or n8n, over **stdio** or **streamable HTTP**.

The scanning is done by [DocScanify](https://www.npmjs.com/package/@devantage/docscanify), which lives in the same repository.

[Installation](#installation)  
[Command line](#command-line)  
[Clients](#clients)  
[Tool](#tool)  
[Security](#security)  
[Development](#development)  
[License](#license)

## Installation

Run it with npx, with no install:

```bash
npx -y @devantage/docscanify-mcp
```

Or run the HTTP transport from the Docker image:

```bash
docker run -p 3000:3000 ghcr.io/devantage/docscanify/mcp
```

Requires Node.js 20 or later. The native module, [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas), ships prebuilt binaries for Linux (including Alpine), macOS and Windows. OpenCV.js is loaded on the first scan (about 1 s) and reused afterwards.

## Command line

```text
docscanify-mcp [--transport stdio|http] [--host 127.0.0.1] [--port 3000] [--path /mcp]
```

| Option        | Environment variable       | Default     | Description                                                    |
| ------------- | -------------------------- | ----------- | -------------------------------------------------------------- |
| `--transport` | `DOCSCANIFY_MCP_TRANSPORT` | `stdio`     | `stdio` for a local client, `http` for streamable HTTP         |
| `--host`      | `DOCSCANIFY_MCP_HOST`      | `127.0.0.1` | HTTP only. Host it listens on. The Docker image uses `0.0.0.0` |
| `--port`      | `DOCSCANIFY_MCP_PORT`      | `3000`      | HTTP only. Port it listens on                                  |
| `--path`      | `DOCSCANIFY_MCP_PATH`      | `/mcp`      | HTTP only. Path of the MCP endpoint                            |
| `--help`      |                            |             | Shows the help                                                 |
| `--version`   |                            |             | Shows the version                                              |

An option given in the command line wins over its environment variable, and an empty variable is ignored. The Docker image is configured through the environment variables, so they change it:

```bash
docker run -p 8080:8080 -e DOCSCANIFY_MCP_PORT=8080 ghcr.io/devantage/docscanify/mcp
```

With stdio, the server writes only the protocol to stdout, and its logs to stderr.

The HTTP transport is stateless: every request is answered on its own, so it can run behind a load balancer with any number of instances. It accepts only `POST` on the MCP endpoint, and requests of up to 64 MB, room for an image in base64. `GET /health` answers `{ "status": "ok" }`.

## Clients

### Claude Code

```bash
claude mcp add docscanify -- npx -y @devantage/docscanify-mcp
```

Or, with the HTTP transport running:

```bash
claude mcp add --transport http docscanify http://127.0.0.1:3000/mcp
```

### Claude Desktop

In `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "docscanify": {
      "command": "npx",
      "args": ["-y", "@devantage/docscanify-mcp"]
    }
  }
}
```

### Codex

In `~/.codex/config.toml`:

```toml
[mcp_servers.docscanify]
command = "npx"
args = ["-y", "@devantage/docscanify-mcp"]
```

### n8n and other HTTP clients

Point the MCP client to `http://<host>:3000/mcp`, with the streamable HTTP transport.

## Tool

### `scan_document`

Detects the document in an image, crops it, corrects its perspective, enhances and filters it, and returns it as a PDF or an image.

The image comes from exactly one of:

| Argument      | Description                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `imageBase64` | The image file in base64, or as a data URL (`data:image/jpeg;base64,...`)                       |
| `imageUrl`    | An `http` or `https` URL the server downloads it from, of up to 50 MB, in up to 30 s            |
| `imagePath`   | A path on the machine of the server. **stdio only**, since an HTTP server may be somewhere else |

The images can be JPG, PNG, WebP, AVIF, GIF, BMP and the other formats [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas) reads.

| Argument         | Default | Description                                                                                                                          |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `outputFormat`   | `pdf`   | `pdf` (document inside a PDF page) or `image` (only the scanned image)                                                               |
| `fileName`       |         | Name of the output file. Empty uses the image name with the extension of the output format, or `scan`                                |
| `filter`         | `none`  | `none`, `grayscale` or `bw` (document mode, adaptive threshold)                                                                      |
| `noiseReduction` | `false` | Smooths the noise, preserving the edges of the text                                                                                  |
| `sharpness`      | `off`   | `off`, `soft` or `strong`                                                                                                            |
| `rotation`       | `0`     | Rotates the scanned document clockwise: `0`, `90`, `180` or `270` degrees                                                            |
| `pageSize`       | `a4`    | PDF only. `a4`, `letter` or `image` (page sized to the image at 150 DPI)                                                             |
| `margin`         | `0`     | PDF only. Page margin in points                                                                                                      |
| `maxDimension`   | `3000`  | Downscales large photos before processing (at least 500)                                                                             |
| `jpegQuality`    | `85`    | Quality of the JPEG image, from 1 to 100 (does not apply to `bw`, which uses PNG)                                                    |
| `onNotDetected`  | `error` | `error` or `original` (uses the whole photo)                                                                                         |
| `outputPath`     |         | **stdio only**. Also saves the file: a file path, or a directory (an existing one, or ending with `/`) to save it in with `fileName` |

The document is cropped, then enhanced (noise, sharpness and rotation, in this order), then filtered. With the `image` output format, the result is a JPEG, or a PNG when the `bw` filter is used. PDFs embed the image the same way.

The result has:

- the file: an image as `image` content, which clients show, or a PDF as an embedded `resource` (`docscanify://scans/<fileName>`, in base64)
- the structured content, also as JSON text for clients that do not read structured content:

| Field      | Description                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `detected` | Whether a document was detected; when not, the whole image was used                                                             |
| `corners`  | `topLeft`, `topRight`, `bottomRight` and `bottomLeft` the document was cropped from, in pixels of the original image, or `null` |
| `width`    | Width of the scanned document, in pixels                                                                                        |
| `height`   | Height of the scanned document, in pixels                                                                                       |
| `mimeType` | MIME type of the output file                                                                                                    |
| `fileName` | Name of the output file                                                                                                         |
| `savedTo`  | Absolute path the file was saved to, when `outputPath` was given                                                                |
| `pdf`      | PDF only. How the document was laid out on the page, described below                                                            |

`pdf` describes the page in points (1 pt = 1/72 in), with `x` and `y` from the top left corner of the page:

```json
{
  "unit": "pt",
  "page": { "width": 595.28, "height": 841.89, "orientation": "portrait" },
  "image": { "x": 56.69, "y": 120.4, "width": 481.9, "height": 601.1 },
  "pixelsPerPoint": 1.68
}
```

`page` already accounts for landscape pages, used when the document is wider than it is tall, and `image` is where the document was drawn. Services that place fields on a PDF, such as e-signature platforms, ask for positions in points: a point found in the document image at `px`, `py` pixels is at `image.x + px / pixelsPerPoint`, `image.y + py / pixelsPerPoint` on the page. If a service measures `y` from the bottom of the page, use `page.height` minus that value.

When the scan fails, for example when no document is detected with `onNotDetected` set to `error`, the tool returns an error with the reason, and the server keeps running.

Detection works best with the document on a contrasting background and all 4 edges visible. See [how detection works](https://github.com/devantage/docscanify/tree/main/libs/core#how-detection-works).

## Security

The HTTP transport has **no authentication**. On `127.0.0.1` (the default), it accepts only requests addressed to `127.0.0.1`, `localhost` or `[::1]`, against DNS rebinding. Before exposing it to other machines:

- put it behind a proxy that authenticates the clients
- remember that `imageUrl` makes the server download any URL it is given, including ones of your internal network

With stdio, the server reads `imagePath` and writes `outputPath` with the permissions of the user that runs it.

## Development

From the root of the repository:

```bash
npx nx build mcp   # builds the server and the library into dist/
npx nx serve mcp   # builds and runs the HTTP transport on http://127.0.0.1:3000/mcp
npx nx test mcp
```

To try it with the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), build it and run:

```bash
NODE_PATH="$PWD/tmp/mcp/node-path" npx @modelcontextprotocol/inspector node dist/apps/mcp/src/main.js
```

`NODE_PATH` points to a link to `dist/libs/core`, created by `npx nx serve mcp`, so the built server finds the library of the repository instead of the published one.

### Releases

Pushing a tag `mcp-v1.2.3` publishes the package to npm and the [image](#installation) to the GitHub Container Registry, for amd64 and arm64. The tag must match the `version` of `apps/mcp/package.json`. The image uses the library of the same commit, but the npm package depends on the published `@devantage/docscanify`, so publish the library first when the server needs a new version of it.

## License

This package is licensed under [MIT](LICENSE.md) terms.
