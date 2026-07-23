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
- Eisenhower matrix for task management with an "Eingang" inbox for quick capture & sorting
- Drag & drop todos between quadrants
- Quick-add input in each quadrant
- Command palette (Cmd+P) — search notes by title or tag, jump to tasks; type `@` to search tags and jump to a folder in the sidebar
- Installable as PWA — add to home screen on iOS/Android
- Light/dark theme
- Responsive design
- Multi-user authentication (scrypt + HMAC session cookies)
- Zero database — plain Markdown files with frontmatter

## Quick Start (Development)

```bash
bun install
bun run dev
```

On first visit you'll be redirected to `/setup`. Create a user via the CLI:

```bash
bun run user add myuser
```

Then log in at `http://localhost:3000/login`. Notes are stored in `$NOTES_ROOT/users/<username>/notes/`.

### User Management

```bash
bun run user add <username> [password]   # create user (prompts if no password)
bun run user list                        # list all users
bun run user remove <username>           # remove user (data stays on disk)
bun run user passwd <username>           # change password
bun run user migrate <username>          # move legacy root-level data into user dir
```

### Environment Variables

| Variable     | Default       | Description                     |
| ------------ | ------------- | ------------------------------- |
| `NOTES_ROOT` | `./dev-notes` | Root directory for note storage |
| `PORT`       | `3000`        | Server port                     |

## Deploy on Synology NAS

### Prerequisites

- Docker with the **buildx** plugin on your machine (Docker Desktop includes it)
- Synology DSM 7.x with **Container Manager** (Docker) installed on the NAS
- SSH access to the NAS
- `scripts/deploy.env` — copy `scripts/deploy.env.example` and fill in your values

### One-Command Deploy

```bash
bun run deploy
```

This runs `scripts/deploy.sh`, which:

1. Opens one SSH connection to the NAS (single password prompt)
2. Builds the image **natively on the NAS** via BuildKit — a `buildx` builder on
   the NAS's Docker daemon over an SSH remote context (no local cross-compilation,
   so no Rosetta/QEMU on Apple Silicon)
3. Loads the built image into the NAS's Docker daemon
4. Copies `docker-compose.yml` to the NAS
5. Runs `docker compose up -d --force-recreate`

On macOS the script re-execs itself under `caffeinate`, so the laptop going to
sleep can't abort the deploy mid-build — keep the lid open during the run.

Optional flags:

- `RECREATE_BUILDER=1 bun run deploy` — recreate the NAS BuildKit builder (after
  changing `NAS`/`NAS_PORT`, or to apply a new cache-GC config)
- `PRUNE_CACHE=1 bun run deploy` — trim the NAS BuildKit cache to ~5 GB

### How the build works

The image is built **on the NAS** by a persistent BuildKit `buildx` builder that
the script reaches over SSH (`DOCKER_HOST=ssh://…`). Because Synology's
non-interactive shell doesn't have `docker` on its `PATH`, the script wraps `ssh`
to inject it — so there are no manual build/transfer steps to run. Just use
`bun run deploy`.

### Access the App

Open `http://<synology-ip>:3000` in your browser.

### Reverse Proxy (Optional)

In DSM → **Control Panel** → **Login Portal** → **Advanced** → **Reverse Proxy**:

| Field       | Value                          |
| ----------- | ------------------------------ |
| Source      | `https://notes.yourdomain.com` |
| Destination | `http://localhost:3000`        |

### Backup

After the container starts, create a user:

```bash
docker exec -it notizen bun run user add myuser
```

Notes are plain files in `/volume1/docker/<app>/data/`. Back up with Hyper Backup or any file sync tool.

## File Structure

```
/app/data/                              # NOTES_ROOT
├── .auth/
│   ├── users.json                      # User accounts (scrypt hashes)
│   └── secret.key                      # HMAC signing key (auto-generated)
└── users/
    └── <username>/
        ├── todos.json                  # Eisenhower Matrix tasks
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

Quadrant values: `do`, `schedule`, `inbox` (shown as "Eingang"), `planned`

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

### Authentication

All API routes require a valid session cookie. Unauthenticated requests return `401`.

### Error Responses

All errors return:

```json
{ "error": "Description of what went wrong" }
```

| Status | Meaning          |
| ------ | ---------------- |
| 400    | Validation error |
| 401    | Unauthorized     |
| 404    | Not found        |
| 500    | Internal error   |

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Framework**: [Next.js](https://nextjs.org) 16 (App Router, standalone output)
- **UI**: [shadcn/ui](https://ui.shadcn.com) + [Tailwind CSS](https://tailwindcss.com) v4
- **Editor**: [@uiw/react-md-editor](https://github.com/uiwc/react-md-editor)
- **Validation**: [Zod](https://zod.dev)
- **Storage**: Filesystem (Markdown + frontmatter via [gray-matter](https://github.com/jonschlinkert/gray-matter))
