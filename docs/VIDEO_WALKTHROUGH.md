# Video walkthrough: script and shot list

*Updated 2026-11-20 to match the current site: sage/olive/forest/cream theme, closed-by-default API, friendly "waking up" state, CI-gated pull requests, 143 automated tests, MIT licence.*

Target length **about 1:55** (the form asks for 1–2 minutes, screen recording + voice). About 210 spoken words at a calm pace (≈ 2 words per second, so roughly 105 s of speech); the on-screen actions fill the rest.

## Before you hit record (5 minutes)

1. **Wake the API** (Render free tier sleeps after ~15 min idle): open https://tactyqal-launchpad-api.onrender.com/api/posts and wait until it loads (up to ~50 s). Do it again right before recording.
   *If you forget:* the site shows a friendly "Our articles are on their way" card that retries by itself, so nothing breaks, but wait for it to fill in before you start.
2. **Open these tabs in one clean Chrome window** (close everything else, hide the bookmarks bar, turn on Do Not Disturb):
   - Tab 1: https://tactyqal-launchpad.vercel.app
   - Tab 2: https://tactyqal-launchpad.vercel.app/admin. **Paste the admin key into the "Admin key" field now, off camera.** It is a password field (dots only). The key lives in the page's memory only, so **do not reload or close this tab** during the take, or you must paste it again.
   - Tab 3: https://github.com/Slv-WebTech/tactyqal-launchpad
3. Browser zoom **100%**, window 1920×1080 (or 1280×720). Mic check: say a sentence and play it back.
4. **Practice the admin demo once** (create → publish → delete). Without the key the admin page is read-only (writes return 401), so confirm the key works before the real take. The hosted database resets to the 6 seed posts on every API restart, so a failed take leaves at most one post you can delete.
5. **Record with:** Windows **Win+G** (Game Bar, "Capture"), OBS or Loom. Upload to YouTube as **Unlisted** and paste the link in the form's video field.

## Script

| Time | On screen | Say |
|---|---|---|
| **0:00–0:13** | Tab 1, top of the homepage (hero) | "Hi, I'm Vivek. This is my Tactyqal Labs hire-a-thon submission: a redesigned Next.js homepage, and a new blog backend with its own secure API." |
| **0:13–0:30** | Scroll slowly: success stories → 8-week program → pricing → FAQ (click one FAQ item open) | "I kept the original content and section order, but rebuilt it in a sage-and-forest palette. It's fully responsive, passes automated accessibility scans with zero violations, and loads in about a second on a throttled phone." |
| **0:30–0:38** | F12 → device toolbar → iPhone size (or drag the window narrow). Open the ☰ menu | "On a phone it stacks cleanly, with no sideways scrolling, even at three hundred twenty pixels." |
| **0:38–0:52** | Back to desktop. Click **Blog**. Type `food` in search, click a tag chip (e.g. `ideas`), open one post | "The blog now runs on my own API instead of WordPress. Search, tag filters and pagination happen in the backend, and posts render safely escaped markdown." |
| **0:52–1:22** | Tab 2 (`/admin`). Fill **Title:** `My first demo post`, **Excerpt:** `Created live in the walkthrough`, **Content:** `## Hello` + blank line + `This post was created from the admin page.`, **Tags:** `demo`. Click **Create post**. Switch to Tab 1 → `/blog` (it is **not** there: it's a draft). Back to admin → **Edit** → set **Published** → **Save changes**. Reload `/blog` (Tab 1): the post is now first. Back to admin → **Delete** → OK | "Here's the admin page. I create a post with a title, content and tags, and save it as a draft. Drafts stay hidden from visitors. I publish it, and it appears on the blog. Deleting works the same way." |
| **1:22–1:36** | Tab 3 (GitHub): README top (banner, badges), scroll to the API table and the Security section | "It's Express with SQLite: full create, read, update and delete, with an OpenAPI contract. Writes are closed by default, so the API stays safe even if the admin key is ever missing." |
| **1:36–1:55** | Click **Pull requests → Closed**, open one merged PR and show the green checks; then the README "Quality" table | "Every change goes through a pull request with four checks: backend, frontend, end-to-end and security. More than a hundred automated tests cover the API, accessibility, visuals and the live site. The links are in my application. Thanks for watching." |

### Optional 5-second cutaway (only if you have time)

Open https://tactyqal-launchpad.vercel.app/blog while the API is asleep and show the card: *"Even when the free-tier API is asleep, visitors get a friendly retry state, not an error."* Skip it if the API is awake. Don't force it.

## Tips

- **Speak slower than feels natural** and pause about a second at each screen change. Cut dead air in editing, not by talking fast.
- **Move the mouse deliberately**: point at what you mention, avoid fast scrolling.
- If the blog is empty or slow, the API fell asleep: wait ~50 s, reload, and re-record that scene.
- If you run long, drop the phone scene (0:30–0:38) first, then the FAQ click.
- After the take, check https://tactyqal-launchpad.vercel.app/blog still lists the 6 original posts (delete your demo post if it is still there).
- **Do not show:** the admin key, the Render or Vercel dashboards, or your email/phone number.

## YouTube description (optional)

```
Tactyqal Labs hire-a-thon: a redesigned homepage (Next.js 16, React 19, Tailwind 4) and a blog backend (Node/Express + SQLite)
with an OpenAPI contract, closed-by-default writes, WCAG-checked UI and 143 automated tests (unit, contract, fuzz, accessibility, visual, end-to-end).

Live site: https://tactyqal-launchpad.vercel.app
Blog API:  https://tactyqal-launchpad-api.onrender.com/api/posts
Code (MIT): https://github.com/Slv-WebTech/tactyqal-launchpad
```
