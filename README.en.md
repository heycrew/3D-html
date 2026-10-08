# 360° Panorama Studio

**[中文](README.md) | [English](README.en.md)**

A pure-frontend authoring studio for **360° panoramas** and **flip-book catalogs**. Import your assets, tune the parameters on the right, and export a self-contained static page (`index.html` + image folders + `lib/`) that you can deploy anywhere.

Built for two use cases: **a turntable-style 360° view of a single object**, and **a catalog you can flip through in 3D**. Collection catalogs, product brochures, and exhibition guides are all direct fits.

## Features

- **Pure frontend** — the output is only HTML / CSS / JS / images. No backend, no database, no build step at deploy time
- **No external dependencies** — the exported page depends only on two third-party libraries (both MIT) and works offline; optionally wire it to Cloudimage CDN for image transforms
- **What you see is what you get** — edit a parameter and the live preview updates immediately
- **3D rotation (360° panorama)** — horizontal orbit plus pitch and 2D grid, with frame interpolation smoothing, drag inertia, pinch zoom, fullscreen, hotspots, and autorotate
- **3D page flip (flip-book catalog)** — WebGL page-curl flipping with drag-to-turn, loop, page navigation, 360-asset thumbnails, double-tap zoom, autoplay, and a page-turn sound effect
- **Portable desktop app** — double-click and run on Windows 10 / 11. No install, no Node / Python / IIS, no admin rights
- **Mobile ready** — exported pages work in mobile browsers and WeChat's in-app browser (the flip engine downgrades automatically to match the platform)

## Getting Started

### Option 1: Portable desktop app (easiest)

Copy the whole `desktop/dist/win-unpacked/` folder to the target machine and run `360全景展示工作台.exe` inside it.
The app starts an internal server on `127.0.0.1`, opens a window, and shuts everything down when you close it.

> The packaged build is roughly 200MB because it bundles Chromium — that is what it costs to run on any Windows 10 / 11 machine with nothing pre-installed.

### Option 2: Run the local server (no packaging)

1. Double-click `启动工作台.bat`
2. Your browser opens the studio (something like `http://localhost:8788/studio.html`)
3. Import assets → adjust parameters → click **Export HTML** in the top-right and pick an empty folder

> **Why can't I just double-click `studio.html`?**
> Cloudimage 360 View sets `crossOrigin="anonymous"` on every image, and browsers block those requests under the `file://` protocol, leaving the preview blank. The launcher spins up a local server using the PowerShell that ships with Windows — nothing to install, no admin rights needed.

### Option 3: Build from source

```bash
python3 build/build.py          # generates studio.html from build/js/*.js, with a syntax self-check
```

Building requires only the Python 3 standard library — no npm needed.

## Workflow

1. **Import assets** — pick a folder in the *Image source* section, or drag images in. Files are auto-sorted by the numeric part of their names
2. **Tune parameters** — the panel on the right is grouped; the preview updates as you type
3. **Export** — click **Export HTML**, pick an empty folder, and you get a deployable static bundle

### Asset guidelines

- Any frame count works; the bare minimum of 6 shots (front / back / left / right / up / down) is usable
- With fewer than 8 frames, rotation looks steppy. A good trick: use the first 4 for the horizontal orbit and put the up / down shots into the *vertical* group, then drag vertically for pitch
- 24+ frames per revolution looks smoothest
- Names containing a sequence number (`1.jpg`, `p02.jpg`) are sorted automatically

## Feature Reference

### 1. 360° panorama (3D rotation)

**Image source**

| Parameter | Description |
| --- | --- |
| Image folder / filename template (horizontal) | Where the images live and how they are named; `{index}` is replaced with the sequence number |
| Horizontal frame count | How many shots make one full revolution (1–240) |
| Zero padding | `3` means `001`, `002`, … |
| Frame interpolation | Inserts transition frames between adjacent shots; `0` disables. **With few shots, 2–3 makes rotation noticeably smoother** |
| Vertical frame count / template | The pitch group; `0` disables the vertical axis |
| Grid filename template | 2D grid assets using `{indexX}` and `{indexY}` |
| Horizontal / vertical / grid image lists | For irregular filenames; one URL per line. When filled, folder + template are ignored |

**Rotation behaviour** — autorotate toggle, autorotate mode (horizontal orbit / vertical orbit / row scan / column scan), reverse, play once, interval, drag inertia.

**Interaction** — mouse drag, touch swipe, sensitivity, reverse direction, arrow-key control, stop at edges (three-state, settable separately for X / Y), pinch zoom.

