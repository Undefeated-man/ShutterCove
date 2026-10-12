# macOS 安装与首次打开 / Installation and first launch

[简体中文](#简体中文) · [English](#english)

## 简体中文

### 为什么会显示安全性提示？

当前时光杂货店 Mac 发布包使用 ad-hoc 签名，没有 Apple Developer ID 证书，也未经过 Apple 公证。首次启动时，macOS 可能提示无法验证开发者或无法检查恶意软件。这不是 Apple 对软件安全性的认可。请先核对下载来源和文件完整性，再自行决定是否允许运行。[Apple 官方说明](https://support.apple.com/zh-cn/102445)

### 先确认下载与校验

只从 [Undefeated-man/ShutterCove 的正式 Releases](https://github.com/Undefeated-man/ShutterCove/releases) 下载。Apple Silicon 选 `mac-arm64.dmg`，Intel 选 `mac-x64.dmg`；ZIP 提供同一个应用。校验表必须来自同一版本，不能混用旧版文件。

终端校验示例使用下载文件夹和 v1.0.3 Apple Silicon 包；下载其他版本或 Intel 包时，替换文件名：

```sh
cd ~/Downloads
shasum -a 256 Shiguang-Isle-1.0.3-mac-arm64.dmg
```

将输出的 64 位十六进制值与 `SHA256SUMS.txt` 中**同名文件**的值逐字比较。不一致时不要打开；重新下载、核对版本与架构，仍不一致请报告。匹配只说明文件与发布资产一致，不代表 Apple 已审核或保证软件安全。

### 安装并允许这个 App

1. 打开 DMG，将 **Shiguang Isle.app** 拖到 **Applications（应用程序）**。使用 ZIP 时先解压，再移入应用程序。
2. 在应用程序中双击它，先尝试打开一次。如果系统阻止，请关闭提示。
3. 进入 **系统设置 → 隐私与安全性**，向下找到 **安全性** 区域及这个 App 的提示，点 **“仍要打开”**。
4. 再次出现提示时点 **“打开”**；需要时使用系统要求的认证方式。

系统为这个 App 保存安全性例外，之后通常可以直接打开。该流程只允许所选 App；请保持 Gatekeeper 开启。

### 没有按钮，或提示不同？

- 没有“仍要打开”：确认打开的是 Applications 内的 **Shiguang Isle.app**，重新尝试打开一次，再查看设置。管理设备的安全策略可能限制操作，请联系管理员。
- 提示“将损坏你的电脑”或“已损坏”：先停止使用。重新从正式 Release 下载并核验，或 [报告问题](https://github.com/Undefeated-man/ShutterCove/issues)，附 macOS 版本、包版本与提示原文；不要附私人路径、照片或账户信息。不同警告可能涉及不同原因，不能保证按同一流程解除。[Apple 对不同警告的说明](https://support.apple.com/zh-cn/102445)

## English

### Why does macOS show a warning?

Current Shutter Cove Mac releases use ad-hoc signatures, without an Apple Developer ID certificate or Apple notarization. macOS may block the first launch because it cannot verify the developer or check for malicious software. Apple has not endorsed the app's safety. Verify the source and integrity before deciding whether to allow it. [Apple guidance](https://support.apple.com/en-us/102445)

### Verify the download

Use this repository's [official Releases](https://github.com/Undefeated-man/ShutterCove/releases). Choose `mac-arm64.dmg` for Apple Silicon or `mac-x64.dmg` for Intel; ZIP contains the same app. Download `SHA256SUMS.txt` from that exact version.

Example for a v1.0.3 Apple Silicon download; substitute the actual filename for other versions or Intel:

```sh
cd ~/Downloads
shasum -a 256 Shiguang-Isle-1.0.3-mac-arm64.dmg
```

Compare the 64-character hexadecimal result with the matching filename in the manifest. Do not open a mismatch; download again and check the version, then report persistent differences. Matching hashes establish consistency with the published asset, not Apple review or guaranteed safety.

### Install and approve this app

1. Open the DMG and drag **Shiguang Isle.app** into **Applications**. Extract ZIP packages before moving the app.
2. Try opening the installed app once. Dismiss the warning if it is blocked.
3. Open **System Settings → Privacy & Security → Security**, find this app's message, and choose **Open Anyway**.
4. Confirm **Open** and authenticate if requested.

macOS remembers this app-specific exception. Keep Gatekeeper enabled. If the button is absent, try the installed app again and revisit Settings; contact your administrator on a managed Mac. For **“will damage your computer” or “is damaged”**, stop using it, redownload and verify, or [report the warning](https://github.com/Undefeated-man/ShutterCove/issues) without private data. Different warnings may have different causes. [Apple warning guidance](https://support.apple.com/en-us/102445)
