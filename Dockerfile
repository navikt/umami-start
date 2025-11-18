# Build stage
FROM cgr.dev/chainguard/wolfi-base@sha256:42012fa027adc864efbb7cf68d9fc575ea45fe1b9fb0d16602e00438ce3901b1 AS builder

# Install Node.js and yarn
RUN apk update && apk add --no-cache nodejs yarn

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN yarn build

# Production stage
FROM cgr.dev/chainguard/wolfi-base@sha256:42012fa027adc864efbb7cf68d9fc575ea45fe1b9fb0d16602e00438ce3901b1

# Install Node.js for runtime
RUN apk update && apk add --no-cache nodejs

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server.js ./

EXPOSE 8080

# Run as non-root user (chainguard images use 'node' user by default)
USER node

CMD ["server.js"]
