FROM node:22

RUN npm install -g pnpm

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /usr/src/app

COPY package*.json ./
RUN pnpm install

RUN pnpm add -g typescript

COPY . .

RUN mkdir -p public

RUN pnpm run build

EXPOSE 4000
EXPOSE 4001

CMD ["pnpm", "run", "start"]