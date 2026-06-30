# syntax=docker/dockerfile:1
# SpeakCore WebUI – Dockerfile (SKELETON, NDF Step 002). Nicht produktionsoptimiert.
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Manifeste/Quellen kopieren (Build-Context = Repo-Root)
COPY pnpm-workspace.yaml package.json .npmrc ./
COPY pnpm-lock.yaml* ./
COPY packages ./packages
COPY branding ./branding
COPY apps/web ./apps/web
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @speakcore/web build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo ./
EXPOSE 3000
CMD ["pnpm", "--filter", "@speakcore/web", "start"]
