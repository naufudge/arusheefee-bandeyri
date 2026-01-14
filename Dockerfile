# Stage 1: Dependencies
FROM node:20-alpine
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

COPY . .

# Build Next.js application
RUN npm run build

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Change ownership to nextjs user
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
