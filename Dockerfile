# Builder stage
FROM node:18-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY . .
RUN npm install --force && npm run build && npm install --production --ignore-scripts --prefer-offline

# Runner stage
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs
EXPOSE 3000

ENV NEXT_TELEMETRY_DISABLED 1
CMD ["npm", "run", "start"]