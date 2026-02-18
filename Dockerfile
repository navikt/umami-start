# Build stage
FROM cgr.dev/chainguard/wolfi-base@sha256:1c56f3ceb1c9929611a1cc7ab7a5fde1ec5df87add282029cd1596b8eae5af67 AS base

# Install Node.js and pnpm
RUN apk update && apk add --no-cache nodejs-25 pnpm

WORKDIR /app

# Copy package files and .npmrc
COPY package.json pnpm-lock.yaml* .npmrc ./

# Install dependencies with cache mount
RUN --mount=type=secret,id=NODE_AUTH_TOKEN \
    --mount=type=cache,id=pnpm,target=/pnpm/store \
    NODE_AUTH_TOKEN=$(cat /run/secrets/NODE_AUTH_TOKEN) pnpm install --frozen-lockfile

# Copy source code and build
COPY . .
RUN pnpm run build

# Production stage
FROM cgr.dev/chainguard/wolfi-base@sha256:1c56f3ceb1c9929611a1cc7ab7a5fde1ec5df87add282029cd1596b8eae5af67 AS runtime

# Install only Node.js runtime and pnpm
RUN apk update && apk add --no-cache nodejs-25 pnpm

WORKDIR /app

# Copy package files and .npmrc
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/.npmrc ./

# Install pnpm for production dependencies
# (pnpm is installed via apk in this stage)

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Install production dependencies
RUN --mount=type=secret,id=NODE_AUTH_TOKEN \
    --mount=type=cache,id=pnpm,target=/pnpm/store \
    NODE_AUTH_TOKEN=$(cat /run/secrets/NODE_AUTH_TOKEN) pnpm install --prod --frozen-lockfile

# Copy built assets and runtime files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/.nais ./.nais

EXPOSE 8080

CMD ["node", "server.js"]
