# Extends from Node.js 24, the version used by the CI
FROM node:24-slim AS build

# Husky installs Git hooks, which make no sense in an image
ENV HUSKY=0

# Setting working directory to /source
WORKDIR /source

# Copying only what installing the dependencies needs, so this layer stays cached while the
# lockfile does not change. The postinstall script copies opencv.js to apps/web/public/
COPY package.json package-lock.json ./
COPY apps/web/scripts/copy-opencv.mjs apps/web/scripts/

# Installing the dependencies exactly as locked
RUN npm ci

# Copying the source code
COPY . .

# Building the app (and the library it depends on) into dist/apps/web
RUN NX_DAEMON=false npx nx build web

FROM nginx:stable-alpine

# Replacing the default site with the one of the app: caching rules for the service worker
# and the hashed assets, and compression
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Setting working directory to the site
WORKDIR /usr/share/nginx/html

# Copying the built app: a static site
COPY --from=build /source/dist/apps/web /usr/share/nginx/html

# Creating app user
RUN addgroup --gid 1001 -S nginx_group && adduser --uid 1001 -S nginx_user -G nginx_group

# Setting the ownership of what nginx writes to
RUN chown -R nginx_user:nginx_group /usr/share/nginx /var/cache/nginx /run

# Setting container user
USER nginx_user

# Exposing application port
EXPOSE 80

# Running nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
