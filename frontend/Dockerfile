FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
# Dev server for the hackathon (fast HMR). Swap to `npm run build && preview` for prod.
CMD ["npm", "run", "dev"]
