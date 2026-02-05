# task-to-cal

Simple static web app that connects a Kanban Task Manager to a Weekly Calendar view.

## Setup & Usage

### What this project is
- `index.html`: Home page with hero image and feature overview.
- `task.html`: Task Manager with a 3-column Kanban board (`Backlog`, `In Progress`, `Done`) and date+time task input.
- `calendar.html`: Weekly calendar (Monday to Sunday) with time grid (Google Calendar-like weekly layout).

### Persistence model
- Tasks are stored in browser `localStorage` using key: `ttc_tasks_v1`.
- `data/tasks.json` is used only for first-time seed when `ttc_tasks_v1` does not exist.
- After seeding, `localStorage` is the source of truth.
- Use the **Reset to seed data** button on Task or Calendar page to clear storage and re-seed.

### Local development
Use any static server from the repo root.

1. Python example:
```bash
python -m http.server 8000
```
2. Node example:
```bash
npx serve .
```
3. Open the local URL shown by the server, for example:
- `http://localhost:8000`
- `http://localhost:3000`

### GitHub Pages deployment
1. Push this repo to GitHub.
2. In GitHub repo settings, open **Pages**.
3. Set **Source** to your deployment branch (for example `main`) and root folder (`/` root).
4. Save and wait for GitHub Pages build.
5. Open the published URL and verify:
- Home: `/`
- Task Manager: `/task.html`
- Calendar: `/calendar.html`

### Hero image path
- Place or replace your hero image at:
  - `assets/img/hero.jpg`
- If the image is missing, the hero section still shows a fallback background color.

### Troubleshooting
- If tasks seem stuck or outdated, clear browser site data or click **Reset to seed data**.
- If `data/tasks.json` fails to load, make sure you are not opening via `file://`.
  - Use a local server (`python -m http.server`, `npx serve`, etc.).
