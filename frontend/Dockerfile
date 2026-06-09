FROM node:20-alpine

WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the frontend code
COPY . .

# Build the Next.js application for production
RUN npm run build

EXPOSE 3000

# Start the Next.js server
CMD ["npm", "run", "start"]