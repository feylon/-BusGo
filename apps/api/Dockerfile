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
COPY apps/api apps/api
RUN npm run build -w @bus/api

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages packages
COPY --from=build /repo/apps/api/package.json apps/api/
COPY --from=build /repo/apps/api/dist apps/api/dist
WORKDIR /repo/apps/api
COPY --from=build /repo/apps/api/docker-entrypoint.sh ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["sh", "./docker-entrypoint.sh"]
