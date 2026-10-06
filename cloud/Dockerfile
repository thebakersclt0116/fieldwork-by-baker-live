# Build from the repository root: docker build -f cloud/Dockerfile .
# The major-version tag accepts Node 24 security updates. Pin an observed digest
# in a reviewed release if immutable base-image reproduction is required.
FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# .dockerignore allows only the cloud TypeScript build inputs and lockfile.
COPY . .
RUN npm run cloud:build \
    && node --input-type=module -e "import { cpSync, statSync } from 'node:fs'; cpSync('cloud', 'dist-cloud/cloud', { recursive: true, filter: (path) => statSync(path).isDirectory() || path.endsWith('.sql') });" \
    && npm prune --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist-cloud ./dist-cloud

USER node
EXPOSE 8080
# Start Node directly so it receives shutdown signals. Migrations are explicit.
CMD ["node", "dist-cloud/cloud/server.js"]
