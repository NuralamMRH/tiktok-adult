FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --no-progress

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXTAUTH_URL=http://localhost:3000
ENV NEXT_PUBLIC_ROOT_URL=http://localhost:3000
RUN bun x next build

FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXTAUTH_URL=http://localhost:3000
ENV NEXT_PUBLIC_ROOT_URL=http://localhost:3000
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3000
CMD ["bun", "x", "next", "start", "-p", "3000"]
