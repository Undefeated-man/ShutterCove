# Shutter Cove: RAW Photo Organizer & Creative Studio

**Language:** [English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

**时光杂货店：专为 RAW 摄影打造的整理与创作相册 — 精选照片，制作拼图海报与 GIF 动图。**

> **지원 언어:** 현재 앱 인터페이스는 **영어와 간체 중국어 두 언어**를 지원합니다. 새로 설치하면 영어로 시작하며, 첫 실행에서 언어를 선택할 수 있습니다. 설정의 “Interface language / 界面语言”에서 즉시 전환할 수 있고 선택이 저장됩니다. 일본어와 한국어 문서는 사용 설명의 번역입니다. 앞으로 수요에 따라 앱의 지원 언어를 추가할 예정입니다. 본문에는 중국어 버튼 이름도 한국어 뜻과 함께 표시합니다.

## English

**A local desktop photo library built specifically for DSLR and mirrorless photographers who shoot RAW.**

Shutter Cove (时光杂货店) follows your photography workflow: import from an SD card, browse RAW / JPEG pairs, select your best shots, hand files to an editor, and turn photographs into posters or animated stories. Available for macOS and Linux. **Currently supports JPEG and Canon CR3; RAW support is limited to CR3.**

- **Keep RAW and JPEG together.** Browse matching files as a pair, inspect details with zoom and fullscreen, and open either format in Photoshop / Lightroom on Mac or a configured local editor on Linux.
- **Browse quickly without duplicating originals.** On-demand thumbnails, nearby-photo prefetching, and a bounded, removable preview cache keep the library light while originals stay in their folders.
- **Find and curate your best photographs.** Filter by date, color, theme, and tags; collect favorites, tag in batches, and search similar photographs on demand without building a vector database first.
- **Make collages and posters with control over composition.** Zoom and move each photograph within its cell, preserve original aspect ratios in a magazine poster, or freely position, resize, rotate, and overlap full photographs on a wooden board. Set title size, customize background and text colors, arrange the story, and preview the actual encoded share JPEG before saving the same result.
- **Create GIF stories and memes.** Scroll a filmstrip, drag frames to reorder, and add movable speech bubbles or text to each photograph. Choose output scale, palette, frame timing, and looping; preview a real encoded GIF, or save one frame as a static PNG meme.
- **Organize from SD card to delivery.** Import by capture date and gather selections across folders into one destination, optionally including CR3. Favorite synchronization first moves other JPEG / CR3 files on the chosen SD card into a recoverable pending-deletion folder for review.
- **Keep several photo folders in one library.** Register folders without moving originals; the index, favorites, and tags survive restarts and disconnected drives. A source already in its target theme is indexed in place, while new imports show progress at the top and open their theme on completion.
- **Stay up to date without losing your library.** From v1.3.7, automatic updates are on by default and can be disabled in Settings. Mac / writable AppImage updates wait for photo tasks and open workbenches, show a 10-second restart countdown, and replace the existing app. Debian packages still require system authorization.

- **Shape color and light locally.** Edit RGB, temperature and tint curves with a complementary color guide. AI Skin Radiance uses local color analysis, adjustable strength and a visible skin-color mask to gently lift skin midtones without smoothing texture. No AI model or upload is required. [Color studio guide](docs/color-studio.md).

*Give every captured moment a small island to return to.*

## 简体中文

**专为拍摄 RAW 的单反与微单摄影用户量身定制的本地桌面相册。**

时光杂货店围绕相机摄影的完整流程设计：从 SD 卡导入、RAW / JPEG 配对浏览、精选整理和修图交接，到拼图海报与光影动图，让照片更容易找、选、用。支持 macOS 与 Linux；**当前支持 JPEG 与 Canon CR3，RAW 支持目前限于 CR3。**

- **一张照片，RAW / JPEG 一起管理。** 配对浏览、放大查看细节与全屏看图；Mac 可交给 Photoshop / Lightroom，Linux 可配置本机编辑器。
- **轻量预览，减少等待和存储负担。** 缩略图按需加载、预读，缓存有上限且可清理；原片留在原目录，浏览不额外复制完整照片。
- **从一堆照片中找出值得留下的作品。** 按日期、色系、主题和标签筛选，收藏精品、批量加标签；相似照片按需计算，无需预先建立向量库。
- **拼图与海报，让每张照片都有合适的构图。** 单张缩放、拖动格内位置；杂志海报保留原比例，木质展示板可自由移动、调大小、旋转和叠放完整照片。标题字号、背景色与文字颜色可调，分享压缩展示实际编码成品，预览与保存一致。
- **GIF 与表情包，让回忆一帧一帧流动。** 滚轮浏览电影胶片、拖拽换序，逐帧添加可移动的对话气泡与文字；设置尺寸、色彩数、时长和循环，预览真实 GIF，也可保存单帧 PNG 表情包。
- **从 SD 卡整理到作品交付。** 新照片按拍摄日期归档，跨目录选片后一键复制，可选携带 CR3；精品同步先将 SD 卡里其他 JPEG / CR3 移入可恢复的待删文件夹，方便核对。
- **多个照片目录，同一个相册。** 添加或移除索引不搬动原片，重启或硬盘暂时断开后仍保留目录、收藏与标签；已有同名主题原位纳入，导入时顶部显示进度，完成后展示本次主题。
- **自动跟进新版，保留自己的相册。** v1.3.7 起默认自动更新，设置里可关闭；Mac / 可写 AppImage 在照片任务和工作台结束后显示 10 秒重启倒计时，沿用原安装位置。Debian 包仍需系统授权。

- **曲线调色与自然肤色通透。** RGB、色温、色调曲线配合互补色盘参考；AI 一键通透使用本地算法，可调强度、取样并查看肤色范围，柔和提亮、保留纹理，无需模型与上传。[调色室说明](docs/color-studio.md)。

*把一次快门，留成一座可以重返的小岛。*

**The app supports English and Simplified Chinese.** A fresh installation starts in English and asks you to choose a language before the usage guide. Existing Chinese profiles stay in Chinese after an upgrade. Switch instantly in **Settings → Interface language**; your choice is remembered. Japanese and Korean guides are documentation translations; their interface languages may be added according to demand.

**App 当前支持英文与简体中文。** 全新安装默认英文，首次打开先选择语言，再进入使用引导；已有中文用户升级后保留中文。在**设置 → 界面语言**可一键切换并记住选择。日文和韩文页面为使用说明翻译，后续根据需求增加界面语言。

![Photo gallery / 相册浏览：synthetic landscapes only / 仅合成风景](docs/screenshots/gallery-en.png)

Smoked sage glass gives the sidebar a quiet visual anchor, while warm-white surfaces keep photographs in focus. Consistent outline icons, clear theme selection, and frosted floating controls bring the interface together. Photographs keep their original colors. Spring entrances, tactile buttons, and continuous photo transitions respect Reduce motion; opaque fallbacks support Reduce transparency. 烟灰绿磨砂侧栏与暖白主区形成轻重层次；统一线条图标、主题高亮及悬浮玻璃控件，照片保持原色。交错入场、按钮回弹和连续转场遵循系统减少动态效果设置，并提供减少透明度时的实色样式。

[Selected-theme workspace / 主题选择后的界面](docs/screenshots/glass-workspace.png)

![GIF and meme studio / GIF 与表情包工作台：synthetic artwork only / 仅合成画面](docs/screenshots/motion-studio.png)

All screenshots use synthetic artwork, with no private photographs, real portraits, personal paths, or real capture metadata. 所有截图使用合成画面，不含私人原片、真人肖像、个人路径或真实拍摄信息。

## 설치

**패키지 이름 안내:** Shutter Cove는 영문 브랜드 이름입니다. v1.3.6부터 중국어 이름은 “时光杂货店”(이전 이름 “拾光屿”)입니다. 호환성을 위해 파일 이름은 계속 `Shiguang-Isle-`로 시작하고 Mac 패키지에는 `Shiguang Isle.app`이 포함됩니다. 같은 앱입니다.

**공식 저장소:** [Undefeated-man/ShutterCove](https://github.com/Undefeated-man/ShutterCove). v1.2.1은 새 주소에서 업데이트를 확인하고 다운로드합니다. 기존 앱 식별자, 설치 경로, 즐겨찾기, 태그와 설정은 유지됩니다.

[GitHub Releases](https://github.com/Undefeated-man/ShutterCove/releases)에서 컴퓨터에 맞는 패키지를 다운로드하세요. 파일 이름은 `Shiguang-Isle-`과 버전 번호로 시작하며, 아래 표에는 플랫폼별 접미사를 표시했습니다.

| 컴퓨터 | 패키지 접미사 | 설치 방법 |
| --- | --- | --- |
| Apple Silicon Mac | `mac-arm64.dmg` | 디스크 이미지를 열고 앱을 Applications 폴더로 드래그합니다 |
| Intel Mac | `mac-x64.dmg` | 디스크 이미지를 열고 앱을 Applications 폴더로 드래그합니다 |
| Linux x64 | `linux-x86_64.AppImage` | 실행 권한을 부여한 뒤 실행합니다 |
| Debian / Ubuntu x64 | `linux-amd64.deb` | 소프트웨어 설치 프로그램으로 열거나 `sudo apt install ./package-name.deb`를 실행합니다 |

### macOS 첫 실행: Apple에서 앱을 확인할 수 없다는 메시지

**현재 Mac 패키지는 ad-hoc 서명되어 있으며, Developer ID 인증서와 Apple 공증은 없습니다. 따라서 Gatekeeper가 첫 실행을 차단할 수 있습니다.** 이는 Apple에서 앱의 안전성을 확인했다는 뜻이 아닙니다.

1. 이 저장소의 [공식 릴리스](https://github.com/Undefeated-man/ShutterCove/releases)에서 컴퓨터 아키텍처에 맞는 패키지를 다운로드합니다. SHA-256 값을 **동일 버전**의 `SHA256SUMS.txt`와 비교합니다.
2. DMG를 열고 **Shiguang Isle.app**을 **Applications(응용 프로그램)** 폴더로 드래그합니다. ZIP 패키지라면 압축을 푼 뒤 앱을 Applications로 옮깁니다.
3. 설치한 앱을 한 번 실행해 봅니다. 차단되면 **시스템 설정 → 개인정보 보호 및 보안 → 보안**으로 이동해 해당 앱의 메시지에서 **확인 없이 열기(Open Anyway)**를 선택합니다.
4. 다음 대화상자에서 **열기**를 확인하고, 필요하면 인증합니다. macOS는 이 앱에 대한 예외를 저장하므로 이후에는 보통 바로 실행할 수 있습니다.

버튼이 보이지 않으면 Applications에 있는 앱을 다시 실행해 본 뒤 해당 설정을 확인하세요. 조직에서 관리하는 Mac이라면 관리자에게 문의하세요. 경고가 **“컴퓨터를 손상시킬 수 있음” 또는 “앱이 손상됨”**이라고 표시된다면 사용을 중단하고 새 사본을 다운로드해 검증하거나 문제를 보고하세요. 이러한 경고를 모두 공증 누락 때문으로 간주하면 안 됩니다. Gatekeeper를 켜 둔 채 앱별 시스템 허용 절차를 사용하세요.

[중·영문 Mac 설치 안내](docs/mac-install.md)와 [Apple 공식 안내](https://support.apple.com/en-us/102445)를 참고하세요.

일부 Linux 배포판에서는 AppImage 실행에 FUSE 2가 필요합니다. Photoshop과 Lightroom은 공식 Linux 데스크톱 버전이 없으므로, 편집기 설정에서 컴퓨터에 설치된 실행 파일을 지정하세요.

Mac 버전을 수동으로 업데이트하려면 실행 중인 구버전을 종료하고 새 앱을 Applications로 드래그해 교체한 뒤, Applications에서 새 앱을 실행합니다. 같은 macOS 계정과 앱 식별자를 유지하면 사진을 다시 복사하지 않고 기존 로컬 설정, 태그, 즐겨찾기를 계속 사용할 수 있습니다. 새 패키지도 동일 버전의 체크섬으로 검증하고, macOS가 다시 요청하면 위의 앱별 허용 절차를 따르세요.

v1.0.8부터 **相册设置 → 软件更新(설정 → 소프트웨어 업데이트)**에서 수동으로 확인·다운로드·설치할 수 있습니다. **v1.3.7부터 자동 업데이트가 기본으로 켜져 있으며**, 같은 설정에서 켜거나 끌 수 있습니다. Mac / 쓰기 가능한 AppImage는 새 버전을 백그라운드에서 다운로드하고 검증합니다. 사진 작업, 선택 작업, 상세 보기, 편집, 콜라주, GIF, 설정 창이 끝나면 화면 상단에 **다시 시작까지 10초 카운트다운**을 표시합니다. 새 작업을 시작하거나 창을 열면 설치를 미루고, 종료 후 카운트다운을 다시 시작합니다. 자동 업데이트를 끄면 자동 재시작도 취소됩니다. 기존 앱을 같은 위치에서 교체하고 등록 폴더, 즐겨찾기, 태그, 설정을 유지하므로 앱 사본을 추가하지 않습니다. Mac 앱은 쓰기 가능한 Applications에, AppImage는 쓰기 가능한 위치에 설치하세요. DMG나 빌드 폴더의 Mac 앱은 제자리 업데이트를 지원하지 않습니다. Linux deb는 새 버전을 알리며, **下载并打开安装器(다운로드 후 설치 프로그램 열기)**를 클릭해 시스템 인증과 설치를 직접 완료해야 합니다. 이후 앱을 수동으로 다시 실행하세요. [업데이트 안내](docs/updates.md)를 참고하세요.

## 기능

**v1.4.0: 색상 편집 스튜디오.** 사진 상세 화면에서 “Color & edit / 调色与修图”를 엽니다. RGB, 색온도, 색조 곡선을 클릭해 조절점을 추가하고 보색환을 참고하여 색을 조정할 수 있습니다. “AI Skin Radiance”는 모델이나 업로드 없이 기기에서 색을 분석합니다. 강도, 피부색 샘플 및 마스크 표시를 조절할 수 있지만 비슷한 색의 배경도 선택될 수 있습니다. 피부 질감을 흐리지 않고 부드럽게 보정하며 원본 비교와 실행 취소를 지원합니다. [영문·중문 안내와 합성 화면](docs/color-studio.md). 앱 표시 언어는 여전히 영어와 간체 중국어 두 가지입니다.

| 기능 | 사용 방식 |
| --- | --- |
| 인터페이스 언어 | 영어·간체 중국어. 첫 실행 시 선택하고 설정에서 즉시 전환. 다시 시작해도 선택 유지 |
| 첫 사용 안내 | 다섯 단계로 사진 라이브러리와 작업 흐름을 소개합니다. 건너뛰거나 완료하면 상태를 저장하며, 설정에서 다시 열 수 있습니다 |
| 자동 업데이트와 수동 설치 | v1.3.7부터 기본 켜짐, 설정에서 끌 수 있습니다. Mac / 쓰기 가능한 AppImage는 검증 후 작업 종료를 기다려 10초 카운트다운으로 제자리 업데이트하며 데이터를 유지합니다. deb는 시스템 인증이 필요합니다 |
| 여러 폴더의 영구 인덱스 | 여러 사진 폴더를 등록합니다. 제거는 탐색 범위만 바꾸며 원본·즐겨찾기·태그를 유지합니다. 오프라인 드라이브도 연결 후 새로 고침하면 복구됩니다 |
| 상세 보기 확대와 이동 | Option / Alt를 누른 채 스크롤해 확대하고 드래그해 이동합니다. 창에 맞추기 또는 두 번 클릭으로 초기화하며, 맞춤 크기 기준 최대 16배 확대를 지원합니다 |
| 운영체제 전체 화면 상세 보기 | 전체 화면 버튼 또는 F로 전환하고 JPEG / CR3 미리보기와 인접 사진을 탐색합니다. Esc는 먼저 전체 화면을 나간 뒤 상세 보기를 닫습니다 |
| 색상별 정리 | 이미지 색상을 자동 분석하고 날짜 범위를 지정해 탐색합니다 |
| 날짜와 테마 검색 | 달력에서 날짜를 선택하거나 직접 입력합니다. 테마 이름을 검색하고 개별 또는 선택한 사진에 테마를 지정합니다 |
| 날짜 타임라인 | 가느다란 막대에 포인터를 올리거나 누르면 반투명 날짜 표시가 펼쳐집니다. 현재 필터 결과 전체에서 날짜로 이동하며, 기본 정렬은 최신순입니다 |
| 비슷한 사진 찾기 | 폴더를 선택하고 평균 풀링한 RGB 픽셀의 코사인 유사도를 비교합니다. 세밀도, 예상 시간, 진행률, 취소를 지원합니다 |
| 콜라주와 포스터 | 세로·가로 연결, 4칸·9칸, 여백, 필름, 원본 비율 잡지, 나무 전시판 레이아웃을 제공합니다. 포스터는 한 줄 1–12장(기본 2장), 제목 크기 조정, 새 JPEG 내보내기를 지원합니다 |
| 사진별 구도 조정 | 사진을 선택해 칸 안에서 크기와 위치를 조정하고 채우기 또는 전체 넣기를 선택합니다. 순서를 바꿔도 구도는 사진을 따라가며 캔버스 확대와 별도로 적용됩니다 |
| 공유용 압축 조절 | 최종 이미지 너비와 JPEG 품질을 설정하고 전체 비율과 높이를 유지합니다. 원본을 최종 캔버스에 직접 그리며 미리보기와 저장에 같은 인코딩 결과를 사용합니다 |
| GIF와 밈 제작 | 필름 스트립을 스크롤하고 드래그해 순서를 바꿉니다. 프레임별 글자·말풍선, 크기, 팔레트, 전체 프레임 지연, 반복을 설정하고 인코딩된 GIF를 미리 보거나 정적 밈을 저장합니다 |
| 즐겨찾기 | 사진을 즐겨찾기로 표시하고 전용 화면에서 탐색합니다 |
| 개별·일괄 태그 | 사진 한 장의 태그를 편집하거나 선택한 사진에 태그를 추가합니다 |
| 공통 필터 | 날짜·색상·테마·태그 조건을 전체 사진, 즐겨찾기, 색상 탐색, 유사도 결과, 콜라주 사진 선택에 적용합니다 |
| 상단 고정 도구 모음 | 필터·선택·정렬을 화면 상단에 유지합니다. 달력이나 메뉴를 사용한 뒤 포커스가 돌아와도 스크롤 위치를 유지합니다 |
| 반투명 유리 스타일 메뉴 | 달력과 어울리는 세이지 색상, 최대 6개 항목과 은은한 스크롤 가장자리 효과를 제공합니다. 긴 목록 검색, 방향키 선택, Enter 확인, Esc 닫기를 지원합니다 |
| 창 크기와 글꼴 크기 | 창 크기를 조절할 수 있습니다. 설정의 글꼴 크기 슬라이더는 변경을 즉시 미리 보여 주고 저장하며, 기본 120%, 범위 100%–150%입니다 |
| 간단한 편집 | 자르기, 회전, 가로·세로 반전, 사각형·타원형 픽셀 모자이크를 적용합니다. JPEG를 덮어쓰거나 새 파일로 저장합니다 |
| SD 카드 가져오기·기존 사진 등록 | 새 사진을 테마에 복사해 촬영 날짜로 정리합니다. 이미 같은 이름의 테마 폴더에 있는 사진은 복제 없이 등록합니다. 준비·읽기·복사·등록 진행률을 상단에 표시하고 완료 후 해당 테마를 엽니다 |
| 일괄 선택과 삭제 | 다중 선택, 범위 선택, 필터 결과 전체 선택을 지원하며, 확인 후 시스템 휴지통으로 이동합니다 |
| 선택 사진을 폴더로 복사 | 기존 폴더를 선택하거나 선택 창에서 새 폴더를 만든 뒤, 서로 다른 하위 폴더의 JPEG를 한 폴더에 모읍니다. CR3 포함은 선택 사항(기본 꺼짐)이며, JPEG / CR3 쌍에 같은 충돌 회피 이름을 적용하고 진행률·취소·결과를 제공합니다 |
| SD 카드에 즐겨찾기 동기화 | 즐겨찾기 또는 현재 선택에서 남길 파일을 미리 확인합니다. 다른 JPEG / CR3는 작업 기록과 함께 복구 가능한 `待删` 배치로 이동합니다 |

사진 상세 보기에서는 JPEG와 대응하는 CR3 미리보기를 같은 화면에 위아래로 표시합니다. 각 형식에는 Photoshop, Lightroom, 시스템 앱으로 열기 버튼이 있습니다. 큰 가로 사진, 세로 사진, 파노라마도 원본 비율을 유지하며 미리보기 틀 안에 전체가 들어가고, 틀은 창 높이에 맞춰 조절됩니다. 상세 보기를 스크롤하면 아래쪽 CR3 미리보기와 편집기 버튼에 접근할 수 있으며 이전 / 다음 버튼은 계속 사용할 수 있습니다. 탐색할 때는 원본 전체 사본 대신 가벼운 미리보기 캐시를 만듭니다.

![합성 풍경을 사용한 JPEG / CR3 쌍 미리보기와 편집기로 보내기](docs/screenshots/paired-preview.png)

이 스크린샷은 생성한 사진과 예시 메타데이터를 사용하며, 실제 인물이나 개인 촬영 정보를 포함하지 않습니다.

상세 보기에서 **Option(Mac) / Alt**를 누른 채 스크롤하면 확대·축소하고, 확대된 이미지를 드래그하면 이동할 수 있습니다. 일반 스크롤은 상세 화면을 스크롤합니다. **适合窗口(창에 맞추기)** 또는 이미지 두 번 클릭으로 초기화합니다. 미리보기에 포커스가 있을 때 + / −로 확대·축소하고 0으로 초기화합니다. **100%는 창에 맞춘 크기 기준이며 원본 픽셀 1:1 표시가 아닙니다.** 최대 확대는 맞춤 크기의 16배입니다. JPEG와 CR3는 각각 독립적으로 확대됩니다. 사진을 바꾸거나 미리보기 영역 크기를 변경하면 맞춤 보기로 돌아옵니다. CR3 확대는 RAW 현상 대신 카메라에 내장된 미리보기를 사용하므로 선명도는 해당 미리보기의 해상도에 따라 달라집니다.

미리보기 옆의 **全屏(전체 화면)**을 클릭하거나 **F**를 누르면 운영체제 전체 화면 모드로 전환합니다. JPEG / CR3 미리보기를 전환하고 ← / →로 인접 사진을 보면서 확대와 이동도 사용할 수 있습니다. **Esc**를 한 번 누르면 상세 보기로 돌아가고, 다시 누르면 상세 보기를 닫습니다. 닫을 때는 창의 이전 전체 화면 상태를 복원합니다.

![독립적인 상세 확대: 합성 JPEG는 223%, CR3 내장 미리보기는 창에 맞춘 상태](docs/screenshots/detail-zoom.png)

![합성 사진을 사용한 콜라주 확대와 한 줄 사진 수 설정](docs/screenshots/collage-zoom.png)

**调整构图(구도 조정)**을 선택하고 사진을 클릭한 뒤 칸 안에서 드래그하거나 크기를 바꾸세요. 전체 넣기를 선택하면 사진 전체가 보입니다. 썸네일 순서를 바꿔도 구도는 해당 사진에 유지됩니다. Alt / Option + 스크롤은 캔버스 전체를 확대합니다. 확대 상태에서 일반 드래그는 캔버스를 이동하고 **Shift + 드래그**는 선택한 사진을 조정합니다.

원본 비율 잡지 레이아웃은 사진 전체를 원래 비율로 유지하며 제목 영역을 별도로 제공합니다. 나무 전시판에서는 사진 자체를 이동·크기 조절·회전하고 겹치도록 배치하면서 앞뒤 순서를 바꿀 수 있습니다. 제목 크기는 내보내기 너비에서의 픽셀 단위로 지정되며, 출력이 작아지면 함께 줄어듭니다.

![원본 비율 잡지: 합성 사진 전체와 별도 제목 영역](docs/screenshots/collage-magazine.png)

![나무 전시판: 위치·각도·크기를 조정하고 겹쳐 놓은 합성 사진](docs/screenshots/collage-board.png)

공유용 사전 압축을 켜고 **최종 이미지 너비**와 JPEG 품질을 지정하세요. 기본 너비는 **1,440 px**, 고해상도 설정은 **2,560 px**, 사용자 지정 범위는 **480–8,000 px**이며 비압축 출력 너비보다 확대하지 않습니다. 전체 레이아웃을 같은 비율로 줄여 세로 내용을 모두 보존하고 이미지를 늘리지 않습니다. 예를 들어 3000 × 8364 레이아웃은 너비 1440 기준 약 1440 × 4015가 되어, 긴 변 1440 기준의 좁은 516 × 1440 결과를 피합니다. 각 변 24,000 px와 총 4,800만 픽셀 한도를 넘으면 비율을 유지해 더 줄이고 실제 크기를 표시합니다. 원본을 최종 크기의 캔버스에 직접 그린 뒤 JPEG를 한 번 인코딩하므로 사진별 사전 축소를 생략합니다. 미리보기와 저장은 같은 JPEG 바이트를 사용하며 변경 시 다시 생성합니다. 원본을 유지하고 사진 폴더에 중간 사본을 만들지 않습니다. 익명 **3000 × 8364 → 516 × 1440** 샘플은 모든 WeChat 처리 규칙을 뜻하지 않습니다. 더 많은 출력 픽셀은 세부 정보 보존에 도움이 되지만 추가 압축 방지를 보장하지 않습니다. ‘보이는 대로 저장’은 이 앱이 내보내는 파일을 뜻합니다.

JPEG 품질의 기본값은 **90%**입니다. 공유 미리보기는 “**适合宽度 / Fit to width**”(너비에 맞추기)로 시작하며 일반 스크롤로 긴 이미지 전체를 볼 수 있습니다. “适合窗口 / Fit to window”로 전체를 확인하고 “适合宽度”로 너비 표시에 돌아오세요. Alt / Option + 스크롤로 세부 부분을 확대할 수도 있습니다.

![공유 미리보기: 전체 높이를 보존한 콜라주를 너비에 맞춰 표시, 합성 사진만 사용](docs/screenshots/share-width-preview.png)

JPEG가 있는 사진을 선택해 GIF / 밈 제작을 엽니다. 필름 스트립을 스크롤하고 썸네일을 드래그해 순서를 바꾸며, 현재 프레임에 글자와 말풍선을 추가하거나 드래그합니다. 출력 크기, 팔레트 크기, 전체 프레임 지연, 반복을 설정한 뒤 실제 인코딩된 GIF를 미리 보고 같은 결과를 저장하세요. 사진 한 장은 정적 밈으로도 만들 수 있습니다. CR3만 있는 사진은 먼저 JPEG로 내보내야 합니다. 인코딩은 진행률과 취소를 지원합니다. GIF는 최대 256색이므로 사진의 그라데이션에 색 띠가 나타날 수 있습니다.

![GIF와 밈 작업 화면: 합성 사진으로 필름 순서와 말풍선을 편집하고 인코딩 미리보기 생성](docs/screenshots/motion-studio.png)

[중·영문 창작 스튜디오 안내](docs/creative-studio.md)를 참고하세요. 이 창작 화면들은 합성 사진을 사용하며 실제 인물이나 개인 정보를 포함하지 않습니다.

![개인 정보 없이 시연한 업데이트 확인과 버전 알림](docs/screenshots/update-settings.png)

![글꼴 설정: 큰 기본 글꼴과 즉시 미리보기](docs/screenshots/font-settings.png)

달력에서 날짜를 고르거나 직접 입력할 수 있습니다. 가느다란 타임라인을 사용하면 반투명 날짜 표시가 펼쳐져 현재 필터 결과를 빠르게 탐색할 수 있습니다.

![클릭 날짜 선택과 직접 입력을 지원하는 달력 필터](docs/screenshots/calendar.png)

![빠른 이동을 위한 날짜 표시가 펼쳐진 가느다란 타임라인](docs/screenshots/timeline.png)

![스크롤 후 상단에 고정된 필터·선택·정렬 도구 모음. 합성 풍경 사용](docs/screenshots/sticky-toolbar.png)

![6개 항목 스크롤과 은은한 가장자리 효과를 제공하는 반투명 필터](docs/screenshots/dropdown.png)

![일괄 폴더 복사: 기본 JPEG, 선택적 CR3, 새 폴더 만들기가 가능한 대상 선택 창](docs/screenshots/copy.png)

SD 카드 즐겨찾기 동기화는 확인 전에 남길 목록과 이동할 목록을 보여 줍니다. 다른 사진은 복구 가능한 `待删` 배치로 이동합니다. 아래 스크린샷은 합성 미리보기만 보여 줍니다. 이동 작업을 실행하지 않았으며 실제 SD 카드에 접근하지 않았습니다.

![SD 카드 즐겨찾기 동기화의 남길 파일·이동할 파일 미리보기](docs/screenshots/sd-sync.png)

이 스크린샷들은 합성 사진을 사용하며, 실제 인물, 개인 경로, 실제 촬영 정보를 포함하지 않습니다.

## 여러 폴더와 사진 가져오기

**相册设置 → 已索引的照片目录(설정 → 등록된 사진 폴더)**에서 독립 폴더를 추가할 수 있고 앱을 다시 시작해도 등록을 유지합니다. 추가는 탐색용 인덱스를 만드는 작업입니다. **移除索引(인덱스 제거)**는 원본을 이동하거나 삭제하지 않고 즐겨찾기와 태그도 보존합니다. 같은 폴더를 다시 추가하면 표시가 복구됩니다. 겹치는 폴더는 실제 파일 경로로 중복을 제거하며, 유사도 검색에서만 선택한 폴더는 자동 등록하지 않습니다. 외장 드라이브가 끊겨도 경로를 유지하고 다른 폴더를 사용할 수 있습니다. 다시 연결한 뒤 새로 고침하세요.

가져오기에서 사진 소스, 저장할 루트 폴더, 테마를 선택합니다. 새 사진은 테마로 복사하고 촬영 날짜별로 정리합니다. 소스가 이미 저장 위치의 같은 이름 테마 폴더라면 제자리에서 인덱스에 추가하며 복사·이동·날짜 폴더 재배치를 하지 않습니다. 소스 자신을 중복 사본으로 보지 않으며, 모두 중복이거나 사진이 없는 경우 빈 테마를 만들지 않습니다. 준비, 촬영 정보 읽기, 복사 또는 등록 진행률은 창 상단에 표시되어 아래로 스크롤해도 볼 수 있습니다. 취소해도 완료한 사본은 유지합니다. 성공하면 기존 등록을 보존하면서 이번 테마를 추가하고 표시합니다. **默认展示主题(기본 표시 테마)**에서 시작 시 표시할 테마를 지정할 수 있으며 일반적인 폴더 추가·제거 후에는 모든 테마를 표시합니다.

## 라이브러리 사용

일반 모드 첫 실행 시 다섯 단계 안내가 나타납니다. 로컬 JPEG / CR3 라이브러리, 폴더 열기 또는 SD 카드 가져오기, 필터·즐겨찾기·태그, 편집과 공유, 확인 전 SD 정리 검토를 소개합니다. ← / →로 이동할 수 있습니다. 건너뛰거나 완료하면 상태가 저장되어 이후 자동으로 열리지 않으며, 저장 실패 시 다시 시도할 수 있습니다.

**开始浏览(탐색 시작)**을 누르면 안내를 닫고, **选择照片文件夹(사진 폴더 선택)**을 누르면 폴더 선택 창을 엽니다. 안내는 사용 방법을 설명하며 사진을 자동으로 정리하지 않습니다. 이미 라이브러리를 설정한 사용자는 업데이트 시 안내로 작업을 방해받지 않습니다. **相册设置 → 重新查看使用引导(앨범 설정 → 사용 안내 다시 보기)**에서 다시 열 수 있습니다.

![합성 JPEG / CR3 이미지를 사용한 다섯 단계 첫 사용 안내. 개인 사진 없음](docs/screenshots/onboarding.png)

1. 사진 폴더를 선택하거나 설정에서 여러 폴더를 추가합니다. 등록한 범위의 하위 폴더를 읽고 통합하며 이름·날짜·폴더 관계로 JPEG / CR3 쌍을 인식합니다. 원본 위치와 로컬 표시를 유지합니다.
2. 날짜 범위, 색상, 태그, 테마로 필터링합니다. 달력에서 날짜를 선택하거나 직접 입력하세요. 날짜 막대로 필터 결과 전체에서 이동할 수 있으며, 포인터를 올리거나 누르면 반투명 날짜 표시가 펼쳐집니다. 기본 탐색 순서는 최신순입니다. 즐겨찾기 화면에서 고른 사진을 다시 볼 수 있습니다.
3. 여러 사진을 선택해 태그 추가, 즐겨찾기 표시, 폴더 복사, 휴지통 이동을 실행합니다. **复制到文件夹(폴더로 복사)**로 서로 다른 하위 폴더의 사진을 모으세요. 기존 대상 폴더를 선택하거나 선택 창에서 새 폴더를 만들 수 있습니다. 기본으로 JPEG를 복사하고 대응하는 CR3도 포함할 수 있습니다. 원본은 그대로 유지합니다. 이름이 겹치면 각 JPEG / CR3 쌍에 공통으로 적용되는 고유 이름을 만듭니다. 진행률과 복사·건너뜀·실패 결과를 확인하고 필요하면 취소하세요. CR3 복사를 켜지 않으면 RAW만 있는 사진은 건너뜁니다. 사진 한 장은 파일 관리자에서 표시하거나 JPEG / CR3를 편집기로 보낼 수도 있습니다.
4. 유사 사진 검색을 열고 기준 사진과 검색 폴더를 선택한 뒤 풀링 세밀도를 지정합니다. 계산은 해당 검색 시점에 수행합니다. 결과는 날짜와 다른 공통 조건으로 추가 필터링할 수 있습니다.
5. 콜라주 작업 화면에서 레이아웃을 선택하고 각 사진을 조정합니다. 여백·필름·원본 비율 잡지 포스터는 한 줄 1–12장(기본 2장)을 지원합니다. 나무 전시판에서는 사진 위치·각도·앞뒤 순서를 조정합니다. 썸네일 드래그로 순서를 바꾸거나 캔버스 교환을 선택해 직접 서로 바꿀 수 있습니다. Alt / Option + 스크롤은 미리보기를 확대하고, 일반 드래그는 캔버스 이동, Shift + 드래그는 사진 조정에 사용합니다. 창에 맞추기로 보기를 초기화합니다. 공유용 압축을 켰다면 새 사진으로 저장하기 전에 인코딩된 JPEG 결과를 확인하세요.
6. 편집기로 자르기, 회전, 반전, 사각형·타원형 모자이크를 적용합니다. 덮어쓰기 또는 다른 이름으로 저장을 선택하세요. 캔버스 내보내기는 원본 EXIF를 유지하지 않으며 편집은 CR3를 덮어쓰지 않습니다.
7. SD 카드나 다른 폴더에서 저장 루트로 가져오고 기존 또는 새 테마를 선택합니다. 준비 단계부터 상단에 진행률을 표시합니다. 새 사진은 촬영 날짜로 복사·정리하고 같은 이름 테마에 이미 있는 사진은 제자리에서 등록합니다. 원본은 남고 성공 후 이번 테마를 엽니다.
8. 즐겨찾기 또는 현재 선택을 SD 카드에 동기화합니다. 먼저 남길 목록과 이동할 목록을 확인하세요. 다른 사진은 카드 안의 `待删` 배치로 이동하며 상대 경로와 작업 기록을 보존합니다. 일치 항목이 없거나 대응 관계가 모호하거나 미리보기 이후 파일이 변경되면 실행을 중단합니다.
9. JPEG가 있는 사진을 선택해 GIF / 밈 제작을 엽니다. 프레임을 스크롤하고 드래그해 순서를 바꾸며 프레임별 글자를 추가합니다. GIF 저장 전 인코딩된 미리보기를 생성하거나, 현재 프레임을 정적 밈으로 저장하세요.

`待删`로 이동하면 파일 내용은 보존되며 카드 용량이 즉시 비워지는 것은 아닙니다. 배치 폴더를 열어 확인하거나 기록된 원래 위치로 복원할 수 있습니다. 더 이상 필요 없다고 판단한 뒤 대기 파일을 직접 삭제하세요.

테마와 태그는 사용자가 직접 지정하는 로컬 메타데이터입니다. 색상 계열은 이미지 픽셀에서 분석하여 따뜻한 색, 파랑, 초록 등 비슷한 색조를 찾는 데 도움을 줍니다. 장소를 식별하거나 사진의 이야기를 해석하지는 않습니다.

필터와 정렬 메뉴는 마우스·키보드를 모두 지원합니다. 긴 목록은 한 번에 최대 6개 항목을 표시하며 스크롤이나 항목 검색을 지원합니다. ↑ / ↓로 이동, Enter로 확인, Esc로 닫습니다. 가장자리의 은은한 흐림 효과는 스크롤할 내용이 더 있음을 나타냅니다.

CR3 표시는 전체 RAW 현상이 아닌 카메라 내장 미리보기를 사용합니다. Photoshop은 보통 Adobe Camera Raw로 RAW 처리를 진행합니다. Lightroom은 설치 버전에 따라 가져오기 대화상자를 보여 줄 수 있습니다. 앱은 파일을 전달하며 Adobe 카탈로그로의 가져오기를 자동 완료하지 않습니다.

세로·가로 콜라주는 고정된 사진 수 제한이 없습니다. 메모리 사용을 조절하기 위해 캔버스의 **긴 변은 24,000픽셀**, **총 픽셀 수는 4,800만**으로 제한합니다. 더 큰 결과는 비율을 유지해 축소합니다. 매우 큰 원본을 간단히 편집할 때도 같은 제한을 적용합니다. 이를 초과하는 원본 해상도 현상에는 전문 편집기를 사용하세요.

GIF는 **2–80프레임**, **가로·세로 각각 최대 1,600픽셀**, **모든 프레임 합계 2,400만 픽셀**, **인코딩 결과 24 MB**를 지원합니다. 인터페이스는 픽셀 한도에 맞춰 크기를 줄이며 남은 제한 오류를 안내합니다. 사진 한 장은 정적 밈으로 저장할 수 있습니다. 이 자원 제한은 다른 앱의 전송 제한을 설명하는 것이 아닙니다.

갤러리의 필터·선택·정렬 도구 모음은 스크롤 중에도 상단에 고정됩니다. 맨 위로 돌아가지 않고 조건과 정렬을 바꾸거나 선택 사진에 작업을 적용할 수 있습니다. 높이는 창 크기와 글꼴 크기에 맞게 조절되며 사진 이동 시 도구 모음 아래 공간을 확보합니다. 달력·메뉴를 열고 닫거나 항목을 확인한 뒤 포커스가 돌아와도 현재 스크롤 위치를 유지합니다.

## 성능과 저장 공간

썸네일은 필요할 때 생성하며 화면에 보이는 사진과 주변 사진을 우선합니다. 스캔은 초기 결과부터 갤러리에 전달하고 이후 스캔에서는 캐시한 파일 메타데이터를 재사용합니다. RAW 미리보기는 가능한 경우 내장 이미지를 사용합니다. 미리보기 캐시는 **512 MB**로 제한하고, 오래 사용하지 않은 항목부터 제거하며, 직접 비울 수도 있습니다. 탐색은 원본 해상도 사진 사본을 만들지 않습니다.

로컬 기록, 즐겨찾기, 태그, 테마, 설정, 지울 수 있는 미리보기는 운영체제의 앱 데이터 폴더(Electron `userData`)에 저장합니다. 큰 라이브러리의 첫 스캔은 파일 정보를 읽는 시간이 필요합니다. 손상되었거나 오프라인이거나 미리보기가 없는 RAW 파일은 오류를 표시할 수 있지만 다른 사진은 계속 사용할 수 있습니다.

덮어쓰기 편집, 콜라주 내보내기, 일괄 복사, SD 카드 가져오기는 사용자의 선택에 따라 파일을 만들거나 변경합니다. 일괄 복사는 원본을 유지하며, 취소하더라도 이미 복사한 파일은 남습니다. 일괄 삭제는 실행 전에 개수와 확인을 표시하고 시스템 휴지통을 사용합니다. 권한 부족, 드라이브 연결 해제, 공간 부족은 작업 오류로 알려 줍니다.

## 개발과 빌드

Node.js 22, npm, macOS 또는 Linux를 사용합니다. Linux에서는 ExifTool에 시스템 Perl이 필요하며 macOS에는 Perl이 포함되어 있습니다.

```sh
npm ci
npm test
npm run privacy
npm run icon
npm start
```

합성 사진 시연 실행:

```sh
npm run demo
```

설치 패키지 빌드:

```sh
# Build on a Mac with the corresponding architecture
npm run build:mac
# Build on Linux x64
npm run build:linux
```

패키지는 `dist/`에 생성됩니다. GitHub Actions는 macOS 15 arm64, macOS 15 Intel, Ubuntu 22.04 x64에서 빌드하고, 패키지로 만든 앱을 실행해 합성 테스트 데이터로 갤러리, 콜라주 제한, SD 인터페이스, 글꼴 설정, 달력 입력, 날짜 타임라인, 메뉴, 일괄 복사 인터페이스와 실제 디스크 복사, 운영용 IPC, 디스크 내보내기, 복구 가능한 SD 동기화를 검사합니다. 조립이 성공하면 패키지와 체크섬이 포함된 릴리스 초안을 만듭니다. `package.json`과 일치하는 `v` 태그를 푸시하거나 기존 태그에 대해 워크플로를 수동 실행하세요. 공개하기 전에 초안을 검토하세요.

## 개인정보 보호와 라이선스

앱에는 계정 시스템, 원격 사용 정보 수집, 사진 업로드 기능, 온라인 사진 분석이 없습니다. 업데이트 확인은 이 프로젝트의 GitHub Releases와 패키지 다운로드 서비스만 사용하며 사진, 태그, 라이브러리 경로를 전송하지 않습니다. 설정에서 자동 업데이트를 끌 수 있으며 이후에도 수동으로 확인하고 설치할 수 있습니다. 공개 저장소에는 소스 코드, 아이콘, 합성 스크린샷을 포함합니다. `npm run privacy`는 원본 미디어, 런타임 데이터베이스, 개인 절대 경로, 일반적인 비밀 정보 형식을 검사합니다. 스크린샷 내용은 시각적으로도 검토해야 합니다.

앱 소스는 [MIT 라이선스](LICENSE)를 사용합니다. Electron, Sharp, ExifTool과 기타 의존성은 각자의 라이선스를 유지합니다. ExifTool은 Phil Harvey가 제작했으며 Perl과 같은 이중 라이선스 조건을 사용합니다. [아키텍처와 외부 구성 요소 고지](docs/architecture.md)를 참고하세요.

실제로 검증한 내용과 남은 범위는 [검증 기록과 제한 사항](docs/validation.md)에서 확인할 수 있습니다.
