# 验证记录与功能边界

本文件记录可以复现的验证方式。记录“通过”必须对应实际运行结果，截图和生成安装包不能代替真实机器上的安装与使用验收。

## 验证命令

```sh
npm ci
npm test
npm run privacy
npm run icon
# 在桌面环境运行合成图库界面验收
npx electron . --demo --smoke --qa-script scripts/ui-smoke.js
# SD 卡精品同步界面验收，仅使用合成演示数据
npx electron . --demo --smoke --qa-script scripts/sync-ui-smoke.js
# 小窗口字号、日历输入与时间轴验收，仅使用合成演示数据
npx electron . --demo --smoke --compact --qa-script scripts/font-ui-smoke.js
npx electron . --demo --smoke --compact --qa-script scripts/date-ui-smoke.js
npx electron . --demo --smoke --compact --qa-script scripts/timeline-ui-smoke.js
# v1.0.2 下拉菜单与批量复制界面验收，仅使用合成演示数据
npx electron . --demo --smoke --compact --qa-script scripts/dropdown-ui-smoke.js
npx electron . --demo --smoke --compact --qa-script scripts/copy-ui-smoke.js
# 扫描完成后的迟到进度回归，仅使用合成演示数据
npx electron . --demo --smoke --compact --qa-script scripts/scan-ui-smoke.js
# v1.0.3 滚动时固定图库工具栏，仅使用合成演示数据
npx electron . --demo --smoke --compact --qa-script scripts/sticky-ui-smoke.js
```

后端单元测试覆盖照片日期与配对、相似度排序与粒度、碰撞保护、缓存清理和路径授权；界面脚本覆盖筛选、多选、收藏、拼图和编辑。测试照片使用临时生成的合成图，不提交用户原片。

GitHub Actions 运行这些检查并分别在 Mac arm64、Mac x64、Linux x64 构建原生安装包，然后启动打包后的应用执行界面脚本。Linux 使用 Xvfb 提供显示环境；仅在这个隔离的 CI 测试进程传入 `--no-sandbox`，用户正常启动不需要此参数。Release 装配步骤检查六个预期包：两个 DMG、两个 ZIP、一个 AppImage、一个 deb。

## 手动界面验收

| 场景 | 核对内容 |
| --- | --- |
| 小窗口 / 大窗口 | 侧栏、照片网格、筛选栏和编辑面板自适应，主要按钮可用 |
| 首次扫描 | 显示进度，文件损坏或外置盘断开不会令整个窗口崩溃 |
| JPEG / CR3 | 两种格式都可单独打开、交接；配对记录保持可选 |
| 搜索 / 精品 | 日期、色系、主题、标签在当前视图共同生效 |
| 多选 | 批量标签、收藏、平铺复制与删除针对正确文件；单张仍可在文件管理器中显示 |
| 相似搜索 | 粒度可调整，预计时间与进度可见，取消后停止任务 |
| 拼图 | 拖拽换序与输出一致，常见模板及横向 / 纵向拼接可导出 |
| 编辑 | 裁剪、旋转、镜像、马赛克可保存；另存不改原片 |
| SD 卡导入 | 拍摄日期归档、主题目录选择、重复内容跳过、同名不同内容保护 |
| 缓存 | 预热后浏览更快；超过上限会清理；清空后原片与标签仍存在 |
| Adobe 交接 | 在已经安装 Photoshop / Lightroom 的 Mac 上检查实际打开流程 |

## 首版记录

版本：`1.0.0`。2026-10-11，在 macOS 26 arm64、Node.js 26 环境实际执行：

