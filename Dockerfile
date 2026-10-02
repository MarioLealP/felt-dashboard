# WP-42.2: the Felt app as static files, served by a small Caddy at
# /app/. The real front door (TLS, SSO forward-auth) is clockmost's Caddy.
FROM node:24-alpine AS build
WORKDIR /src
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM caddy:2.11.4-alpine
# The stock binary carries cap_net_bind_service as a file capability; with
# cap_drop ALL + no-new-privileges (felt-app's compose) the kernel refuses to
# exec it. We listen on 8080, so strip the capability instead of loosening.
RUN apk add --no-cache libcap \
    && setcap -r /usr/bin/caddy \
    && apk del libcap
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/dist /srv/app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/app/ || exit 1
