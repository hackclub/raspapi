FROM node:22-alpine AS build

WORKDIR /raspapi

RUN npm install -g bun

COPY package.json bun.lock ./

RUN bun install

COPY . .

RUN bun run build

FROM node:22-alpine

WORKDIR /raspapi

RUN npm install -g bun

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile --production

COPY --from=build /raspapi/dist ./dist

EXPOSE 4321

CMD ["bun", "run", "dist/server/entry.mjs"]

