# Dockerfile racine utilisé par DockPanel (Git Deploy) : construit l'API située dans ./api
FROM node:22-alpine
WORKDIR /app
COPY api/package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY api/ .
USER node
EXPOSE 3000
CMD ["node", "src/index.js"]
