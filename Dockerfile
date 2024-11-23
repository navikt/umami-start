FROM node:20-alpine

COPY . .

EXPOSE 8080

CMD node server.js