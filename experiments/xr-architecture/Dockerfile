FROM node:24-bookworm-slim
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV CI=1
CMD ["npm", "run", "experiment:xr-architecture", "--", "--config", "experiments/xr-architecture/experiment.example.json"]
