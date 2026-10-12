# Shiguang Isle · 拾光屿

**Language:** [English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

## English

**A local desktop photo library built specifically for DSLR and mirrorless photographers who shoot RAW.**

Shiguang Isle follows your photography workflow: import from an SD card, browse RAW / JPEG pairs, select your best shots, hand files to an editor, and turn photographs into posters or animated stories. Available for macOS and Linux. **Currently supports JPEG and Canon CR3; RAW support is limited to CR3.**

- **Keep RAW and JPEG together.** Browse matching files as a pair, inspect details with zoom and fullscreen, and open either format in Photoshop / Lightroom on Mac or a configured local editor on Linux.
- **Browse quickly without duplicating originals.** On-demand thumbnails, nearby-photo prefetching, and a bounded, removable preview cache keep the library light while originals stay in their folders.
- **Find and curate your best photographs.** Filter by date, color, theme, and tags; collect favorites, tag in batches, and search similar photographs on demand without building a vector database first.
- **Make collages and posters with control over composition.** Zoom and move each photograph within its cell, preserve original aspect ratios in a magazine poster, or freely position, resize, rotate, and overlap full photographs on a wooden board. Set title size, arrange the story, and preview the actual encoded share JPEG before saving the same result.
- **Create GIF stories and memes.** Scroll a filmstrip, drag frames to reorder, and add movable speech bubbles or text to each photograph. Choose output scale, palette, frame timing, and looping; preview a real encoded GIF, or save one frame as a static PNG meme.
- **Organize from SD card to delivery.** Import by capture date and gather selections across folders into one destination, optionally including CR3. Favorite synchronization first moves other JPEG / CR3 files on the chosen SD card into a recoverable pending-deletion folder for review.

*Give every captured moment a small island to return to.*

## 简体中文

**专为拍摄 RAW 的单反与微单摄影用户量身定制的本地桌面相册。**

拾光屿围绕相机摄影的完整流程设计：从 SD 卡导入、RAW / JPEG 配对浏览、精选整理和修图交接，到拼图海报与光影动图，让照片更容易找、选、用。支持 macOS 与 Linux；**当前支持 JPEG 与 Canon CR3，RAW 支持目前限于 CR3。**

- **一张照片，RAW / JPEG 一起管理。** 配对浏览、放大查看细节与全屏看图；Mac 可交给 Photoshop / Lightroom，Linux 可配置本机编辑器。
- **轻量预览，减少等待和存储负担。** 缩略图按需加载、预读，缓存有上限且可清理；原片留在原目录，浏览不额外复制完整照片。
- **从一堆照片中找出值得留下的作品。** 按日期、色系、主题和标签筛选，收藏精品、批量加标签；相似照片按需计算，无需预先建立向量库。
- **拼图与海报，让每张照片都有合适的构图。** 单张缩放、拖动格内位置；杂志海报保留原比例，木质展示板可自由移动、调大小、旋转和叠放完整照片。标题字号可调，分享压缩展示实际编码成品，预览与保存一致。
- **GIF 与表情包，让回忆一帧一帧流动。** 滚轮浏览电影胶片、拖拽换序，逐帧添加可移动的对话气泡与文字；设置尺寸、色彩数、时长和循环，预览真实 GIF，也可保存单帧 PNG 表情包。
- **从 SD 卡整理到作品交付。** 新照片按拍摄日期归档，跨目录选片后一键复制，可选携带 CR3；精品同步先将 SD 卡里其他 JPEG / CR3 移入可恢复的待删文件夹，方便核对。

*把一次快门，留成一座可以重返的小岛。*

**The app supports English and Simplified Chinese.** A fresh installation starts in English and asks you to choose a language before the usage guide. Existing Chinese profiles stay in Chinese after an upgrade. Switch instantly in **Settings → Interface language**; your choice is remembered. Japanese and Korean guides are documentation translations; their interface languages may be added according to demand.

**App 当前支持英文与简体中文。** 全新安装默认英文，首次打开先选择语言，再进入使用引导；已有中文用户升级后保留中文。在**设置 → 界面语言**可一键切换并记住选择。日文和韩文页面为使用说明翻译，后续根据需求增加界面语言。

![Photo gallery / 相册浏览：synthetic landscapes only / 仅合成风景](docs/screenshots/gallery-en.png)

![GIF and meme studio / GIF 与表情包工作台：synthetic artwork only / 仅合成画面](docs/screenshots/motion-studio.png)

All screenshots use synthetic artwork, with no private photographs, real portraits, personal paths, or real capture metadata. 所有截图使用合成画面，不含私人原片、真人肖像、个人路径或真实拍摄信息。

## Installation

Download the package for your computer from [GitHub Releases](https://github.com/Undefeated-man/shiguang-isle/releases). Filenames start with `Shiguang-Isle-` followed by the version; the table shows their platform suffixes.

| Computer | Package suffix | Installation |
| --- | --- | --- |
| Apple Silicon Mac | `mac-arm64.dmg` | Open the disk image and drag the app into Applications |
| Intel Mac | `mac-x64.dmg` | Open the disk image and drag the app into Applications |
| Linux x64 | `linux-x86_64.AppImage` | Make the file executable, then run it |
| Debian / Ubuntu x64 | `linux-amd64.deb` | Open it in your software installer, or use `sudo apt install ./package-name.deb` |

### First launch on macOS: Apple cannot verify the app

**Current Mac packages are ad-hoc signed, without a Developer ID certificate or Apple notarization. Gatekeeper may therefore block the first launch.** This does not mean Apple has verified the app's safety.

1. Download the matching architecture from this repository's [official Release](https://github.com/Undefeated-man/shiguang-isle/releases). Compare its SHA-256 with `SHA256SUMS.txt` from the **same version**.
2. Open the DMG and drag **Shiguang Isle.app** into **Applications**. For ZIP packages, extract the app and move it into Applications.
3. Try opening the installed app once. If blocked, go to **System Settings → Privacy & Security → Security**, find its message, and choose **Open Anyway**.
4. Confirm **Open** in the next prompt and authenticate if requested. macOS saves an exception for this app; later launches usually work directly.

If the button is absent, try opening the app in Applications again, then revisit that setting. On a managed Mac, contact your administrator. If the warning says **“will damage your computer” or “is damaged,”** stop using it, download and verify a fresh copy, or report the issue; those warnings must not automatically be attributed to missing notarization. Keep Gatekeeper enabled and use the per-app system approval.

See the [bilingual Mac installation guide](docs/mac-install.md) and [Apple's official guidance](https://support.apple.com/en-us/102445).

Some Linux distributions require FUSE 2 for AppImage. Photoshop and Lightroom have no official Linux desktop editions; use the editor settings to select an executable installed on your machine.

To update on Mac, quit the running older version, drag the new app into Applications, choose Replace, and launch the new copy from Applications. Keep the same macOS account and application identifier to continue using existing local settings, tags, and favorites without copying photographs again. Verify the new package against its same-version checksums; follow the per-app approval steps above if macOS requests them again.

Starting with v1.0.8, **Settings → Software update** shows the installed version and offers manual checks and downloads; earlier versions need one manual installation of v1.0.8 or later. Automatic checks are on by default and only notify; installation requires your click. For Mac / AppImage, the update-and-restart action verifies downloads and retains the existing installation path and local data. Mac apps need a writable Applications location; they cannot update in place from a disk image or build folder. AppImages also need a writable location. The Linux deb action downloads and opens the system package installer for authentication and installation; reopen the app manually afterward. See the [update guide](docs/updates.md).

On first launch, choose **English** or **Chinese** before the five-step guide. Switch instantly in **Settings > Interface language**; your choice is remembered after restarting. Existing Chinese profiles retain Chinese after an upgrade, along with their library, favorites, tags, and settings.

![First-launch language choice: synthetic screenshot](docs/screenshots/language-welcome.png)

## Features

| Feature | How it works |
| --- | --- |
| Interface language | English and Simplified Chinese; first-launch language choice and instant switching in Settings, remembered across restarts |
| First-use guide | Five steps introduce the library and photo workflow; skipping or finishing saves the state, and Settings can reopen the guide |
| Update checks and installation | Check manually in Settings or receive automatic reminders; installed Mac apps and writable AppImages can download, verify, replace themselves in place, and restart while preserving favorites, tags, and settings |
| Detail zoom and pan | Hold Option / Alt while scrolling to zoom, then drag to pan; choose Fit to window or double-click to reset, with up to 16× relative zoom |
| Native fullscreen details | Click Fullscreen or press F, switch between JPEG / CR3 previews, and browse adjacent photographs; Esc leaves fullscreen first, then closes details |
| Color organization | Analyze image colors automatically and browse within a date range |
| Date and theme search | Pick dates from a calendar or type them directly, search theme names, and assign themes to individual or selected photographs |
| Date timeline | A slim rail expands a translucent date badge on hover or press; scrub to dates across all currently filtered results, with newest-first browsing by default |
| Similar photographs | Choose a directory and compare average-pooled RGB pixels using cosine similarity; adjustable granularity, estimated time, progress, and cancellation |
| Collages and posters | Vertical and horizontal strips, four-cell and nine-cell layouts, whitespace, film, original-ratio magazine, and wooden-board layouts; posters support 1–12 photos per row, defaulting to 2, adjustable title size, and new JPEG export |
| Per-photo composition | Select a photograph and adjust its scale and position within a cell, choosing cover or contain; composition follows the photograph when reordered, independently of canvas zoom |
| Controlled share compression | Process originals individually and encode the final JPEG with adjustable maximum edge and quality; preview and save use the same encoded bytes while preserving originals |
| GIF and meme creation | Scroll through a filmstrip and drag to reorder, add text or bubbles per frame, set size, palette, global frame delay, and looping; preview an encoded GIF or save a static meme frame |
| Favorites | Mark favorite photographs and browse them in a dedicated view |
| Individual and batch tags | Edit tags on one photograph or add tags to a selection |
| Shared filters | Date, color, theme, and tag restrictions work across all photos, favorites, color browsing, similarity results, and collage photo selection |
| Sticky gallery toolbar | Filtering, selection, and sorting controls stay at the top; returning focus after calendar or menu interactions preserves the scroll position |
| Frosted-glass dropdowns | Sage styling matches the calendar; show up to six options with subtle scroll-edge fades, searchable long lists, arrow-key selection, Enter to confirm, and Esc to close |
| Responsive window and font size | Resize the window; a persistent font-size slider in Settings previews changes immediately, defaults to 120%, and supports 100%–150% |
| Simple editing | Crop, rotate, mirror horizontally or vertically, and apply rectangular or elliptical pixel mosaics; overwrite a JPEG or save a new file |
| SD card import | Copy new photographs into a chosen memories root, use an existing or new theme, organize by capture date, and skip duplicate content |
| Batch selection and deletion | Multi-select, range selection, and select all filtered results; move files to the system trash after confirmation |
| Copy a selection to a folder | Choose an existing folder or create one in the picker, then collect JPEGs from different subfolders into one flat destination; optionally include CR3 (off by default), with unique collision names shared by each pair, progress, cancellation, and results |
| Favorite synchronization to SD | Preview files to keep from favorites or the current selection, then move other JPEG / CR3 files into a recoverable `待删` batch with a journal |

Photo details display JPEG and its corresponding CR3 preview together, stacked in the same detail view. Each format has Photoshop, Lightroom, and system-open buttons. Large landscape, portrait, and panoramic photographs fit completely within the preview frame while preserving their aspect ratio; the frame adapts to the window height. Scroll the detail view to reach the lower CR3 preview and editor buttons, while previous / next controls stay available. Browsing creates lightweight cached previews rather than full original copies.

![Paired JPEG / CR3 previews and editor handoff using synthetic landscapes](docs/screenshots/paired-preview.png)

The paired-preview screenshot uses generated photographs and sample metadata, with no real people or private capture information.

In photo details, hold **Option (Mac) / Alt** while scrolling to zoom in or out, then drag the enlarged image to pan; ordinary scrolling still scrolls the detail view. Choose “适合窗口” (Fit to window) or double-click the image to reset. With the preview focused, use + / − to zoom and 0 to reset. **100% is relative to the fitted view, not a 1:1 original-pixel scale**; the maximum is 16 times the fitted size. JPEG and CR3 previews zoom independently; changing photographs or resizing the preview area restores the fitted view. CR3 zoom uses the camera's embedded preview rather than RAW development, so clarity depends on that preview's resolution.

Click Fullscreen beside a preview or press **F** to enter the operating system's fullscreen mode. Switch between JPEG / CR3 previews, use ← / → for adjacent photographs, and keep zooming and panning. **Esc** returns to details first; press it again to close details. Closing restores the window's prior fullscreen state.

![Independent detail zoom: synthetic JPEG at 223%, with the CR3 embedded preview still fitted](docs/screenshots/detail-zoom.png)

![Collage preview zoom and photos-per-row controls using synthetic photographs](docs/screenshots/collage-zoom.png)

Choose “调整构图” (Adjust composition), select a photograph, and drag within its cell, change its scale, or choose contain to keep it complete. Reordering thumbnails keeps the composition attached to the photograph. Alt / Option + scroll zooms the whole canvas; when zoomed, ordinary dragging pans the canvas and **Shift + drag** adjusts the selected photograph.

The original-ratio magazine layout keeps complete photographs in their original proportions with a separate title area. On the wooden display board, move full photographs, resize or rotate them, and change their stacking order with overlap allowed. Title size is specified in pixels at the export width and scales with a smaller output.

![Original-ratio magazine: complete photographs and a separate title area, using synthetic images](docs/screenshots/collage-magazine.png)

![Wooden display board: movable, rotated, resized, and overlapping synthetic photographs](docs/screenshots/collage-board.png)

Enable proactive share compression, set the maximum edge and JPEG quality, and inspect the encoded result, dimensions, and file size. Preview decoding and saving use the same JPEG bytes. Composition or layout changes regenerate the result; processing preserves originals and creates no intermediate copies in photo folders. An anonymous **3000 × 8364 → 516 × 1440** sample supports a **1440-pixel / quality-80** reference preset only. It does not establish a universal WeChat rule or guarantee avoidance of further compression. Shrinking a tall collage reduces detail in each photograph; WYSIWYG refers to this app's exported file.

Select photographs with JPEGs and open GIF / meme creation. Scroll through the filmstrip, drag thumbnails to reorder, and add or drag text and bubbles on the current frame. Configure output scale, palette size, global frame delay, and looping, then generate the actual GIF preview and save the same result; a single photograph can also become a static meme. CR3-only photographs require a JPEG export first. Encoding provides progress and cancellation. GIF supports at most 256 colors, so photographic gradients may show banding.

![GIF and meme studio: filmstrip ordering and text-bubble editing, with encoded preview generation using synthetic images](docs/screenshots/motion-studio.png)

See the [bilingual creative-studio guide](docs/creative-studio.md). These creative views contain synthetic photographs with no real people or private data.

![Update checks and version reminders: demonstration states without private data](docs/screenshots/update-settings.png)

![Font settings: larger defaults and an immediate preview](docs/screenshots/font-settings.png)

Pick a date from the calendar or type it directly. The slim timeline expands a translucent date badge to help you jump through the current filtered results.

![Calendar filtering with clickable dates and direct date input](docs/screenshots/calendar.png)

![Slim timeline with an expanded date badge for quick navigation](docs/screenshots/timeline.png)

![Sticky gallery controls after scrolling: filtering, selection, and sorting using synthetic landscapes](docs/screenshots/sticky-toolbar.png)

![Frosted-glass filters with six-row scrolling and subtle edge fades](docs/screenshots/dropdown.png)

![Batch folder copy: JPEG by default, optional CR3, and a target folder picker with new-folder support](docs/screenshots/copy.png)

SD favorite synchronization shows the keep and move lists before confirmation. Other photographs move into a recoverable `待删` batch. This screenshot shows only a synthetic preview; no move was executed and no real SD card was accessed.

![SD favorite synchronization preview with keep and move lists](docs/screenshots/sd-sync.png)

These screenshots use synthetic photographs, with no real portraits, private paths, or real capture information.

## Using the library

A five-step guide appears on the first normal launch: a local JPEG / CR3 library; opening a folder or importing from SD; filters, favorites, and tags; editing and sharing; and reviewing SD organization before confirmation. Use ← / → to navigate. Skipping or finishing saves completion so later launches do not open it automatically; failed saves can be retried.

Choose “开始浏览” (Start browsing) to close the guide, or “选择照片文件夹” (Choose photo folder) to open the folder picker. The guide explains operations without organizing photographs automatically. Existing users with a configured library are not interrupted on upgrade. Reopen it through **相册设置 → 重新查看使用引导** (Album Settings → View usage guide again).

![Five-step first-use guide with synthetic JPEG / CR3 artwork and no private photographs](docs/screenshots/onboarding.png)

1. Choose a photo root. The app scans recursively and identifies JPEG / CR3 pairs using names, dates, and directory relationships while retaining the original file locations.
2. Filter by date range, color, tags, and theme. Pick dates from the calendar or type them directly. Scrub the slim date rail to jump across all filtered results; hovering or pressing expands a translucent date badge. Browsing defaults to newest first. Use the favorites view to revisit your selected photographs.
3. Select multiple photographs to add tags, mark favorites, copy to a folder, or move files to trash. Use “Copy to folder” to collect photographs from different subfolders, choosing an existing destination or creating a folder in the picker. JPEGs are copied by default, and you can include corresponding CR3 files. Originals remain in place; collisions receive unique names shared by each JPEG / CR3 pair. Review progress and copied, skipped, or failed results, and cancel when needed. RAW-only photographs are skipped unless CR3 copying is enabled. A single photograph can still be revealed in the file manager or handed to an editor as JPEG or CR3.
4. Open similarity search, choose a reference photograph and search directory, then select pooling granularity. Computation happens for that search; results can be filtered further by date and other shared conditions.
5. Open the collage workspace, choose a layout, and adjust photographs individually. Whitespace, film, and original-ratio magazine posters support 1–12 photos per row, defaulting to 2. Move photographs, adjust angles, and change stacking order on the wooden display board. Drag thumbnails to reorder or choose canvas swapping for direct exchanges. Alt / Option scrolling zooms the preview; ordinary dragging pans the canvas and Shift + drag adjusts a photograph. Fit to window resets the view. With share compression enabled, inspect the encoded JPEG result before saving a new photograph.
6. Use the editor to crop, rotate, mirror, or add rectangular and elliptical mosaics. Choose overwrite or save-as. Canvas exports do not retain the original EXIF; editing does not overwrite CR3 files.
7. Import from an SD card or another directory into your chosen memories root. Pick an existing theme or create one. Files are copied, sorted by capture date, and checked for duplicates; source files remain available.
8. Synchronize favorites or the current selection to an SD card. Review the keep and move lists first. Other photographs move into a `待删` batch on that card with their relative paths and a journal. Empty matches, ambiguity, or files changing after preview stop execution.
9. Select photographs with JPEGs and open GIF / meme creation. Scroll through frames, drag to reorder, and add text per frame. Generate an encoded preview before saving the GIF, or save the current frame as a static meme.

Moving files into `待删` preserves their contents and does not immediately free card space. Open the batch directory to review or restore files to their recorded original locations; remove pending files yourself when you decide they are no longer needed.

Themes and tags are manually assigned local metadata. Color families are derived from image pixels and help find warm, blue, green, or similar visual tones; they do not identify locations or interpret a photograph's story.

Filter and sort dropdowns support mouse and keyboard use. Long lists show up to six options at a time and support scrolling or option search. Use ↑ / ↓ to move, Enter to confirm, and Esc to close. Subtle blurred edges indicate more scrollable content.

CR3 display uses the camera's embedded preview rather than full RAW development. Photoshop normally delegates RAW handling to Adobe Camera Raw. Lightroom may show an import dialog depending on its installed version; the app hands over the file and does not complete Adobe catalog imports automatically.

Vertical and horizontal collages have no fixed photograph-count limit. To control memory, canvases are limited to a **24,000 px** long edge and **48 million pixels**. Larger results are scaled proportionally. Simple editing follows the same limit for unusually large originals; use your professional editor for full-resolution development beyond it.

GIF supports **2–80 frames**, up to **1,600 px** per side, **24 million pixels** across all frames, and **24 MB** of encoded data. The interface scales dimensions to fit the pixel budget and reports remaining limit errors. A single photograph can be saved as a static meme. These resource limits do not describe another app's sending restrictions.

The gallery's filtering, selection, and sorting toolbar stays at the top as you scroll. Adjust conditions, change the order, or act on selected photographs without returning to the beginning. Its height adapts to the window and font size, and photo navigation reserves space beneath it. Returning focus after opening or closing the calendar or a menu, or confirming an option, preserves the current scroll position.

## Performance and storage

Thumbnails are generated on demand, with visible and nearby photographs prioritized. Scans deliver early batches to the gallery and reuse cached file metadata on subsequent scans. RAW previews use embedded images where available. The preview cache is capped at **512 MB**, evicts less recently used entries, and can be cleared manually. Browsing does not create full-resolution original copies.

Local records, favorites, tags, themes, settings, and clearable previews are stored in the operating system's application-data directory (Electron `userData`). An initial large-library scan still needs to read file information. Damaged, offline, or preview-less RAW files can show an error while other photographs remain usable.

Overwrite editing, collage exports, batch copies, and SD imports create or change files according to your choices. Batch copies leave originals in place; completed copies remain when you cancel. Batch deletion uses system trash with a count and confirmation before execution. Permission failures, disconnected drives, and insufficient space are reported as operation errors.

## Development and builds

Use Node.js 22, npm, and macOS or Linux. ExifTool requires system Perl on Linux; macOS includes Perl.

```sh
npm ci
npm test
npm run privacy
npm run icon
npm start
```

Run the synthetic demonstration:

```sh
npm run demo
```

Build installation packages:

```sh
# Build on a Mac with the corresponding architecture
npm run build:mac
# Build on Linux x64
npm run build:linux
```

Packages are written to `dist/`. GitHub Actions builds on macOS 15 arm64, macOS 15 Intel, and Ubuntu 22.04 x64, then launches the packaged applications for gallery, collage-limit, SD interface, font settings, calendar input, date timeline, dropdown menus, batch-copy interface and real disk copies, production IPC, disk-export, and recoverable SD synchronization checks using synthetic fixtures. Successful assembly produces a draft Release with packages and checksums. Push a `v` tag matching `package.json`, or manually run the workflow for an existing tag. Review the draft before publishing.

## Privacy and licenses

The app has no account system, telemetry, photo-upload feature, or online photo analysis. Update checks contact only this project's GitHub Releases and package download services without sending photos, tags, or library paths; automatic checks can be turned off in Settings. The public repository contains source code, icons, and synthetic screenshots. `npm run privacy` checks for original media, runtime databases, personal absolute paths, and common secret formats. Screenshot contents also require visual review.

Application source uses the [MIT License](LICENSE). Electron, Sharp, ExifTool, and other dependencies retain their own licenses. ExifTool is by Phil Harvey and uses the same dual-license terms as Perl; see [Architecture and third-party notices](docs/architecture.md).

See [Validation records and limitations](docs/validation.md) for what has actually been tested and the remaining boundaries.
