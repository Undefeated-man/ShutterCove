# 光影创作台 / Creative studio

## 中文

### 构图与两种新海报

拼图中的“调整构图”用来单独调整一张照片：先点击照片，再拖动格内画面或调整该照片的缩放。缩略图换序会让构图跟着照片移动。Option / Alt + 滚轮仍控制整个预览；两种缩放不会混淆。

“原比例杂志”保留每张照片的长宽比，以整齐的照片列和独立标题区排版。“木质展示板”把完整照片当作贴在板上的小卡片：可拖动位置、调整尺寸和角度、前移或后移图层，允许相互遮挡。标题字号可按最终导出像素设置。

### 主动分享压缩与成品预览

打开“主动压缩图片大小”后，先从原片处理每张照片，再合成并编码最终 JPEG，界面展示解码后的真实成品，保存时写入同一份编码字节。处理只使用内存，不覆盖原片，也不在照片目录生成中间副本。修改布局后需要重新生成，完成后才可导出。

用户提供的一组匿名长图样本，从 3000 × 8364 / 2,796,430 字节变为 516 × 1440 / 86,184 字节。收到的 JPEG 量化表与 libjpeg 质量 80 的表一致；这能支持一个长边 1440、质量 80 的参考档位，不能推导出微信在所有版本与发送方式下的固定算法。长图被整体缩小后，每张小照片获得的像素也减少。预先压缩无法保证绕过再次压缩，更不会恢复已经失去的细节。

可以设置目标长边和 JPEG 质量，并查看像素、文件大小及压缩成品。这里的“所见即所得”指本应用导出的文件；微信再次处理后的效果仍需要实际发送验证。需要保留更多细节时，选择更清晰的尺寸，或另行发送照片原文件。

### GIF 与表情包

多选照片后打开“GIF / 表情包”。滚轮前后查看胶片，拖动缩略图换顺序；当前帧和相邻画面突出显示，远处逐渐淡化。设置尺寸比例、颜色质量、每帧时长及循环，再添加每帧文字或对话气泡。预览是实际编码的 GIF，保存同一份成品。静态帧也可以另存为表情包。

GIF 的颜色数有限，渐变或摄影画面可能出现色带。缩小尺寸、帧数和颜色质量可以减少文件大小。编码有进度及取消，资源上限会在界面反馈。

### 详情全屏

照片详情点击“全屏”或按 F，进入全屏看图。保留 Option / Alt 缩放、拖动及左右切换；Esc 优先退出全屏，再按一次关闭详情。关闭详情会恢复进入前的窗口状态。

## English

### Composition and new poster layouts

Choose composition adjustment, select a photograph, and drag within its cell or change that photograph's zoom. Reordering thumbnails keeps the composition attached to its photograph. Option / Alt + scroll continues to zoom the entire preview independently.

The original-ratio magazine layout keeps each photograph's aspect ratio, with balanced columns and a separate title area. The wooden display board treats full photographs as movable cards: change their position, size, angle, and stacking order, with overlap allowed. Title size can be set in final export pixels.

### Controlled share compression and encoded previews

Enable proactive compression to process each original, compose the result, and encode the final JPEG. The preview displays that encoded file after decoding, and saving writes the same bytes. Intermediate processing stays in memory and does not overwrite originals or create copies in photo folders. Layout changes regenerate the result before export.

One anonymous user-supplied long-image pair changed from 3000 × 8364 / 2,796,430 bytes to 516 × 1440 / 86,184 bytes. The received JPEG's quantization tables match libjpeg quality 80. This supports a 1440-pixel / quality-80 reference preset, not a universal WeChat algorithm. Shrinking a tall collage reduces the pixels available to each photograph. Precompression cannot guarantee avoidance of further processing or restore lost detail.

Set the maximum edge and JPEG quality, inspect dimensions and file size, and preview the encoded result. WYSIWYG refers to this app's exported file; subsequent processing by WeChat still requires a real send test. Choose larger dimensions or send original files separately when more detail is needed.

### GIF and meme creation

Select photographs and open GIF / meme creation. Scroll through the filmstrip and drag thumbnails to reorder. The current and neighboring frames remain prominent while distant frames fade. Configure output scale, color quality, frame timing, and looping, then add text and speech bubbles per frame. Preview the actual encoded GIF and save the same result, or export a static meme frame.

GIF uses a limited color palette, so photographic gradients can show banding. Smaller dimensions, fewer frames, and reduced palette quality can lower file size. Encoding offers progress, cancellation, and explicit resource limits.

### Fullscreen details

Choose Fullscreen or press F in photo details. Option / Alt zoom, dragging, and adjacent-photo navigation remain available. Escape exits fullscreen first; a second Escape closes details. Closing details restores the prior window state.
