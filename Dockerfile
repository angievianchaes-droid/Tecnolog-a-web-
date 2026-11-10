# ---- Imagen de la aplicación (API + sitio web estático) ----
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# 1) Dependencias primero: Docker reutiliza esta capa si package*.json no cambia
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 2) Código de la aplicación (no se copian .env, tests ni node_modules: ver .dockerignore)
COPY server ./server
COPY web ./web
COPY api ./api
COPY db ./db

# Ejecutar como usuario sin privilegios (el usuario "node" ya existe en la imagen)
USER node

EXPOSE 3000

# Comprueba que el servidor responde (no consulta la base de datos)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Crea/verifica las tablas (y carga ejemplos solo si la base está vacía) y arranca el servidor
CMD ["sh", "-c", "node server/src/config/init-db.js && node server/src/app.js"]
