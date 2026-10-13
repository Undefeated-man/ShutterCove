# 软件更新 / Software updates

## 简体中文

v1.0.8 起，打开 **相册设置 → 软件更新**，可查看当前版本、检查新版，以及下载并安装更新。更早版本需要先手动安装 v1.0.8 或更新版本，之后才能使用应用内更新。

**仓库迁移：** 官方仓库现为 [Undefeated-man/ShutterCove](https://github.com/Undefeated-man/ShutterCove)，v1.2.1 起使用新地址检查和下载更新。v1.2.0 及更早版本的更新器限制在旧仓库地址，重命名后可能无法检查或下载；请从新仓库的正式 Release 下载 v1.2.1 或更新版本，退出旧 App，并在原安装路径替换。Mac 保留原应用名称，AppImage 替换原文件；deb 用系统安装器升级。同一系统用户和应用标识继续使用原有收藏、标签与设置。安装包仍使用 `Shiguang-Isle-` 文件名前缀，Mac 包内仍为 `Shiguang Isle.app`。

**自动更新默认开启**，可在 **相册设置 → 软件更新 → 自动下载并更新** 随时关闭。正式安装于可写位置的 Mac App 与 AppImage 会检查正式新版、自动下载并完成 SHA-256 与应用校验；随后在照片任务完成、编辑/设置/详情窗口关闭且没有当前多选时，显示 10 秒的重启倒计时并原位更新。打开窗口或开始新任务会重新等待。提醒条也可直接关闭自动更新。预发布及草稿版本不参与更新。

启动约 10 秒后检查一次，此后每小时检查是否已到下次检查时间；后台网络检查最多每 24 小时一次，手动检查不受此间隔限制。关闭开关会停止后台检查和自动安装。若关闭时已有下载正在进行，该次下载会完成校验并保留，应用不会自动重启；重新开启后，可继续先前的自动更新流程。手动“仅下载，稍后安装”的文件继续等待明确的安装操作，不会被自动更新接管。

若自动下载校验失败，或自动安装/启动失败，同一新版不会反复自动下载或安装；可查看错误并手动重试，也可等待其他正式版本。下载或安装中不能开始重复更新。演示模式和测试模式不联网、不自动安装。

Mac 和 AppImage 的“一键更新并重启”会下载与你的系统、架构匹配的安装包，核对官方校验表与 GitHub 文件摘要，再安装。请先保存当前设置或正在编辑的作品；手动启动的“一键更新并重启”流程关闭设置后会保留下载、取消自动重启；后台自动更新则等待窗口关闭后继续。deb 使用“下载并打开安装器”，完成系统安装后手动重新打开应用。

| 安装方式 | 应用内更新 |
| --- | --- |
| Mac Applications 内的 App | 替换当前 App 的原路径并重启，保留原安装名称 |
| Linux 可写位置的 AppImage | 原位替换当前 AppImage 并重启 |
| Linux deb | 自动检查并提醒；点击“下载并打开安装器”，由系统完成认证及包更新，完成后手动重新打开应用 |
| Mac DMG / 构建目录、只读安装位置 | 显示安装或权限要求，先将 App 正式安装到可写位置 |

收藏、标签、主题和设置继续使用原有应用资料。更新不复制原片或预览缓存；Mac / AppImage 原位安装前仅备份设置与相册元数据。原位替换在隐藏的更新工作目录内准备，成功后清理临时文件，不将新版作为另一个可搜索的 App 留下。下载或校验失败时保留当前版本；替换失败时尝试恢复旧版本并明确报告结果。deb 的安装与恢复由系统包管理器负责。

检查和下载只连接固定的 [官方 GitHub 仓库](https://github.com/Undefeated-man/ShutterCove/releases) 及其文件服务，不发送照片、标签、收藏或相册路径。GitHub 会像其他 HTTPS 请求一样接收网络连接信息，例如 IP 地址。

Mac 包仍使用 ad-hoc 签名，没有 Developer ID 或 Apple 公证。更新功能不改变系统安全设置；如果系统阻止新版打开，请按 [Mac 安装指南](mac-install.md) 处理单个 App 的允许流程。

## English

From v1.0.8, **Settings → Software update** shows the current version, checks for releases, and downloads and installs updates. Earlier versions require one manual installation of v1.0.8 or later before in-app updates become available.

**Repository migration:** The official repository is now [Undefeated-man/ShutterCove](https://github.com/Undefeated-man/ShutterCove). Version 1.2.1 and later check and download from the new address. Updaters in v1.2.0 and earlier restrict requests to the old repository, so checks or downloads may fail after the rename. Download v1.2.1 or later from the new repository's official release, quit the older app, and replace it at its existing installation path. Retain the installed Mac app name, replace the existing AppImage file, or upgrade deb through the system installer. The same system user and application identity continue using existing favorites, tags, and settings. Package filenames still begin with `Shiguang-Isle-`, and the Mac package still contains `Shiguang Isle.app`.

**Automatic updates are enabled by default.** Turn them off in **Settings → Software update → Download and update automatically**. A Mac app or AppImage installed in a supported writable location checks stable releases, downloads a matching package, and verifies its SHA-256 and application identity. It then waits until photo tasks have finished, editing/settings/details dialogs are closed, and no current selection remains. A visible 10-second restart countdown precedes in-place replacement. Opening a dialog or starting another task resets the countdown. The reminder banner can also turn automatic updates off. Drafts and prereleases are excluded.

The first check runs about 10 seconds after startup. An hourly timer checks whether another network request is due; background requests are limited to once per 24 hours. Manual checks are not limited by that interval. Disabling the switch stops background checks and automatic installation. If a download is already running, it finishes verification and remains available for manual installation without restarting. Re-enabling the switch resumes an earlier automatic update. The explicit “Download only, install later” action stays manual and is never silently taken over by automatic installation.

A failed automatic download, installation, or launch is not repeatedly retried for the same release. Review the error and retry manually, or wait for a different stable version. Concurrent update attempts are blocked. Demo and test modes never contact the update server or install automatically.

For Mac and AppImage, the update-and-restart action downloads the package matching your platform and architecture and verifies it against the official checksum file and GitHub asset digest before installation. Save settings and current editing work first. Closing settings after a manually initiated update-and-restart action retains the download and cancels that restart. A background automatic update instead waits for the dialog to close and then resumes. The deb action downloads and opens the system installer; reopen the app manually after system installation finishes.

| Installation | In-app update |
| --- | --- |
| Mac App in Applications | Replace and relaunch the existing app at the same path, retaining its installed name |
| AppImage in a writable Linux location | Replace and relaunch the current AppImage in place |
| Linux deb | Automatically check and remind; explicitly download and open the system package installer for authentication, then reopen the app manually |
| Mac disk image / build directory, or read-only installation | Show installation or permission requirements; install the app properly in a writable location first |

Favorites, tags, themes, and settings continue using existing application data. Updates do not copy photographs or the preview cache; only settings and library metadata are backed up before in-place Mac / AppImage installation. Replacement is prepared in hidden update work directories. Temporary files are cleaned after success without leaving a second searchable app. Download or verification failures leave the installed version in place. Failed replacement attempts restore the older version where possible and report the outcome. The system package manager handles deb installation and recovery.

Checks and downloads contact only the fixed [official GitHub repository](https://github.com/Undefeated-man/ShutterCove/releases) and its file services. They do not send photographs, tags, favorites, or library paths. As with other HTTPS requests, GitHub receives network connection information such as your IP address.

Mac packages remain ad-hoc signed, without a Developer ID or Apple notarization. Updates do not change system security settings. If macOS blocks a newer version, follow the per-app approval process in the [Mac installation guide](mac-install.md).

Implementation references: [Electron autoUpdater](https://www.electronjs.org/docs/latest/api/auto-updater), [GitHub release asset API](https://docs.github.com/en/rest/releases/assets), [Apple app-opening guidance](https://support.apple.com/en-us/102445).


GitHub 公共更新接口可能暂时限流。检查失败时可稍后重试，或核对同版校验表后从官方 Release 手动安装；沿原安装路径替换，同一系统用户与应用标识继续使用收藏、标签和设置。

GitHub public update checks can temporarily be rate-limited. Retry later or manually install from the official release after checksum verification. Replacing the original installation path under the same user and application identity retains favorites, tags, and settings.
