cat > app-source/backend/Dockerfile <<'EOF'
FROM node:20-alpine
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
EOF
