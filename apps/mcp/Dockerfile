# Extends from Node.js 24, the version used by the CI
FROM node:24-slim AS build

# Husky installs Git hooks, which make no sense in an image
ENV HUSKY=0

WORKDIR /source

# Copying only what installing the dependencies needs, so this layer stays cached while the
# lockfile does not change. The postinstall script of the workspace needs the one of the web app
COPY package.json package-lock.json ./
COPY apps/web/scripts/copy-opencv.mjs apps/web/scripts/

RUN npm ci

COPY . .

# Building the server and the library it depends on, then packing the library, so the image
# uses the one of this commit instead of the one published to npm
RUN NX_DAEMON=false npx nx build mcp \
  && npm pack ./dist/libs/core --pack-destination /source/dist

FROM node:24-slim

ENV NODE_ENV=production

# Configured through the environment instead of arguments, so `docker run -e` can change it
ENV DOCSCANIFY_MCP_TRANSPORT=http \
  DOCSCANIFY_MCP_HOST=0.0.0.0 \
  DOCSCANIFY_MCP_PORT=3000

WORKDIR /app

COPY --from=build /source/dist/apps/mcp ./
COPY --from=build /source/dist/devantage-docscanify-*.tgz /tmp/

# Installing the dependencies of the server, with the packed library in place of the published one.
# None of them needs install scripts: the native canvas module ships prebuilt binaries
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund /tmp/devantage-docscanify-*.tgz \
  && rm /tmp/devantage-docscanify-*.tgz \
  && npm cache clean --force

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.DOCSCANIFY_MCP_PORT + '/health').then((response) => process.exit(response.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "src/main.js"]
