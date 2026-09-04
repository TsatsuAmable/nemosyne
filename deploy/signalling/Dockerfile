FROM node:24.20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY src/network ./src/network

ENV NODE_ENV=production \
    NEMOSYNE_SIGNAL_HOST=0.0.0.0 \
    NEMOSYNE_SIGNAL_PORT=8787 \
    NEMOSYNE_SIGNAL_PROFILE=Production

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start:signalling"]
