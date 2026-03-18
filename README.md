# Notizen

A self-hosted, file-based notes app with Markdown editing and file attachments. No database — notes are stored as `.md` files on disk.

Built with Next.js, shadcn/ui, and Bun. Designed for deployment on Synology NAS via Docker.

## Features

- Markdown editing with live preview
- Note linking — `[[` trigger or Cmd+L to insert links between notes
- List continuation — Enter continues `- ` / `1.` lists, Tab indents, Shift+Tab dedents
- File attachments (drag & drop or paste images)
- Hierarchical tags (slash-separated, e.g. `dev/python/fastapi`) with folder-style tag browser
- Note pinning for quick access
- Eisenhower Matrix for task management (Do / Schedule / Delegate / Eliminate)
- Drag & drop todos between quadrants
- Quick-add input in each quadrant
- Command palette (Cmd+P) — search notes by title or tag, jump to tasks
- Installable as PWA — add to home screen on iOS/Android
- Light/dark theme
- Responsive design
- Zero database — plain Markdown files with frontmatter

## Quick Start (Development)

```bash
bun install
bun run dev
```

App runs at `http://localhost:3000`. Notes are stored in `./dev-notes/notes/`.

### Environment Variables

| Variable     | Default            | Description                    |
| ------------ | ------------------ | ------------------------------ |
| `NOTES_ROOT` | `./dev-notes`      | Root directory for note storage |
| `PORT`       | `3000`             | Server port                    |

## Deploy on Synology NAS

### Prerequisites

- Synology DSM 7.x with **Container Manager** (Docker) installed
- SSH access (host configured as `ds` in `~/.ssh/config`)

### One-Command Deploy

```bash
bun run deploy
```

This runs `scripts/deploy.sh`, which:

1. Builds the Docker image for `linux/amd64`
2. Transfers it to the NAS via SCP
3. Copies `docker-compose.yml` to the NAS
4. Runs `docker compose up -d --force-recreate`
5. Cleans up local build artifacts

### Manual Deploy

Build and transfer the image yourself:

```bash
docker build --platform linux/amd64 -t notizen .
docker save notizen | gzip > notizen.tar.gz
scp notizen.tar.gz user@nas:/tmp/
```

Then on the NAS:

```bash
docker load -i /tmp/notizen.tar.gz
cd /volume1/docker/app
docker compose up -d --force-recreate
```

### Access the App

Open `http://<synology-ip>:3000` in your browser.

### Reverse Proxy (Optional)

In DSM → **Control Panel** → **Login Portal** → **Advanced** → **Reverse Proxy**:

| Field       | Value                          |
| ----------- | ------------------------------ |
| Source       | `https://notes.yourdomain.com` |
| Destination | `http://localhost:3000`        |

### Backup

Notes are plain files in `/volume1/docker/app/data/`. Back up with Hyper Backup or any file sync tool.

## File Structure

```
/app/data/                          # NOTES_ROOT
├── todos.json                      # Eisenhower Matrix tasks
└── notes/
    └── 2026-02-20-my-note-a1b2c3/  # {date}-{slug}-{uuid}
        ├── note.md                  # Frontmatter + Markdown content
        └── attachments/
            ├── f4e5d6_photo.png     # {attId}_{originalName}
            └── a7b8c9_doc.pdf
```

### note.md Format

```markdown
---
id: 550e8400-e29b-41d4-a716-446655440000
title: My Note
tags:
  - dev/python
  - ideas
pinned: false
createdAt: 2026-02-20T10:30:00.000Z
updatedAt: 2026-02-20T11:15:00.000Z
---

# My Note

Markdown content here...
```

## API Reference

Base URL: `/api/notes`

### List Notes

```
GET /api/notes
```

Response: `NoteSummary[]`

```json
[
  {
    "id": "uuid",
    "slug": "2026-02-20-my-note-a1b2c3",
    "title": "My Note",
    "createdAt": "2026-02-20T10:30:00.000Z",
    "updatedAt": "2026-02-20T11:15:00.000Z",
    "attachmentCount": 2,
    "tags": ["dev/python", "ideas"],
    "pinned": false
  }
]
```

### Create Note

```
POST /api/notes
Content-Type: application/json

{ "title": "New Note", "content": "# Hello", "tags": ["dev"] }
```

`tags` is optional (defaults to `[]`).

Response: `Note` (201)

### Get Note

```
GET /api/notes/:id
```

Response: `Note` (includes `content` and `attachments[]`)

### Update Note

```
PUT /api/notes/:id
Content-Type: application/json

{ "title": "Updated Title", "content": "# Updated", "tags": ["dev"], "pinned": true }
```

All fields optional. Response: `Note`

### Delete Note

```
DELETE /api/notes/:id
```

Response: `{ "success": true }`

### List Attachments

```
GET /api/notes/:id/attachments
```

Response: `Attachment[]`

```json
[
  {
    "id": "f4e5d6",
    "originalName": "photo.png",
    "mimeType": "image/png",
    "size": 204800,
    "relativePath": "attachments/f4e5d6_photo.png"
  }
]
```

### Upload Attachment

```
POST /api/notes/:id/attachments
Content-Type: multipart/form-data

file: <binary>
```

Response: `Attachment` (201)

### Download Attachment

```
GET /api/notes/:id/attachments/:attId/download
```

Response: Binary file stream with appropriate `Content-Type` and `Content-Disposition` headers.

### Delete Attachment

```
DELETE /api/notes/:id/attachments/:attId
```

Response: `{ "success": true }`

### Todos

Base URL: `/api/todos`

#### List Todos

```
GET /api/todos
```

Response: `Todo[]`

```json
[
  {
    "id": "uuid",
    "title": "Finish report",
    "description": "Q1 summary",
    "dueDate": "2026-03-01",
    "quadrant": "do",
    "completed": false,
    "createdAt": "2026-02-20T10:30:00.000Z",
    "updatedAt": "2026-02-20T10:30:00.000Z"
  }
]
```

Quadrant values: `do`, `schedule`, `delegate`, `planned`

#### Create Todo

```
POST /api/todos
Content-Type: application/json

{ "title": "New task", "quadrant": "do", "description": "optional", "dueDate": "2026-03-01" }
```

`description` and `dueDate` are optional. Response: `Todo` (201)

#### Update Todo

```
PUT /api/todos/:id
Content-Type: application/json

{ "title": "Updated", "completed": true, "quadrant": "schedule" }
```

All fields optional. Response: `Todo`

#### Delete Todo

```
DELETE /api/todos/:id
```

Response: `{ "success": true }`

### Error Responses

All errors return:

```json
{ "error": "Description of what went wrong" }
```

| Status | Meaning           |
| ------ | ----------------- |
| 400    | Validation error  |
| 404    | Not found         |
| 500    | Internal error    |

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Framework**: [Next.js](https://nextjs.org) 16 (App Router, standalone output)
- **UI**: [shadcn/ui](https://ui.shadcn.com) + [Tailwind CSS](https://tailwindcss.com) v4
- **Editor**: [@uiw/react-md-editor](https://github.com/uiwc/react-md-editor)
- **Validation**: [Zod](https://zod.dev)
- **Storage**: Filesystem (Markdown + frontmatter via [gray-matter](https://github.com/jonschlinkert/gray-matter))
