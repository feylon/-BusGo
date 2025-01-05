# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
COPY packages/events/package.json packages/events/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/notification-service/package.json apps/notification-service/
COPY apps/sms-service/package.json apps/sms-service/
COPY apps/audit-service/package.json apps/audit-service/
COPY apps/tracking-service/package.json apps/tracking-service/
COPY apps/payment-service/package.json apps/payment-service/
COPY apps/scheduler-service/package.json apps/scheduler-service/
COPY apps/reporting-service/package.json apps/reporting-service/
COPY apps/frontend/package.json apps/frontend/
RUN npm ci --no-audit --no-fund
COPY packages packages
RUN npm run build:packages
COPY apps/notification-service apps/notification-service
RUN npm run build -w @bus/notification-service

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages packages
COPY --from=build /repo/apps/notification-service/package.json apps/notification-service/
COPY --from=build /repo/apps/notification-service/dist apps/notification-service/dist
WORKDIR /repo/apps/notification-service

USER node
EXPOSE 3101
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 CMD wget -qO- http://127.0.0.1:3101/health >/dev/null || exit 1
CMD ["node", "dist/main.js"]
