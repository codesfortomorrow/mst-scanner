# base image
FROM node:20 AS base

WORKDIR /mst-scanner

ARG PORT

RUN npm install pm2 --location=global

COPY package.json .
COPY package-lock.json .
COPY prisma/schema.prisma prisma/schema.prisma
COPY src/ledger/contracts/abi src/ledger/contracts/abi

ENV HUSKY=0

RUN npm install

COPY . .

EXPOSE ${PORT}

# development image
FROM base AS mst-scanner-dev

CMD ["npm", "run", "start:dev"]

# production image
FROM base AS mst-scanner

RUN npm run build

CMD ["pm2-runtime", "start", "ecosystem.config.js"]
