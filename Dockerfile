# syntax=docker/dockerfile:1.7
# Multi-stage production image for SkinTwin Customer Portal
# Stack: pnpm + Vite client + esbuild/Express server

ARG NODE_VERSION=22

# ---- Base: Node + pnpm via Corepack ----
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
WORKDIR /app
RUN corepack enable

# ---- Full dependency install (build + test tooling available) ----
FROM base AS deps
ENV NODE_ENV=development
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---- Build: Vite client -> dist/public, esbuild server -> dist/index.js ----
FROM deps AS build
COPY . .
# Ensure production asset paths and tree-shaking during Vite/esbuild
ENV NODE_ENV=production
RUN pnpm run build

# ---- Production node_modules only (esbuild uses --packages=external) ----
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod

# ---- Runtime ----
FROM node:${NODE_VERSION}-bookworm-slim AS runner
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

RUN groupadd --system --gid 1001 skintwin \
  && useradd --system --uid 1001 --gid skintwin --create-home skintwin

COPY --from=prod-deps --chown=skintwin:skintwin /app/node_modules ./node_modules
COPY --from=prod-deps --chown=skintwin:skintwin /app/package.json ./package.json
COPY --from=build --chown=skintwin:skintwin /app/dist ./dist

USER skintwin
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "const p=process.env.PORT||3000;fetch('http://127.0.0.1:'+p+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