**Appearance & controls** — container aspect ratio, built-in theme (light / dark), fullscreen button, max zoom, zoom step, zoom control group and its position, scroll-wheel hint, first-interaction hint, initial 360° icon, bottom progress ring and its offset, load-on-click, lazy loading.

**Hotspots** — trigger (hover / click), timeline click opens popup, marker style, brand color.

### 2. Flip-book catalog (3D page flip)

A book is **a cover + N content pages + a back cover**, all rendered at a uniform size. Each content page can also carry its own set of 360 assets, opened by tapping the page.

| Parameter | Description |
| --- | --- |
| Book width / height / size mode | In *follow cover* mode the canvas ratio matches the cover image exactly, leaving no letterboxing |
| Flip duration | Length of one page-turn animation |
| Curl tilt | How much the curl travels diagonally; `0` keeps the whole edge parallel |
| Paper back color | Color of the back face of the turning page |
| Drag to flip / commit threshold | Finger or mouse can lift the page and make it follow; how far (as a fraction of page width) you must drag before it commits, otherwise it springs back |
| Loop | Turning past the last page wraps to page 1 |
| Preload pages | How many pages to preload on each side. **This directly drives texture memory**: a 1500×2000 image costs about 12MB, so an oversized value can crash mobile GPUs (symptom: blank pages that refuse to turn) |
| First-load hint / text / progress / footer note | Shows an overlay before assets are ready, avoiding a blank screen |
| Background color | The margin color around the book |
| Show page navigation | The bottom bar: catalog button on the left, page number in the middle, *Autoplay* on the right. Tapping the page number expands a draggable scrubber |
| Catalog button label | Label of the bottom-left button and the gallery title. Gallery contents come from the catalog entries configured in the studio (page + title + custom image) |
| 360 asset thumbnails | The strip above the navigation bar: one thumbnail per 360 asset on the current page; tapping the Nth starts from frame N. Hidden automatically when a page has none |
| Double-tap zoom | Double-tap a content page for a fullscreen view: pinch / wheel zoom, drag to pan, double-tap to reset |
| Autoplay interval | How often a page turns after tapping *Autoplay*; it stops on the last page |
| Page-turn sound / source / custom path / volume | Played through `<audio>`, so it still works with the phone's silent switch on. The bundled sound file is not distributed with this repository; supply your own at `lib/sound/book-voice.mp3` |
| 360 frame interpolation | Interpolation inside the popup (same setting as in *Image source*) |
| Share button / title / site URL / text | Opens the system share sheet on mobile, copies the link on desktop. In WeChat it prompts *tap ··· → forward to a friend* |

### 3. Export output

```
index.html            The page itself (the only entry point)
book/                 Page images + per-page 360 assets + catalog images
  ├ cover.jpg / back.jpg / page-1.jpg …
  ├ page-1/ page-2/ … 360 asset set attached to a page
  └ catalog/          Custom images from catalog entries (only if configured)
lib/                  Deploy the whole folder
  ├ 360-view.min.js      360 viewer
  ├ vysmo-flipbook.min.js Flip engine
  └ sound/book-voice.mp3  Page-turn sound (supply your own)
serve.ps1             Local preview server (do not upload)
启动.bat               Local preview launcher (do not upload)
```

For deployment you only need **`index.html` + `book/` + `lib/`**, with the folder hierarchy preserved. Flattening the paths makes images unfindable and the page renders blank.

### 4. The studio itself

- Left-hand page list: add / delete / reorder pages, each with an optional set of 360 assets
- Catalog entry manager: page + title + custom image
- Project import / export (JSON); assets are stored in the browser's local storage
- Image health check: flags oversized assets (keeping each under 500KB makes pages load much faster)

## Repository Layout

```
studio.html           The studio page (built from build/, do not edit by hand)
lib/                  Libraries and sound the exported page needs
serve.ps1             Local static server (plus the /@ping /@upload /@mat endpoints)
启动工作台.bat          Local launcher
使用说明.txt            Short guide for end users (Chinese)
build/                Build scripts and source
  ├ build.py          Build entry: generates studio.html + syntax self-check
  ├ check.js          Output syntax check
  ├ shell.html        Page skeleton
  ├ js/               Source modules (see below)
  ├ vendor/           Third-party libraries and sound (bundled into the output)
  └ vysmo-src/        Packaging source for the flip library (for upgrades)
desktop/              Portable desktop app (Electron)
```

`build/js/` modules:

