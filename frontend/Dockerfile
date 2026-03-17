FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY . .
RUN mkdir -p dist && echo '<h1>Frontend DocuFlow - En développement</h1>' > dist/index.html
EXPOSE 80
CMD ["serve", "-s", "dist", "-l", "80"]