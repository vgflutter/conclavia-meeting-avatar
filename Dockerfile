# syntax=docker/dockerfile:1.4
# Build with: docker build --build-context avatar-kit=../conclavia-avatar-kit -t conclavia .
FROM node:22-alpine AS dependencies
WORKDIR /workspace/conclavia-avatar-kit
COPY --from=avatar-kit package.json package-lock.json ./
RUN npm ci
WORKDIR /workspace/conclavia-meeting-avatar
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder
WORKDIR /workspace/conclavia-meeting-avatar
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=avatar-kit src /workspace/conclavia-avatar-kit/src
COPY --from=avatar-kit assets /workspace/conclavia-avatar-kit/assets
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app/conclavia-meeting-avatar
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /workspace/conclavia-meeting-avatar/.next/standalone /app/
COPY --from=builder /workspace/conclavia-meeting-avatar/public ./public
COPY --from=builder --chown=nextjs:nodejs /workspace/conclavia-meeting-avatar/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
