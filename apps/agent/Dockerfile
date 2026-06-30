# syntax=docker/dockerfile:1
# SpeakCore Agent – Dockerfile (SKELETON, NDF Step 002). Nicht produktionsoptimiert.
# WICHTIG: Der Agent erhält hier KEINE Docker-/Host-Rechte.
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-workspace.yaml package.json .npmrc ./
COPY pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/agent ./apps/agent
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @speakcore/agent build

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
# tsup bündelt die Workspace-Pakete – nur das Bundle wird benötigt.
COPY --from=build /repo/apps/agent/dist ./dist
EXPOSE 4000
CMD ["node", "dist/index.js"]
