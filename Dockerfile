# Build stage
FROM cgr.dev/chainguard/wolfi-base@sha256:42012fa027adc864efbb7cf68d9fc575ea45fe1b9fb0d16602e00438ce3901b1 AS builder

# Install Node.js and npm
RUN apk update && apk add --no-cache nodejs npm

# Build arg for GitHub token (provided by NAIS or CI/CD)
ARG GITHUB_TOKEN

WORKDIR /app

# Copy package files and npmrc
COPY package.json package-lock.json .npmrc ./

# Set GitHub token for npm registry authentication
RUN if [ -n "$GITHUB_TOKEN" ]; then \
    echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" > .npmrc && \
    echo "@navikt:registry=https://npm.pkg.github.com" >> .npmrc; \
    fi

# Install dependencies
RUN npm install --frozen-lockfile

# Remove .npmrc for security
RUN rm -f .npmrc

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM europe-north1-docker.pkg.dev/cgr-nav/pull-through/nav.no/node:25@sha256:5181bb4b6a9129064acae4632ea92f3f991dd30d63c5d804fe59b9ad70faa544

# Build arg for GitHub token
ARG GITHUB_TOKEN

WORKDIR /app

# Copy package files and npmrc
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY .npmrc ./

# Set GitHub token for npm registry authentication
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