| 检查 | 结果与范围 |
| --- | --- |
| `npm test` | 13 个后端测试全部通过；覆盖配对、主题隔离、JPEG / RAW 日期、资料持久化、缓存、色系、相似排序、导入、符号链接限制与 SD 卡同步 |
| 900 × 680 小窗口 | 2 项布局断言通过；页面和主内容没有横向溢出，已查看实际截图 |
| 原生 Electron 合成图库界面测试 | 24 项断言通过：组合筛选、多选标签收藏、六种拼图模板与拖拽、JPEG 导出、JPEG / CR3 双预览、旋转、镜像、撤销、马赛克、裁剪、另存与相似排序 |
| 本地 macOS arm64 最终安装包 | DMG / ZIP 构建成功；启动打包后的 .app，通过拼图上限、18 项 SD 界面断言、6 项生产 IPC、3 项真实临时 SD 同步；导出尺寸和全部合成原片 SHA-256 校验通过 |
| 源码生产 IPC 验收 | 6 项断言通过：原生桥、受限照片协议、画布 CORS、实际 JPEG 保存、色系与相似搜索 |
| 超长拼图验收 | 2 项断言通过：30 张纵向拼接遵守画布上限，缩小后原片绘制位置正确 |
| 原生 Electron 合成 SD 同步界面 | 18 项断言通过：全部精品 / 当前选择范围、JPEG / CR3 保留与移动清单、额外保护及未匹配提示、预览取消、单次确认、部分失败与取消结果、打开本次待删目录；没有操作真实 SD 卡 |
| 源码 SD 卡同步 IPC | 3 项断言通过；仅操作临时合成文件夹，没有操作真实 SD 卡 |
| `npm run privacy` | 当前源文件扫描通过；并在隔离的临时 Git 仓库验证干净源码通过，模拟密钥、个人路径、已跟踪 RAW、PNG 元数据均被阻止 |
| `npm run icon` | 成功生成 1024 px PNG 与 macOS ICNS，已查看图标 |
| GitHub Actions 三平台安装包 | [运行 38119864948](https://github.com/Undefeated-man/ShutterCove/actions/runs/38119864948) 的 macOS arm64、macOS x64 与 Linux x64 构建、后端测试、隐私检查、安装包界面测试及完整生产烟雾测试均成功 |
| Release 自动装配与公开发布 | [修正后的运行 38120190987](https://github.com/Undefeated-man/ShutterCove/actions/runs/38120190987) 的三个原生构建及 Release 装配全部成功；六个安装包已上传，SHA256SUMS 与 GitHub asset SHA-256 全部一致。[v1.0.0](https://github.com/Undefeated-man/ShutterCove/releases/tag/v1.0.0) 已公开发布。此前 Linux 包格式使用 x86_64 / amd64 架构名导致装配检查失败，已修正 |

以上测试不会启动已安装的 Adobe 应用，也不会操作用户原片。合成图库界面脚本将保存接口替换为数据验收；生产 IPC 脚本另行验证临时目录内的真实 JPEG 保存。`scripts/package-smoke.cjs` 在三平台打包后的应用重复超长拼图、SD 界面、生产 IPC 和 SD 同步验收，检查实际输出尺寸、三个合成原片的 SHA-256 未变，以及一张保留、两张可恢复地移入待删的操作记录。真实机器上的首次安装与 Adobe 交接仍需独立验收；尚未记录的项目不视为通过。

## v1.0.1 字号、日历与时间轴

本次功能变化：默认字号放大至 120%；设置提供 100%–150% 的字号滑块，即时预览，保存后在下次启动沿用。窗口、照片像素与导出分辨率独立于字号设置。

日期区间支持点击日历或直接输入；纤细时间轴在悬停或按住时展开半透明日期提示，拖动可跳到当前全部筛选结果的日期，默认按日期倒序浏览。日历已在原生 Electron 的 900 × 680 合成图库中通过 18 项断言，包含日期选择、直接输入、无效日期处理、重置与年份整数校验。

时间轴源码界面在原生 Electron 的 900 × 680 合成图库中通过 19 项断言：覆盖 300 张照片的全局位置与跨分页定位、同页跳转不重绘、实际指针按下 / 移动 / 释放的日期预览与定位、点击定位、快速连续跳转保留最新目标、筛选变化取消过期跳转、150% 字号无横向溢出，以及空图库和单张照片。打包验收必须运行 `scripts/date-ui-smoke.js` 与 `scripts/timeline-ui-smoke.js`。

字体界面已在原生 Electron 的 900 × 680 合成图库中通过 13 项断言，覆盖默认字号、即时预览、取消还原、保存与小窗口布局；打包验收使用 `scripts/font-ui-smoke.js`。

2026-10-11，本地 macOS arm64 最终 v1.0.1 安装包构建完成，启动打包后的 `.app` 实际验证：

| 检查 | 结果与范围 |
| --- | --- |
| 完整安装包烟雾测试 | `node scripts/package-smoke.cjs` 全部成功：2 项拼图上限、18 项 SD 界面、13 项字号、18 项日历、19 项时间轴、10 项生产 IPC、3 项临时 SD 同步，共 83 项断言 |
| 独立完整图库界面 | 打包后的 `.app` 运行 `scripts/ui-smoke.js`，24 项断言通过，覆盖筛选、多选、标签、收藏、拼图、预览、编辑与相似搜索 |
| 实际文件与设置 | 设置 JSON 中 `fontScale` 为 1.4；导出 JPEG 为 100 × 80；三个合成输入 SHA-256 未变；SD 同步保留一张、可恢复地移入两张，操作记录和全部原片哈希均核对一致 |
| 应用签名与 DMG | `codesign --verify --deep --strict` 通过；`hdiutil verify` 确认 DMG 有效；采用 ad-hoc 签名，未进行 Apple 公证 |
| 安装包脱敏 | 351 个资源与二进制检查通过，未检出被禁止的个人路径 |

三平台 CI 与公开发布已完成：[运行 38121682190](https://github.com/Undefeated-man/ShutterCove/actions/runs/38121682190) 的 macOS arm64、macOS x64、Linux x64 构建及安装包验收、Release 装配四个任务全部成功。[v1.0.1](https://github.com/Undefeated-man/ShutterCove/releases/tag/v1.0.1) 已公开发布，包含两个 DMG、两个 ZIP、AppImage、deb 和 SHA256SUMS.txt；六个包的 GitHub asset SHA-256 与校验表全部一致。

本机最终应用已使用实际图库核对日历选择、手动日期输入及时间条跨分页跳转，恢复默认日期倒序浏览。首次通过系统启动服务启动时曾遇到目录读取等待；终止该测试进程并重新启动后正常加载，未更改系统权限设置，也未改动用户原片。本记录不将该等待归因于尚未证实的系统原因。

## v1.0.2 筛选菜单、批量复制与扫描完成

本次更新统一筛选下拉菜单与日历的鼠尾草绿毛玻璃样式，长列表最多显示六项并滚动，边缘轻微渐隐，保留键盘操作；增加跨目录批量复制，并修复扫描完成后迟到进度截断完整列表的问题。发布说明见 [v1.0.2](releases/v1.0.2.md)。

菜单源码界面已在原生 Electron 的 900 × 680 合成演示中通过 25 项断言，覆盖六行上限、搜索、键盘与禁用项、Tab / Shift+Tab 焦点、动态内容、重置和 150% 字号布局。批量复制新增 `copySelected` 生产 IPC：跨子目录平铺复制 JPEG，可选 CR3（默认关闭），碰撞时唯一改名且两种格式共用名称，保留原片，提供进度、取消及结果。

复制源码界面在原生 Electron 的 900 × 680 合成演示中通过 22 项断言，覆盖 JPEG 默认、CR3 参数、选择器新建目录授权、取消目标选择、RAW-only、部分失败与跳过、取消后保留已完成文件、打开目标目录，以及 150% 字号无溢出。

后端已实际通过 19 项测试，其中新增 6 项复制专项测试。扫描进度源码回归通过 13 项断言：扫描期间显示早期批次，完整结果返回后迟到的预览事件不覆盖列表，尾部照片、精品、RAW 和主题筛选继续有效。

2026-10-11，修复扫描时序后重新构建本地 macOS arm64 最终 v1.0.2 安装包并实际验收：

| 检查 | 结果与范围 |
| --- | --- |
| 完整安装包烟雾测试 | `node scripts/package-smoke.cjs` 的十个脚本全部成功，共 149 项断言：2 项拼图上限、18 项 SD 界面、13 项字号、18 项日历、19 项时间轴、25 项下拉菜单、22 项复制界面、13 项扫描回归、16 项生产 IPC、3 项临时 SD 同步 |
| 独立完整图库 | 打包后的 `.app` 运行 `scripts/ui-smoke.js`，24 项断言通过；最终本地两组验收合计 173 项 |
| 实际复制与原片保护 | 三张合成 JPEG 分别位于不同子目录，并配一个仅用于传输测试的 CR3 字节文件。默认 JPEG、重复复制和可选 CR3 三批输出平铺且不覆盖，配对共享冲突名称；JPEG 副本各三份、CR3 副本一份均与输入 SHA-256 相同，全部原片位置及哈希未变 |
| 其他真实文件操作 | 设置 JSON 中 `fontScale` 为 1.4；JPEG 导出为 100 × 80；SD 同步按配对实际文件数核对保留 / 移入待删清单及全部哈希，操作可恢复 |
| 签名与 DMG | 最终包 `codesign --verify --deep --strict` 通过，`hdiutil verify` 确认 DMG 校验有效；采用 ad-hoc 签名，未进行 Apple 公证 |
| 最终打包脱敏 | 1050 个文本 / 二进制文件通过检查：804 个文本、246 个二进制，包含 784 个 ASAR 条目；覆盖 ASAR 及解包条目和 `.app` 物理文件，跳过重复符号链接别名 |

文本保持完整凭据检查；二进制核对本机身份、实际挂载卷路径，并按文件名检查私人媒体和运行时图库索引。两个第三方文本文件中的示例路径与已安装依赖逐字节相同，不属于用户信息。第三方 libvips 二进制的 `sk-` 匹配位于较长标识符内部，属于凭据正则误报，未降低源码或配置凭据检查。

本机正常应用已实际核对：扫描完成后的全部照片、RAW 和精品与整理后的基线一致；精品搜索与 RAW 配对显示正常；跨目录选片的复制窗口默认只选 JPEG。原生选择器在临时目录中新建空文件夹并返回真实路径，随后复制按钮可用；取消复制没有改动私人原片。验收后恢复全部照片及日期倒序浏览。该记录不包含私人照片数量、名称或路径。

三平台 CI 与草稿装配已完成：[运行 38144050635](https://github.com/Undefeated-man/ShutterCove/actions/runs/38144050635) 的 macOS arm64、macOS x64、Linux x64 构建与安装包验收，以及 Release 装配四个任务全部成功。

2026-10-11，只读核对草稿中的六个安装包和 `SHA256SUMS.txt`。全部资产已上传、大小非零，安装包名称集合与预期完全一致；下载的 606 字节校验表包含六个不重复条目，每项均与 GitHub asset SHA-256 一致。此步骤没有下载安装包，核对的是 GitHub 上传资产的摘要与校验表。

| 安装包 | 大小（字节） | 校验表与 GitHub SHA-256 |
| --- | ---: | --- |
| `Shiguang-Isle-1.0.2-mac-arm64.dmg` | 145178752 | 一致 |
| `Shiguang-Isle-1.0.2-mac-arm64.zip` | 145101735 | 一致 |
| `Shiguang-Isle-1.0.2-mac-x64.dmg` | 151660705 | 一致 |
| `Shiguang-Isle-1.0.2-mac-x64.zip` | 151617688 | 一致 |
| `Shiguang-Isle-1.0.2-linux-x86_64.AppImage` | 141993624 | 一致 |
| `Shiguang-Isle-1.0.2-linux-amd64.deb` | 112588620 | 一致 |

[v1.0.2](https://github.com/Undefeated-man/ShutterCove/releases/tag/v1.0.2) 已公开发布，包含上述六个安装包及 `SHA256SUMS.txt`。发布前核对草稿资产，发布后再次确认 Release 非草稿、中英文说明与合成界面截图均已保存。

## v1.0.3 固定图库工具栏

图库滚动时，筛选、多选与排序栏保持在顶部，窗口或字号变化时按实际工具栏高度为照片定位预留空间。日历和菜单开闭、确认选项后返回焦点应保持当前滚动位置；Tab 进入固定操作栏以外的控件时仍可正常滚动到该控件。发布说明见 [v1.0.3](releases/v1.0.3.md)。

后端 19 项测试已通过。新增 `scripts/sticky-ui-smoke.js` 在原生 Electron 的 1440 × 960 和 900 × 680 合成演示中分别通过 40 项断言，包含 150% 字号下深滚动固定、筛选 / 多选 / 排序操作、更新图库不回顶、时间轴跨分页定位与首卡避让、前后分页、键盘焦点避让、切换视图回顶、日期不溢出、日历 / 下拉菜单层级与 Esc 焦点，以及尾部搜索。新增滚动保持断言覆盖日历鼠标 / 键盘开闭、切换月份、排序选择与可搜索标签菜单交互；内存负向对照移除焦点滚动保护时，脚本确实检出位置改变。仅使用合成照片。

该脚本已列为打包验收必需项，完整打包脚本包含十一个应用启动，每次最多 180 秒；CI 单步预留 34 分钟，构建任务仍为 45 分钟。新的 `sticky-toolbar.png` 和小窗口 150% 字号截图已人工核对，只有合成风景与演示资料，没有私人路径、人物或真实拍摄信息。

2026-10-11，本地 macOS arm64 的最终 v1.0.3 安装包在焦点返回修复后重新构建，实际验收如下：

| 检查 | 结果与范围 |
| --- | --- |
| 完整安装包烟雾测试 | `node scripts/package-smoke.cjs` 的十一个脚本全部成功，共 189 项断言：2 项拼图上限、18 项 SD 界面、13 项字号、18 项日历、19 项时间轴、25 项下拉菜单、22 项复制界面、13 项扫描回归、40 项固定工具栏、16 项生产 IPC、3 项临时 SD 同步 |
| 独立完整图库 | 最终 `.app` 运行 `scripts/ui-smoke.js`，24 项断言通过，12 张缩略图实际解码；两组打包验收合计 213 项 |
| 真实合成文件操作 | 生产 IPC、JPEG 导出、跨目录复制、配对碰撞名称、原片及副本 SHA-256、设置 JSON 持久化与可恢复 SD 同步操作记录均按脚本完整核对通过 |
| 签名与 DMG | `codesign --verify --deep --strict` 独立通过；`hdiutil verify` 确认 DMG 有效；使用 ad-hoc 签名，未进行 Apple 公证 |
| 最终打包脱敏 | 1399 个文件检查通过：866 个文本、533 个二进制，其中 786 个 ASAR 条目；未检出被禁止的私人路径、身份、媒体、运行时图库索引或凭据 |

本次打包脱敏同时覆盖整个 `.app` 的物理 framework 文件，比 v1.0.2 记录包含更广的物理文件范围，文件总数不能直接比较。本机正常图库已通过鼠标操作核对：深滚动时工具栏固定，多选开关可用，日历和排序菜单打开及 Esc 关闭后保持同一照片位置。验收后恢复全部照片、日期倒序与无选择状态。

三平台 CI 与草稿装配已完成：[运行 38148076016](https://github.com/Undefeated-man/ShutterCove/actions/runs/38148076016) 的 macOS arm64、macOS x64、Linux x64 构建与两组安装包验收，以及 Release 装配四个任务全部成功。

2026-10-11，只读核对草稿的七个已上传资产：六个安装包名称符合预期、大小非零，以及 606 字节的 `SHA256SUMS.txt`。校验表的六个不重复条目与全部安装包的 GitHub asset SHA-256 逐项一致，校验表本身也与其 asset 摘要一致。只下载校验表，没有重新下载安装包。

| 安装包 | 大小（字节） | 校验表与 GitHub SHA-256 |
| --- | ---: | --- |
| `Shiguang-Isle-1.0.3-mac-arm64.dmg` | 145175378 | 一致 |
| `Shiguang-Isle-1.0.3-mac-arm64.zip` | 145102611 | 一致 |
| `Shiguang-Isle-1.0.3-mac-x64.dmg` | 151661924 | 一致 |
| `Shiguang-Isle-1.0.3-mac-x64.zip` | 151618570 | 一致 |
| `Shiguang-Isle-1.0.3-linux-x86_64.AppImage` | 141993482 | 一致 |
| `Shiguang-Isle-1.0.3-linux-amd64.deb` | 112589532 | 一致 |

[v1.0.3](https://github.com/Undefeated-man/ShutterCove/releases/tag/v1.0.3) 已公开发布。发布后再次确认 Release 不是草稿或预发布，包含上述六个安装包及校验表，中英文说明与合成界面截图均已保存。

## v1.0.4 首次使用引导

此版本完成本地验收，但未公开发布；首次引导将与详情显示修复合并，由后续 v1.0.5 取代。以下保留 v1.0.4 的本地实测记录，不视为三平台 CI 或公开 Release 验收。

本次新增五步首次使用引导：欢迎与 JPEG / CR3、打开已有相册或从 SD 卡导入、筛选收藏标签、修图分享、SD 卡预览整理。首次正常启动自动显示，成功跳过或完成后保存状态；已有相册配置的旧用户升级不被打断。“相册设置 → 重新查看使用引导”可重新打开，最后可关闭引导或打开照片目录选择器。引导不会自动整理照片。发布说明见 [v1.0.4](releases/v1.0.4.md)。

2026-10-11，源码在 900 × 680 与 1440 × 960 窗口各通过 109 项引导断言（38 项跳过、65 项完成与重看、6 项再次启动），合计 218 项源码断言。覆盖首次自动显示、跳过保存失败与重试、非法布尔值拒绝、五步键盘与焦点边界、150% 字号、设置重看、末步目录选择取消 / 完成，以及真实重启后不再弹出。隔离设置 JSON 中完成状态真实保存，其他字段不变。

另有 6 个隔离设置迁移场景及实际写盘失败保留待完成状态的检查通过；后端 19 项测试通过。`onboarding.png` 与 900 × 680 / 150% 字号的 `onboarding-compact.png` 已人工查看，只有合成 SVG 与演示资料，无人物、私人路径或真实拍摄信息。

v1.0.4 打包验收接入 `scripts/onboarding-ui-smoke.js`，使用同一个临时 profile 连续启动三次验证跳过 / 完成 / 重启，并逐次核对实际设置文件。当时完整 `scripts/package-smoke.cjs` 含十四次应用启动；CI 单步 43 分钟、构建任务 55 分钟。上述 218 项是源码结果，所有自动化场景使用合成图库与隔离设置，不操作用户原片。

2026-10-11，本地 macOS arm64 最终 v1.0.4 安装包实际验收：

| 检查 | 结果与范围 |
| --- | --- |
| 完整安装包烟雾测试 | 十四次应用启动全部成功，共 298 项断言：既有 189 项，以及 38 项引导跳过、65 项完成与重看、6 项再次启动 |
| 独立完整图库 | 最终 `.app` 运行 `scripts/ui-smoke.js`，24 项断言通过；两组打包验收合计 322 项 |
| 引导持久化 | 实际设置 JSON 中 `onboardingCompleted` 保存为 true，其他字段保持不变；两次真实进程重启不再自动弹出 |
| 真实合成文件操作 | 复制及 JPEG / CR3 配对冲突名称、原片及副本 SHA-256、100 × 80 JPEG 输出、设置与可恢复 SD 同步操作记录全部核对通过 |
| 签名与 DMG | `codesign --verify --deep --strict` 通过，`hdiutil verify` 确认 DMG 有效；ad-hoc 签名，不等于 Developer ID 或 Apple 公证 |
| 最终打包脱敏 | 1400 个文件通过检查：本次按扩展分类为 548 个文本、852 个二进制，其中 788 个 ASAR 条目；未检出被禁止的身份、私人路径、媒体、运行时图库索引或文本凭据 |
| 打包源码一致性 | 23 个第一方文件与当前源码核对；`package.json` 精确符合构建器剥离 scripts / devDependencies / build 后的 JSON，其余文件逐字节一致 |

本次文本 / 二进制按扩展分类，分类计数不能与旧版采用其他规则的记录横向比较。v1.0.4 未公开发布，后续验收与发布以 v1.0.5 为准。

## v1.0.5 首次引导与详情显示

本次合并五步首次引导与大照片详情显示修复，保留 macOS 首次打开安装指南及 RAW 当前仅支持 Canon CR3 的边界。发布说明见 [v1.0.5](releases/v1.0.5.md)。

详情修复已确认原因：原图固有尺寸撑高旧 grid 布局，导致固定高度预览框裁断图片。新版约束 grid 的最小尺寸及图片宽高，按比例完整适配预览框，预览区随窗口高度调整；详情内容可滚动，底部前后翻页按钮固定可用。

源码 `scripts/detail-ui-smoke.js` 在 900 × 680 与 1440 × 960 各通过 233 项断言，共 466 项；覆盖 12000 × 8000 横图、8000 × 12000 竖图、12000 × 1200 宽幅图、JPEG / CR3 配对与 RAW-only、120% / 150% 字号、实际滚入可视区后的完整预览框，以及编辑器和前后翻页操作。旧布局负向控制可复现裁断，恢复新布局后通过。截图 `docs/screenshots/paired-preview.png` 已更新并人工审阅，仅含合成风景与演示元数据，无人物或私人路径。

2026-10-12（Asia/Shanghai）最终本地 macOS arm64 包验收：

| 检查 | 实测结果 |
| --- | --- |
| 完整安装包烟雾测试 | 十五次应用启动全部成功，共 531 项断言：既有 298 项与详情专项 233 项 |
| 生产桥接与真实文件结果 | JPEG 导出、跨子目录复制、冲突时 JPEG / CR3 共用文件名后缀、原片与副本 SHA-256、设置持久化、可恢复 SD 整理日志均通过 |
| 签名与 DMG | `codesign --verify --deep --strict` 通过；`hdiutil verify` 返回 DMG VALID |
| 实际安装包脱敏 | 扫描 1,401 个文件：549 个文本、852 个二进制，包含 789 个 ASAR 条目；24 个第一方文件与当前构建一致，无发现 |
| 独立图库回归 | 最终包 24 项全部通过；与完整安装包测试合计 555 项断言 |

脱敏分类计数不与采用其他规则的旧版横向比较。CI 单步 46 分钟、构建任务 60 分钟。已有 v1.0.4 本地结果不作为 v1.0.5 的最终包证明。

[三平台 CI 运行 38153762129](https://github.com/Undefeated-man/ShutterCove/actions/runs/38153762129) 第 2 次尝试整体成功，构建提交为 `ae087024b4a35b7677480dd9cc1661f8ff1c1c16`：macOS arm64、macOS x64、Linux x64 与草稿 Release 装配均成功。两个 Mac 任务首轮通过；Linux 首轮在时间轴 UI 测试的 “Glass timeline expands during scrubbing” 断言失败，当时使用固定 220 ms 等待。在同一个不可变标签上重跑 Linux 后完整通过。现有证据支持怀疑动画等待时序不稳定，尚未证明应用存在竞态。随后 main 分支独立维护了测试等待方式，19 项正向与 1 项负向检查通过；此维护不修改该标签的应用，也不计入本地 555 项或标签 CI 结果。

三个成功平台任务的完整日志已核对：各十六次应用启动、555 项断言（独立图库 24 项 + 安装包十五次启动 531 项），均输出 `Packaged native smoke passed` 并确认实际文件结果，无 QA 错误。macOS arm64 首轮任务 `114512376064`、macOS x64 首轮任务 `114512375989`、Linux 重跑任务 `114513680335`。

草稿资产验收：六个安装包与 `SHA256SUMS.txt` 共七个资产全部处于 uploaded 状态且大小非零。只下载 606 字节的 SHA-256 校验表，没有下载安装包；表中六个文件名及摘要与 GitHub 对应资产 digest 全部一致，校验表自身的 SHA-256 也与其资产 digest 一致。

| 安装包 | 字节数 | SHA-256 |
| --- | ---: | --- |
| Shiguang-Isle-1.0.5-linux-amd64.deb | 112595512 | `c73814f85d5e51abad4bb4113879666b08c278bf6cba5ccee4a8b2f02fe86661` |
| Shiguang-Isle-1.0.5-linux-x86_64.AppImage | 142001690 | `b0ce3ad8c3fa62ee3c5421991ca3e20a7fa14e2b6335ad5419553ecf7bcb12e0` |
| Shiguang-Isle-1.0.5-mac-arm64.dmg | 145188548 | `8046b10dd1f7b489824d27d070144974b77c94e3c573961454626ca2f0382f6a` |
| Shiguang-Isle-1.0.5-mac-arm64.zip | 145107951 | `b07f60641bc4791dcadb19f9b712d1649fc87263b33b1ba55bac541899f02bb7` |
| Shiguang-Isle-1.0.5-mac-x64.dmg | 151665306 | `b4891a2552d0f35d93d4bd3dfbf62f43aa7903772fe8bbdf958021d1f1818f60` |
| Shiguang-Isle-1.0.5-mac-x64.zip | 151623907 | `606e9a385a27c912f4e97eeabae809c042ce53733d10c29234926bd2759eff10` |

2026-10-12，[v1.0.5](https://github.com/Undefeated-man/ShutterCove/releases/tag/v1.0.5) 已公开发布。发布后再次确认非草稿、非预发布，六个安装包与校验表完整，中英文说明与合成界面截图已保存；资产摘要及发布正文与本地记录一致。

## v1.0.6 详情缩放与平移

本次增加详情 Option / Alt 滚轮缩放、放大后拖拽平移、“适合窗口”及双击复位。100% 表示相对于适合窗口大小，并非原图像素 1:1；当前上限为相对适配大小 16 倍。CR3 仅缩放相机内嵌预览，不提供 RAW 显影。发布说明见 [v1.0.6](releases/v1.0.6.md)。

截图 `docs/screenshots/detail-zoom.png` 已人工审阅：合成 JPEG 放大至 223%，CR3 保持适配，仅有合成山湖及演示资料，无人物、私人路径或真实拍摄信息。

2026-10-12（Asia/Shanghai）源码与构建已确认：

| 检查 | 实测结果 |
| --- | --- |
| 缩放专项源码回归 | `scripts/zoom-ui-smoke.js` 在 900 × 680 通过 667 项、1440 × 960 通过 661 项，共 1,328 项断言 |
| 详情适配源码回归 | 原有 `scripts/detail-ui-smoke.js` 在两种窗口各通过 233 项 |
| 独立几何与后端检查 | 缩放几何源码检查 42 项、后端测试 19 项通过 |
| 本地安装包构建 | 最终 macOS arm64 DMG 与 ZIP 构建成功 |
| 签名与 DMG | `codesign --verify --deep --strict` 通过；`hdiutil verify` 返回 DMG VALID |
| 实际安装包脱敏 | 扫描 1,403 个文件：551 个文本、852 个二进制，包含 791 个 ASAR 条目；26 个第一方文件与当前构建精确一致，无发现 |
| 最终安装包功能回归 | 十六次应用启动全部成功，1,198 项断言通过：既有 531 项与缩放专项 667 项 |
| 独立图库回归 | 最终包 24 项通过；与完整安装包测试合计 1,222 项断言 |
| 生产桥接与实际文件结果 | 100 × 80 JPEG 导出、跨目录平铺复制、JPEG / CR3 配对冲突文件名、原片与副本 SHA-256、设置持久化与引导三次隔离启动、可恢复 SD 日志均通过脚本核对 |

缩放专项覆盖 Alt / Option 滚轮、拖拽边界、适配复位、两个预览的独立状态及普通滚轮滚动。大窗的部分单格式场景没有内容溢出，因此比小窗少六个条件性滚动断言；有溢出的场景实际核对内容可滚动，不将无溢出画面声称为已滚动。负向控制关闭缩放 transform 或拦截普通滚轮时，测试能检出错误；平移在小数尺寸下的误差已修复后重建。脱敏分类计数不与采用其他规则的旧版横向比较。

本地最终包验收已完成。CI 单步 49 分钟、构建任务 65 分钟。此前 v1.0.5 结果不作为此版本的最终包验收证明。

[三平台 CI 运行 38157899742](https://github.com/Undefeated-man/ShutterCove/actions/runs/38157899742) 的构建提交为 `c88ae7754347414ae55aeff28e0bfe68785fdcb0`。三个平台任务均首次成功，完整日志中的十七个 QA 结果已解析：独立图库 24 项与十六次启动 1,198 项，合计各 1,222 项；每条 passed 数均与 checks 长度一致，没有 QA 错误。各平台后端 19 项与 71 个公开文件脱敏检查也通过。

| 平台 | Job ID | 包回归断言 | 实际磁盘结果 |
| --- | --- | ---: | --- |
| macOS arm64 | `114524555074` | 1,222 | 已验证 |
| macOS x64 | `114524555239` | 1,222 | 已验证 |
| Linux x64 | `114524555201` | 1,222 | 已验证 |

三个任务均输出最终 `Packaged native smoke passed`。该结果在脚本实际核对 100 × 80 JPEG 输出、复制副本及未修改原片的哈希、设置及引导持久化、可恢复 SD 日志之后才输出。草稿装配任务 `114525338734` 同样成功，四个 CI 任务全部通过。

草稿资产验收：六个安装包与 `SHA256SUMS.txt` 共七个资产全部 uploaded 且大小非零，无缺失或额外资产。只下载 606 字节的校验表，没有下载安装包；表中六项文件名及 SHA-256 与 GitHub 安装包资产 digest 全部一致，表自身 digest 也一致。

| 安装包 | 字节数 | SHA-256 |
| --- | ---: | --- |
| Shiguang-Isle-1.0.6-linux-amd64.deb | 112597448 | `c4450e92e6b3a1f22d444468bdbe38e6fac9acbaae5c790ab9be7acd90c7b69a` |
| Shiguang-Isle-1.0.6-linux-x86_64.AppImage | 142001823 | `ada5a83a31f0149a0a6a1f0fd4384728dc123c4fb41141220ec98c3c9c28521e` |
| Shiguang-Isle-1.0.6-mac-arm64.dmg | 145196727 | `e22eaf8beae8a4485090bcfed3980a15620eee7eb1ad204764954959ffa39003` |
| Shiguang-Isle-1.0.6-mac-arm64.zip | 145111086 | `8cf155d97aef9a88a1f8f49dbfca8a795799f26ab70bb58ac5abdb5d5e27575f` |
| Shiguang-Isle-1.0.6-mac-x64.dmg | 151677859 | `40acfa618841564f44a37b268cfc1e143349f619c83a190e9f3cc240364cb0b3` |
| Shiguang-Isle-1.0.6-mac-x64.zip | 151627029 | `f4bec9c8b999edd0aaf083ab28c243a4d5b28ab3faa6eadb7eafc40c5d781d28` |

2026-10-12，[v1.0.6](https://github.com/Undefeated-man/ShutterCove/releases/tag/v1.0.6) 已公开发布。发布后再次确认非草稿、非预发布，六个安装包及校验表完整，中英文发行正文与本地文件一致，资产 SHA-256 与校验表仍一致；合成详情缩放截图已包含在说明中。

2026-10-12，一台 Apple Silicon Mac 的正式安装与更新已实际验收：旧版优雅退出，仅设置及相册元数据做私有备份；Applications 内安装 1.0.6 后正常重启，旧设置深度相等、已有相册元数据逐项一致。展开构建副本在核对保留 ZIP 的核心文件 SHA-256 后移除，旧安装卷卸载，原有安装归档保留，废纸篓未改动。Spotlight 按应用标识只返回正式版本一项，按 bundle ID 启动无歧义；Finder“这台 Mac”搜索应用名称并限制种类为应用程序时仅显示一项，双击正常启动。生产详情实际显示 JPEG 键盘放大至 125%，按 0 恢复 100%。此项为一次本机维护验收，不表示软件自动清理其他应用副本。

Mac 通用更新说明要求先退出旧版，在 Applications 替换 App 后启动；相同系统用户及应用标识继续使用原有本地资料。本机应用副本整理属于单次维护，不作为相册的自动功能宣传，不在公开文档保存私人库存或路径。

## v1.0.7 应用内更新与拼图控制

本版加入设置中的版本检查、新版提醒、下载校验及原位更新；Mac / 可写 AppImage 保持安装路径与资料，Linux deb 打开系统安装器。更新确认要求后端相册初始化、前端事件绑定及设置读取成功，不等待完整照片扫描。下载准备状态可在重启后恢复并重新校验，孤立临时目录按所属标记清理；回滚备份与仍运行的更新助手受保护。

拼图预览加入 Alt / Option 滚轮缩放、平移和适配复位；时光手记与胶片海报每行张数默认 2，可设 1–12，所有照片参与实际 JPEG 导出。截图均使用合成风景及演示资料。

2026-10-12，源码专项验收：拼图在 900 × 680 与 1440 × 960 各通过 133 项，更新界面两种窗口各通过 62 项（含 120% / 150% 字号）。后端及前端启动隔离测试共 51 项通过，包含 27 项更新、5 项启动及原有 19 项照片管理测试。覆盖版本与架构、固定 HTTPS 源、文件摘要、ZIP 与链接边界、失败回滚、设置备份、启动确认、准备状态恢复、孤立清理和禁用模式不联网。

真实旧版 Mac ZIP 的检查、解压、应用标识 / 架构及严格签名验证通过；独立临时目录中的 Electron Node 更新助手在自身 bundle 移动后仍能启动新路径，成功清理临时应用并保留元数据。这些检查没有替换用户的正式安装。

本地最终 macOS arm64 包已验证：18 次启动、1,393 项断言全部通过，另有完整图库 24 项，共 1,417 项；实际 JPEG 输出、跨子目录复制及原片哈希、设置与引导持久化、可恢复 SD 日志已核对。严格代码签名与 DMG 完整性通过。包内隐私检查扫描 1,409 文件（含 797 ASAR 条目），32 个第一方文件与构建源码一致，无发现。三平台构建及正式安装结果另行记录，不以本地测试替代。

## v1.0.8 正式更新版

v1.0.7 开发标签保留但未公开发布。它的本机原位更新已实际启动成功，既有设置和相册元数据逐项保留，时光手记与胶片海报的每行照片数在安装后的 App 中均可见，默认 2；改为 1 后实际重新排版。随后发现 Electron ASAR 文件系统会使旧应用的归档文件在递归删除时残留，v1.0.8 使用物理文件系统清理更新暂存与已成功替换的旧包。

v1.0.7 的 Mac arm64 CI 在更新提醒的滚动保持断言失败。隔离复现确认测试在平滑滚动未停止时读取基线；v1.0.8 改用立即定位和稳定基线，仍要求提醒前后焦点与滚动位置精确保持，并添加失败诊断。没有将失败的 v1.0.7 CI 记录为最终验收通过。

2026-10-12，本地 v1.0.8 最终 macOS arm64 包验收完成：后端及启动测试共 61 项（含子案例）；包内 18 次启动通过 1,410 项断言，另有完整图库 24 项，合计 1,434 项。包括真实菜单点击选择两种海报、默认每行 2 张与改变布局、Alt / Option 缩放、精确保持焦点及滚动的更新提醒，以及实际磁盘导出、复制哈希、设置和 SD 日志。严格签名、DMG 完整性和 1,409 个包内文件脱敏通过，32 个第一方文件与源码一致。

更新清理的独立完整 App 事务复验在真实 Electron Node runtime 执行：原位替换后新 runtime 能启动并读取真实 ASAR，旧包、stage 和 work 均清除，设置及相册记录哈希一致。启动后成功清理兼容逻辑还实际恢复了前一次本机成功升级的残留；运行的正式 App、设置及相册资料保持不变。此阶段的替换验收使用本地构建包，不声称从 GitHub 下载安装。

[v1.0.8 三平台 CI 运行 38165584174](https://github.com/Undefeated-man/ShutterCove/actions/runs/38165584174) 的构建提交为 `6dab827b00b19e10722e6d6b7bbd1ed5b92d98b9`，四个任务全部成功。完整日志逐项核对如下：

| 平台 | Job ID | 单元测试 | 包与图库断言 | 实际磁盘结果 |
| --- | --- | ---: | ---: | --- |
| macOS arm64 | `114547349658` | 61 | 1,434 | 已验证 |
| macOS x64 | `114547349677` | 61 | 1,434 | 已验证 |
| Linux x64 | `114547349593` | 61 | 1,434 | 已验证 |

每个平台均包含 19 条 QA 结果（完整包 18 次启动 1,410 项，加独立图库 24 项），每条 `passed` 与 `checks.length` 一致；86 个公开文件脱敏通过，无 QA 错误。最终磁盘验收标记只在核对实际 JPEG、复制及原片 SHA-256、设置与引导持久化、SD 日志后输出。草稿装配任务 `114548389395` 成功。

2026-10-12，[v1.0.8](https://github.com/Undefeated-man/ShutterCove/releases/tag/v1.0.8) 已公开发布并设为 latest。发布前后均核对六个安装包与校验表共七个资产：全部上传完成、大小非零、文件名及 SHA-256 与 GitHub 资产 digest 一致，606 字节校验表自身 digest 也一致。中英文发布正文与本地文件一致，包含合成界面截图；未发布 v1.0.7 草稿。

本机最终验收通过正式 App 内的真实界面完成：在已安装的 v1.0.7 中点击“检查更新”，从官方 GitHub 检出 v1.0.8，再点击“一键更新并重启”。应用实际下载并校验 138.4 MiB 的 arm64 ZIP、替换原安装路径并自动重启。更新后设置界面显示 v1.0.8，再次检查显示“已经是最新版本”。这一步使用公开发行资产，未注入本地下载地址。

安装后的严格代码签名通过；更新助手结果为 completed，pending / ready 状态、临时工作目录和暂存应用副本均已自动清理。更新前后逐项核对既有设置及相册 metadata 全部一致（涵盖精品收藏、标签和主题）；Spotlight 按应用标识只返回正式 App 一项。原生界面再次实际选择时光手记及胶片海报，两种模板均显示“每行照片数”且默认 2；胶片海报设为 1 后预览布局及导出尺寸立即变化，再恢复为 2。本次界面核验未保存测试拼图或修改原片，私人相册画面未用于公开截图。

## v1.1.0 构图、分享成品与动图

本版新增单张构图放缩（25–400%）、完整放入 / 填满格子、原比例杂志、可拖动位置与独立旋转 / 缩放 / 调层级的木质展示板、标题字号、实际编码 JPEG 分享预览、多帧 GIF 与单张 PNG 表情包，以及详情系统全屏。

源码专项在正常 / 紧凑窗口分别通过：新拼图构图 43 项、既有拼图 150 项、GIF 工作台 28 项、全屏 UI 55 项（含 120% / 150% 字号）；Mac 原生全屏另有 11 项真实进入 / 退出断言。原详情 233 项及独立缩放 667 项回归通过。Node 测试共 80 项（含子案例），包含真实 GIF worker 的帧数 / 顺序 / 时长 / 循环 / 气泡像素、取消 / 超时 / 损坏输入、权限与内存边界，JPEG 原字节保存以及 48M 画布舍入极值。

展示板专项实际拖动原比例卡片，并放大画布后 Shift 拖动；对导出 JPEG 核对主体中心向目标方向移动超过 10 px、角度仍为 23°、完整主体面积差异小于 5%。分享处理逐张预缩采样，只在成品做一次 JPEG 有损编码，生成后解码回显；导出时保存同一份编码字节。

公开的木板、杂志及 GIF 工作台截图均人工审阅，仅有合成山湖，杂志包含横 / 竖 / 方等不同原比例。没有上传用户的示例照片或人像，测量结果仅记录匿名尺寸与字节数。

本地 Mac arm64 安装包严格签名与 DMG 完整性通过；包内扫描 1,415 文件（563 文本 / 852 二进制，含 803 ASAR 条目），38 个第一方文件与当前源码一致，无私人资料或密钥发现。完整本地安装包回归最终通过：23 次启动、1,553 项断言，独立图库再通过 24 项，合计 1,577 项。实际磁盘 JPEG / GIF 与各自预览的 SHA-256 完全一致；GIF 为两帧、160 × 100、每帧 320ms、无限循环。原片哈希、跨目录复制、设置及引导持久化、SD 可恢复日志均核对通过。全屏安装包测试使用合成演示画面，但直接调用生产 IPC，真实进入 / 退出 Mac 系统全屏 11 项；初次验收启动参数未带演示模式导致测试前置超时，修正参数后重跑全部包验收成功。三平台 CI 与正式更新结果完成后追加。

[v1.1.0 三平台 CI 38195577915](https://github.com/Undefeated-man/ShutterCove/actions/runs/38195577915) 对应提交 `904d50892039472c3b15e5c8acb60861ae020edd`，三平台构建与草稿装配均成功。Mac arm64（`114637342498`）与 Intel（`114637342690`）各 1,577 项包与图库断言；Linux（`114637342601`）共 1,566 项，只少对应 Mac 原生系统全屏的 11 项，模拟全屏 UI 55 项在所有平台都通过。各平台 Node 80 项、108 个公开文件脱敏通过，每条 QA 的 passed 与 checks 长度相等；JPEG / GIF 落盘字节、帧数 / 时长 / 循环、原片哈希及 SD 日志在最终磁盘标记前全部核对。草稿装配 `114638442080` 成功。

2026-10-12，v1.1.0 已公开发布为 latest，六个安装包及 606 字节 SHA256SUMS 共七个资产均完整、上传完成且大小非零。发布前后校验表自身与六项安装包 digest 均匹配 GitHub 记录，中英文正文与本地文件一致，含三张合成截图。

本机更新时，旧 App 的匿名 GitHub 检查接口遇到限流，不能将这次写作“GUI 一键下载成功”。随后通过已登录 GitHub 工具下载官方 arm64 ZIP 与校验表，核对公开 SHA-256，再由生产更新服务及助手原位替换并重启；正式 App 已显示 v1.1.0。安装后的三个核心文件与官方 ZIP 完全一致，严格签名通过；旧设置及既有 metadata 逐项保留，pending / ready / 临时工作及应用备份目录均自动清理。Spotlight 按应用标识仅返回正式安装一项，验证后的展开构建副本已清除，安装归档保留。 正式安装后的原生界面实际打开两张照片的木质展示板，将第一张从左上拖至右下，界面所见位置同步改变，角度和完整照片保持；未保存测试成品或修改原片。

## 当前边界

- CR3 使用内嵌预览，不执行完整 RAW 显影。没有预览的 CR3 可以管理及交给外部应用，但可能无法显示缩略图。
- 色系与像素池化相似度不等同于主题识别。主题需要手动设置，粒度越细也不保证结果越符合人的审美。
- Lightroom 的导入行为、Photoshop 的 Camera Raw 行为取决于 Adobe 版本及支持的相机型号。
- Linux 需自行指定本机编辑器。文件管理器是否支持精确选中多文件取决于桌面环境。
- 画布最大长边为 24,000 px、总面积为 4,800 万像素，超过时等比缩小；这是图像资源上限，横向 / 纵向拼图没有预设张数上限。
- 批量操作存在磁盘故障、权限与空间限制；失败时保留具体文件的结果，不将部分成功报告为全部完成。
- 自动化打包成功说明分发文件已生成；首次安装、系统安全提示以及专业编辑器交接仍需对应系统验收。

## v1.2.0 language and documentation validation

Source validation on 2026-10-12:

- All **86** backend and lifecycle tests passed, including fresh / existing language defaults, preference validation, and native dialog specificity while preserving paths and extensions.
- English gallery **58**, creative studios **26**, and calendar / dropdown / timeline / guide / updater **33** UI assertions passed in both normal and compact windows. Language switching preserved user filenames, themes, tags, drafts, focus, photo selection, composition, zoom, order, and exact already-encoded JPEG bytes.
- Production settings IPC passed **65** checks across three isolated profiles and five real app launches: fresh English and Chinese choices, failed-save retry, persisted restarts, legacy Chinese defaults, and one-click switching without saving unrelated draft fields.
- Existing Chinese gallery, copy, font, detail, sticky toolbar, collage, GIF, calendar, dropdown, timeline, updater, and onboarding regressions passed. Tests use generated photographs and isolated profiles; no original user photographs are edited.
- The language chooser and English gallery screenshots were inspected. They contain synthetic artwork and metadata only. README defaults to English after the bilingual introduction, with four working language links and explicit English / Chinese-only interface support in the Japanese and Korean guides.

Reproduce the English UI checks with `--demo --smoke --qa-script` and the scripts `gallery-language-ui-smoke.js`, `studios-i18n-ui-smoke.js`, and `widgets-english-ui-smoke.js`. `scripts/package-smoke.cjs` also runs the five-launch language-profile validation against each packaged executable; ordinary smoke profiles retain Chinese fixtures, while `--qa-first-language` exercises production first-install defaults.

Published v1.2.0 acceptance:

- [GitHub Actions run 38198882865](https://github.com/Undefeated-man/ShutterCove/actions/runs/38198882865) completed successfully on Mac arm64, Mac x64, and Linux x64, followed by successful release assembly. Mac builds each passed 31 production launches and 1,735 assertions, plus the separate 24-assertion gallery test; Linux passed 30 production launches and 1,724 assertions plus that gallery test. The five language-profile launches are included in these totals rather than counted twice.
- All six installation packages and the checksum manifest were verified. Every manifest digest matched GitHub's corresponding asset digest, and the published bilingual notes matched the release-notes source.
- The installed local Mac app was updated in place using the official arm64 ZIP and the production updater / helper. The machine's anonymous GitHub API was rate-limited, so the official ZIP and manifest were fetched through the authenticated GitHub CLI and supplied as a bounded stream to the production verification and installation path. This verifies installation and rollback safeguards, rather than claiming a successful GUI network check under the rate limit.
- The new app acknowledged real startup. Its plist, executable, and ASAR matched the official ZIP, and strict native signature verification passed. Library metadata was byte-identical; existing preferences were unchanged except for the two new language fields.
- The real desktop app retained Chinese, then switched to English and back through the settings buttons. The saved choice is Chinese. Favorites and photograph counts were unchanged. Spotlight returned exactly one application, and the updater removed its temporary application copies and pending files.

## v1.2.1 repository and collage validation

Source validation on 2026-10-12:

- All **86** backend and lifecycle tests passed. Release selection accepts the new official `Undefeated-man/ShutterCove` path and rejects foreign-owner and legacy-path asset URLs.
- Creative collage checks passed **58** assertions in both normal and compact windows, with existing collage regressions passing **150** in each. Checks cover width-based sizing, no upscaling, complete bottom content, the 24,000-pixel side and 48-megapixel limits, actual-size viewing, direct original-to-output rendering, one JPEG encoding, and identical preview / saved bytes.
- English creative studios passed **36** assertions in both window sizes, including all new width controls, scroll instructions, and language switching without changing encoded output. English gallery passed **60**; language-profile validation passed **67** checks across five real app launches.
- The new repository's anonymous stable-release API was exercised through the production transfer function and returned the current published release with canonical asset addresses.
- The **133** publishable files passed the privacy scan. Three changed / added screenshots were inspected and contain only generated scenery and synthetic metadata. The five README guides and current installation / update / creative documentation use the new repository; 157 local links and 95 repository links passed documentation checks.

Packaged release and installed-app acceptance will be appended after those operations complete.