| File | Responsibility |
| --- | --- |
| `01-schema.js` | Parameter definitions (matching Cloudimage 360 View 4.10.0) |
| `02-templates.js` | UI templates and styles |
| `03-materials.js` | Asset management |
| `04-preview.js` | Preview pane |
| `05-codegen.js` | Output generation |
| `06-hotspots.js` | Hotspot editing |
| `07-export.js` | Export (including image compression) |
| `08-app.js` | Studio shell and interactions |
| `09-dirimport.js` | Folder import |
| `11-book.js` | Flip-book data model and page management |
| `12-bookpage.js` | Output-side runtime (360 popup, flip engine, loading screen, sharing) |
| `13-store.js` | Local storage and project persistence |

## Architecture

### Flip engine selection in the exported page

Flipping is handled by `12-bookpage.js`. The rule is *use WebGL when it works, fall back to canvas when it doesn't*:

| Platform | Engine |
| --- | --- |
| iOS / desktop | WebGL page-curl via `@vysmo/flipbook` if the `webgl2OK()` capability probe passes, otherwise canvas |
| Android / HarmonyOS and other mobile | The built-in canvas 2D page-curl engine directly |

Why the split: some mobile engines **stop producing render frames** while a page is idle, so `requestAnimationFrame` nearly stalls — and the WebGL engine renders purely off rAF, which shows up as *a blank page until you touch the screen*. The canvas engine repaints from the `Image.onload` event (with polling and a synchronous first paint as backstops) and never depends on rAF, so it is far more reliable on mobile.

The choice can be overridden with a URL parameter for field debugging: `?engine=webgl` forces WebGL, `?engine=css` forces canvas. Append `?diag` to any page to open the diagnostics overlay (engine, renderer, version, canvas size, load and paint status).

### Local server endpoint contract

The command-line version (`serve.ps1`) and the desktop version (`desktop/main.js`) implement the same contract, which the studio relies on for asset import:

| Endpoint | Purpose |
| --- | --- |
| `GET /@ping` | Probe whether the local server is available (also used to re-import assets after a restart) |
| `POST /@upload` | Import an asset: body is the image, filename comes from the `x-file-name` header, returns `{url,size}` |
| `GET /@mat/<seq>/<name>` | Fetch an asset by the URL returned above (the 360 viewer needs a real URL, not a File / Blob) |
| `DELETE /@mat` | Clear assets |

If any of them is missing, the studio decides *preview unavailable* and refuses to import assets.

## Compatibility

| Target | Notes |
| --- | --- |
| Studio | Chromium-based browser (Chrome / Edge); must be served over HTTP, not `file://` |
| Exported page | Modern browsers; works in mobile browsers and WeChat's in-app browser |
| Desktop app | Windows 10 / 11, portable (bundles Chromium) |
| Building | Python 3 (standard library only); packaging the desktop app additionally needs Node.js |

## FAQ

**The exported page is blank**
The folder structure was probably flattened during deployment. Keep `book/` and `lib/` intact, and upload `lib/` in full — a missing `vysmo-flipbook.min.js` means pages won't turn, and a missing `sound/` means no page-turn audio. The sound file is not distributed with this repository — supply your own under `lib/sound/`.

**Opening `index.html` locally shows nothing**
Under `file://` the image requests made by the 360 viewer are treated as cross-origin and refused. It must go over HTTP(S). The export folder ships with `启动.bat` for local preview.

**On mobile there is no cover image, or it only appears after a swipe**
The platform-aware engine selection and load sequencing already handle this: the loading overlay is only dismissed once the current page can actually be painted. If you still hit it, open the `?diag` overlay and keep that screen of information.

**I changed a parameter but the live site looks the same**
Once deployed behind a CDN, the cache must be refreshed (purge from the console, or wait for it to expire).

## Third-party Dependencies and Licenses

| Component | Version | License | Purpose |
| --- | --- | --- | --- |
| [Cloudimage 360 View](https://github.com/scaleflex/js-cloudimage-360-view) | 4.10.0 | MIT | 360° panorama viewer |
| [@vysmo/flipbook](https://www.npmjs.com/package/@vysmo/flipbook) | 0.5.0 | MIT | Flip engine (WebGL page curl) |
| [rcedit](https://github.com/electron/rcedit) | — | MIT | Writes icon / version info when packaging the desktop app (development only) |
| Electron | 33.x | MIT | Runtime for the portable desktop app |

Full copyright notices and the file list are in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

> **The page-turn sound is not distributed with this repository.** When the page-turn sound is
> enabled the page reads `lib/sound/book-voice.mp3`; supply your own file at that path, or switch
> *Sound source* to *Custom path* in the studio.

## License

MIT — see [LICENSE](LICENSE).
