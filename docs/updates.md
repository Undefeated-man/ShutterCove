# 软件更新 / Software updates

## 简体中文

v1.0.8 起，打开 **相册设置 → 软件更新**，可查看当前版本、检查新版，以及下载并安装更新。更早版本需要先手动安装 v1.0.8 或更新版本，之后才能使用应用内更新。

默认自动检查正式新版，有新版时显示提醒。检查不会自动安装，也不会打断照片编辑；可以关闭自动检查，随时手动检查。预发布及草稿版本不参与自动更新。

Mac 和 AppImage 的“一键更新并重启”会下载与你的系统、架构匹配的安装包，核对官方校验表与 GitHub 文件摘要，再安装。请先保存当前设置或正在编辑的作品；关闭更新界面可将已下载的更新留待稍后安装。deb 使用“下载并打开安装器”，完成系统安装后手动重新打开应用。

| 安装方式 | 应用内更新 |
| --- | --- |
| Mac Applications 内的 App | 替换当前 App 的原路径并重启，保留原安装名称 |
| Linux 可写位置的 AppImage | 原位替换当前 AppImage 并重启 |
| Linux deb | 点击“下载并打开安装器”，由系统完成认证及包更新，完成后手动重新打开应用 |
| Mac DMG / 构建目录、只读安装位置 | 显示安装或权限要求，先将 App 正式安装到可写位置 |

收藏、标签、主题和设置继续使用原有应用资料。更新不复制原片或预览缓存；Mac / AppImage 原位安装前仅备份设置与相册元数据。原位替换在隐藏的更新工作目录内准备，成功后清理临时文件，不将新版作为另一个可搜索的 App 留下。下载或校验失败时保留当前版本；替换失败时尝试恢复旧版本并明确报告结果。deb 的安装与恢复由系统包管理器负责。

检查和下载只连接固定的 [官方 GitHub 仓库](https://github.com/Undefeated-man/shiguang-isle/releases) 及其文件服务，不发送照片、标签、收藏或相册路径。GitHub 会像其他 HTTPS 请求一样接收网络连接信息，例如 IP 地址。

Mac 包仍使用 ad-hoc 签名，没有 Developer ID 或 Apple 公证。更新功能不改变系统安全设置；如果系统阻止新版打开，请按 [Mac 安装指南](mac-install.md) 处理单个 App 的允许流程。

## English

From v1.0.8, **Settings → Software update** shows the current version, checks for releases, and downloads and installs updates. Earlier versions require one manual installation of v1.0.8 or later before in-app updates become available.

Automatic checks are enabled by default and display a reminder for newer stable releases. Checks do not install updates or interrupt photo editing. You can turn them off and check manually at any time. Drafts and prereleases are excluded.

For Mac and AppImage, the update-and-restart action downloads the package matching your platform and architecture and verifies it against the official checksum file and GitHub asset digest before installation. Save settings and current editing work first. Closing the update interface leaves the download for installation later. The deb action downloads and opens the system installer; reopen the app manually after system installation finishes.

| Installation | In-app update |
| --- | --- |
| Mac App in Applications | Replace and relaunch the existing app at the same path, retaining its installed name |
| AppImage in a writable Linux location | Replace and relaunch the current AppImage in place |
| Linux deb | Download and open the system package installer for authentication and installation, then reopen the app manually |
| Mac disk image / build directory, or read-only installation | Show installation or permission requirements; install the app properly in a writable location first |

Favorites, tags, themes, and settings continue using existing application data. Updates do not copy photographs or the preview cache; only settings and library metadata are backed up before in-place Mac / AppImage installation. Replacement is prepared in hidden update work directories. Temporary files are cleaned after success without leaving a second searchable app. Download or verification failures leave the installed version in place. Failed replacement attempts restore the older version where possible and report the outcome. The system package manager handles deb installation and recovery.

Checks and downloads contact only the fixed [official GitHub repository](https://github.com/Undefeated-man/shiguang-isle/releases) and its file services. They do not send photographs, tags, favorites, or library paths. As with other HTTPS requests, GitHub receives network connection information such as your IP address.

Mac packages remain ad-hoc signed, without a Developer ID or Apple notarization. Updates do not change system security settings. If macOS blocks a newer version, follow the per-app approval process in the [Mac installation guide](mac-install.md).

Implementation references: [Electron autoUpdater](https://www.electronjs.org/docs/latest/api/auto-updater), [GitHub release asset API](https://docs.github.com/en/rest/releases/assets), [Apple app-opening guidance](https://support.apple.com/en-us/102445).
