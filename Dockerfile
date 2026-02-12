FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
# Ensure we run migrations before starting, or handle via K8s Job
CMD ["sh", "-c", "npm run db:init && npm start"]