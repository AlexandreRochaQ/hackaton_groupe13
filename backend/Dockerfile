FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3001
CMD ["node", "app.js"]
