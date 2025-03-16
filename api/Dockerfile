FROM node:alpine

WORKDIR /usr/src/app

COPY ./ ./
RUN npm install
RUN npm run build

CMD ["node", "./bin/script/server.js"]