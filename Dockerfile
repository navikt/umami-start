# Build stage
FROM cgr.dev/chainguard/wolfi-base:latest AS builder

# Install Node.js and npm
RUN apk update && apk add --no-cache nodejs npm

# Build arg for GitHub token (provided by NAIS or CI/CD)
ARG GITHUB_TOKEN

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Create .npmrc for GitHub NPM registry authentication
RUN if [ -n "$GITHUB_TOKEN" ]; then \
    echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" > .npmrc && \
    echo "@navikt:registry=https://npm.pkg.github.com" >> .npmrc; \
    fi

# Install dependencies
RUN npm install

# Remove .npmrc for security
RUN rm -f .npmrc

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM europe-north1-docker.pkg.dev/cgr-nav/pull-through/nav.no/node:25@sha256:cc62f1d96319b97336eeb45d880f1a4ec9964235b38dc7ca0aa0cbb02c082558

# Build arg for GitHub token
ARG GITHUB_TOKEN

WORKDIR /app

# Copy package files and npmrc
COPY --from=builder /app/package.json /app/package-lock.json ./

# Create .npmrc for GitHub NPM registry authentication
RUN if [ -n "$GITHUB_TOKEN" ]; then \
    echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" > .npmrc && \
    echo "@navikt:registry=https://npm.pkg.github.com" >> .npmrc; \
    fi

# Install production dependencies using npm
RUN npm install --production --no-save

# Remove .npmrc for security
RUN rm -f .npmrc

# Copy built assets and runtime files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./
COPY --from=builder /app/.nais ./.nais

EXPOSE 8080

CMD ["server.js"]
