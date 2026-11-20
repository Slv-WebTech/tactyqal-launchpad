# Video walkthrough: script and shot list

Target length **about 1:50** (the form asks for 1–2 minutes, screen recording + voice). About 230 spoken words at a calm pace.

## Before you hit record (5 minutes)

1. **Wake the API** (Render free tier sleeps): open https://tactyqal-launchpad-api.onrender.com/api/posts and wait until it loads (up to ~50 s). Do it again right before recording.
2. **Open these tabs in one clean Chrome window** (close everything else, hide bookmarks bar, turn on Do Not Disturb):
   - Tab 1: https://tactyqal-launchpad.vercel.app
   - Tab 2: https://tactyqal-launchpad.vercel.app/admin, then **paste the admin key into the "Admin key" field now, off camera**. It is a password field (shows dots), so it is safe on video. Do not show the key anywhere else.
   - Tab 3: https://github.com/Slv-WebTech/tactyqal-launchpad
3. Browser zoom **100%**, window 1920×1080 (or 1280×720). Mic check: say a sentence and play it back.
4. Practice the admin demo once (create, publish, delete) so you know where to click. The live database resets to 6 posts on restart, so a failed take leaves nothing behind except a post you can delete.
5. **Record with:** Windows **Win+G** (Game Bar, "Capture") or OBS or Loom. Then upload to YouTube as **Unlisted** and paste the link in the form's video field.

## Script

| Time | On screen | Say |
|---|---|---|
| **0:00–0:12** | Tab 1, top of the homepage (hero) | "Hi, I'm Vivek. This is my Tactyqal Labs hire-a-thon submission: a redesigned homepage in Next.js and Tailwind, plus a new blog backend with its own API." |
| **0:12–0:30** | Scroll slowly: success stories → 8-week program → pricing → FAQ (click one FAQ item open) | "I kept the original content and section order, but rebuilt it in a sage-and-forest palette, checked for accessible contrast. Success stories, the eight-week program, pricing and the FAQ are all fully responsive." |
| **0:30–0:40** | Press F12 → device toolbar → iPhone size (or resize window narrow). Open the ☰ menu | "On a phone the layout stacks cleanly, with a CSS-only menu and no sideways scrolling, even at three hundred twenty pixels." |
| **0:40–0:55** | Back to desktop. Click **Blog**. Type `food` in search, then click a tag chip (e.g. `ideas`), open one post | "The blog now runs on my own API instead of WordPress. Search, tag filters and pagination happen in the backend, and each post renders safely escaped markdown." |
| **0:55–1:25** | Tab 2 (`/admin`). Fill **Title:** `My first demo post`, **Excerpt:** `Created live in the walkthrough`, **Content:** `## Hello` + blank line + `This post was created from the admin page.`, **Tags:** `demo`. Click **Create post**. Switch to Tab 1 → `/blog` (it is **not** there: it's a draft). Back to admin → **Edit** → set **Published** → **Save changes**. Reload `/blog`: the post is now first. Back to admin → **Delete** → OK | "Here's the admin page. I'll create a post, with a title, content and tags, and save it as a draft. Drafts stay hidden from the public site. I'll switch it to published, and now it appears on the blog. And deleting works the same way." |
| **1:25–1:40** | Tab 3 (GitHub), scroll the README's API table, then briefly show the `backend/` folder | "Under the hood it's Express with SQLite: posts and tags, full create, read, update and delete endpoints, secured with an admin key. Writes are closed by default, so the API stays safe even if the key is ever missing." |
| **1:40–1:52** | README "Testing" table (or the `e2e/` folder) | "The repo has automated tests at every level: API, unit, browser end-to-end and live smoke checks. The live site is on Vercel and Render. The links are in my application. Thanks for watching." |

## Tips

- **Speak slower than feels natural**, and pause for about a second at each screen change. Cut dead air in editing, not by talking fast.
- **Move the mouse deliberately**: point at what you mention, and avoid fast scrolling.
- If the blog is empty or a page is slow, the API fell asleep: wait ~50 s, reload, and re-record that scene.
- If you run long, drop the phone scene (0:30–0:40) first, then the FAQ click.
- **Do not show:** the admin key, the Render dashboard, or your email/phone.

## YouTube description (optional)

```
Tactyqal Labs hire-a-thon: homepage redesign (Next.js 16 + Tailwind) and blog backend (Node/Express + SQLite).
Live: https://tactyqal-launchpad.vercel.app
API:  https://tactyqal-launchpad-api.onrender.com/api/posts
Code: https://github.com/Slv-WebTech/tactyqal-launchpad
```
