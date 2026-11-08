# MS Constructions MCP

Standalone TypeScript/Node MCP server for the MS Constructions database. It exposes read/create/update tools for tasks, expenses, and work logs, plus dashboard read access.

## Tools

- `dashboard_read`
- `tasks_read`, `task_create`, `task_update`
- `expenses_read`, `expense_create`, `expense_update`
- `work_logs_read`, `work_log_create`, `work_log_update`
- `file_upload` — one base64 file, maximum 10 MB
- `file_import_url` — one file from an allow-listed HTTPS hostname, maximum 10 MB

## Mutation safety

- Deletion is not exposed and the server contains no delete operation.
- Create tools accept one object and insert one record per call.
- Update tools require one UUID and always update through the primary-key `id`.
- There are no bulk create, bulk update, query-based update, or raw SQL tools.
- The update implementation rejects any result that is not exactly one record.
- Upload/import accepts exactly one file and never overwrites or deletes a file.

## Local run

```bash
cp .env.example .env
npm install
set -a && source .env && set +a
npm run dev
```

The Streamable HTTP endpoint is `http://localhost:3000/mcp`. Send `Authorization: Bearer <MCP_API_KEY>`. Health checks use `/health` without authentication.

## Render

Create a Blueprint from the repository's `mcp-server/render.yaml`, or create a Node Web Service with:

- Root directory: `mcp-server`
- Build: `npm ci && npm run build`
- Start: `npm start`
- Health path: `/health`
- Environment: `DATABASE_URL`, `MCP_API_KEY`, `ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`
- Optional URL imports: set `MCP_IMPORT_HOSTS` to a comma-separated hostname allowlist

Use the same production Postgres URL as the app. Prefer a dedicated database role limited to the tables and operations this MCP needs.
