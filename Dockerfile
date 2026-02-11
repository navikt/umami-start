# Build stage
FROM cgr.dev/chainguard/wolfi-base@sha256:1c56f3ceb1c9929611a1cc7ab7a5fde1ec5df87add282029cd1596b8eae5af67 AS base

# Install Node.js and enable pnpm
RUN apk update && apk add --no-cache nodejs-20 npm && npm install -g corepack && corepack enable

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

FROM base AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies with cache mount
RUN --mount=type=secret,id=NODE_AUTH_TOKEN \
    --mount=type=cache,id=pnpm,target=/pnpm/store \
    if [ -f /run/secrets/NODE_AUTH_TOKEN ]; then \
        export NODE_AUTH_TOKEN=$(cat /run/secrets/NODE_AUTH_TOKEN); \
        echo "//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}" > .npmrc && \
        echo "@navikt:registry=https://npm.pkg.github.com" >> .npmrc; \
    fi && \
    pnpm install --frozen-lockfile && \
    rm -f .npmrc

# Copy source code and build
COPY . .
RUN pnpm run build

# Production stage
FROM cgr.dev/chainguard/wolfi-base@sha256:1c56f3ceb1c9929611a1cc7ab7a5fde1ec5df87add282029cd1596b8eae5af67 AS runtime

# Install only Node.js runtime (no npm/corepack needed)
RUN apk update && apk add --no-cache nodejs-20

WORKDIR /app

# Copy package files
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

# Install pnpm for production dependencies
RUN apk add --no-cache npm && npm install -g corepack && corepack enable

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Install production dependencies
RUN --mount=type=secret,id=NODE_AUTH_TOKEN \
    --mount=type=cache,id=pnpm,target=/pnpm/store \
    if [ -f /run/secrets/NODE_AUTH_TOKEN ]; then \
        export NODE_AUTH_TOKEN=$(cat /run/secrets/NODE_AUTH_TOKEN); \
        echo "//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}" > .npmrc && \
        echo "@navikt:registry=https://npm.pkg.github.com" >> .npmrc; \
    fi && \
    pnpm install --prod --frozen-lockfile && \
    rm -f .npmrc

# Remove corepack/npm after installing dependencies
RUN apk del npm

# Copy built assets and runtime files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./
COPY --from=builder /app/.nais ./.nais

EXPOSE 8080

CMD ["node", "server.js"]
