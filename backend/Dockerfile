FROM node:20-alpine

WORKDIR /app
RUN if [ ! -f package.json ]; then \
    npm init -y && npm install express cors mongoose multer axios; \
    fi

COPY . .

RUN if [ -f package.json ]; then npm install; fi

RUN if [ ! -f index.js ]; then \
    echo 'const express = require("express");\nconst cors = require("cors");\nconst app = express();\napp.use(cors());\napp.use(express.json());\n\napp.get("/health", (_, res) => res.json({ status: "ok", service: "api-backend" }));\n\napp.post("/crm/fill", (req, res) => {\n  console.log("[CRM] Auto-remplissage:", req.body);\n  res.json({ success: true, data: req.body });\n});\n\napp.post("/conformite/fill", (req, res) => {\n  console.log("[CONFORMITE] Rapport:", req.body);\n  res.json({ success: true, data: req.body });\n});\n\napp.listen(4000, () => console.log("API Backend running on port 4000"));' > index.js; \
    fi

EXPOSE 4000

CMD ["node", "index.js"]