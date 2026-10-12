# 光影创作台 / Creative studio

## 中文

### 构图与两种新海报

拼图中的“调整构图”用来单独调整一张照片：先点击照片，再拖动格内画面或调整该照片的缩放。缩略图换序会让构图跟着照片移动。Option / Alt + 滚轮仍控制整个预览；两种缩放不会混淆。

“原比例杂志”保留每张照片的长宽比，以整齐的照片列和独立标题区排版。“木质展示板”把完整照片当作贴在板上的小卡片：可拖动位置、调整尺寸和角度、前移或后移图层，允许相互遮挡。标题字号可按最终导出像素设置。

### 主动分享压缩与成品预览

打开“主动压缩图片大小 · 分享预览”，用**最终成图宽度**而不是长边高度控制尺寸。默认宽度为 1,440 px，清晰档为 2,560 px，自定义可设 480–8,000 px；不会放大超过未压缩的导出宽度。整幅布局等比缩放、保留完整高度，不拉伸照片，也不会因设置高度上限而截掉纵向内容。例如 3000 × 8364 的成图按宽度 1440 输出，约为 1440 × 4015；按长边 1440 则仅有 516 × 1440，每张小照片分到的像素明显更少。

原片逐张直接绘制到最终尺寸画布，使用高质量图像平滑，再统一进行一次 JPEG 编码；不先对每张照片生成缩小副本。界面展示解码后的真实成品，保存写入同一份编码字节。处理只使用内存，不覆盖原片，也不在照片目录生成中间副本。修改布局或构图后重新生成，完成后才可导出。

每边最多 24,000 px、总面积最多 4,800 万像素的资源限制仍然生效；过长的排版可能因此输出得比目标宽度小，界面会显示实际尺寸和限制原因。安全缩放仍保持比例与完整排版。宽度压缩不会改变所选模板和格子原本的裁剪方式；需要完整保留单张照片时，选择“完整放入格子”或原比例海报。

“最终宽度（px）”控制导出文件，JPEG 品质默认 90%。分享预览默认“适合宽度”，在预览区使用普通滚轮上下浏览长图，不把整条海报压在一屏内。点击“适合窗口”总览，再点击“适合宽度”恢复；Alt / Option + 滚轮继续缩放，放大后可拖动平移。显示缩放不改变导出像素。

用户提供的一组匿名长图样本，从 3000 × 8364 / 2,796,430 字节变为 516 × 1440 / 86,184 字节，收到的 JPEG 量化表与 libjpeg 质量 80 的表一致。它说明这一组长图经过了明显的整体缩小，不能推导出微信在所有版本和发送方式下的固定算法，更不能证明微信仅压缩横向。成品宽度预算用于由你控制本应用的输出，不模拟微信的全部处理规则。

调整成品宽度与 JPEG 品质后，查看实际像素、文件大小及编码预览。保留更多成品像素、减少额外采样有助于保留细节，但预先压缩无法保证绕过再次压缩，更不会恢复已失去的细节。“所见即所得”指本应用导出的文件；微信再次处理后的效果仍需要实际发送验证。需要更高细节时，选择较大的宽度，或另行发送照片原文件。

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

Enable proactive share compression and control the **final image width**, rather than limiting a tall collage by its height. Width defaults to 1,440 px, with a 2,560-pixel preset and a custom range of 480–8,000 px; the result never enlarges beyond the uncompressed export width. The entire layout scales proportionally and keeps its full height, without stretching photographs or cutting off vertical content. For example, a 3000 × 8364 layout at 1440-pixel width becomes approximately 1440 × 4015; a 1440-pixel maximum-edge budget would instead produce only 516 × 1440, leaving fewer pixels per photograph.

Originals are drawn one at a time directly to the final-sized canvas with high-quality image smoothing, followed by one final JPEG encoding. There is no preliminary per-photo resize. The preview displays that encoded file after decoding, and saving writes the same bytes. Intermediate processing stays in memory and does not overwrite originals or create copies in photo folders. Layout or composition changes regenerate the result before export.

Resource limits remain 24,000 pixels per side and 48 megapixels in total. Very long layouts can therefore produce a width below the requested budget; the interface reports the actual dimensions and the limiting reason. Safety scaling still preserves the complete layout and its proportions. Width compression does not change a template's existing cell cropping: choose contain or the original-ratio poster to keep an individual photograph complete.

Final width (px) controls the exported file, and JPEG quality defaults to 90%. Share previews start in Fit to width, so ordinary scrolling within the preview browses the full-height image instead of squeezing the whole poster into one screen. Use Fit to window for an overview and Fit to width to return. Alt / Option + scroll still zooms, with dragging to pan an enlarged view. Display zoom does not change export pixels.

One anonymous user-supplied long-image pair changed from 3000 × 8364 / 2,796,430 bytes to 516 × 1440 / 86,184 bytes. Its received JPEG quantization tables match libjpeg quality 80. This pair demonstrates substantial overall downscaling, but establishes neither a universal WeChat algorithm nor a rule that WeChat compresses only horizontally. The width budget gives you control over this app's output rather than simulating all WeChat processing.

Adjust final width and JPEG quality, inspect the actual dimensions and file size, and preview the encoded result. Retaining more output pixels and avoiding an extra resize can preserve more detail, but precompression cannot guarantee avoidance of further processing or restore lost detail. WYSIWYG refers to this app's exported file; subsequent processing by WeChat still requires a real send test. Choose a larger width or send original files separately when more detail is needed.

### GIF and meme creation

Select photographs and open GIF / meme creation. Scroll through the filmstrip and drag thumbnails to reorder. The current and neighboring frames remain prominent while distant frames fade. Configure output scale, color quality, frame timing, and looping, then add text and speech bubbles per frame. Preview the actual encoded GIF and save the same result, or export a static meme frame.

GIF uses a limited color palette, so photographic gradients can show banding. Smaller dimensions, fewer frames, and reduced palette quality can lower file size. Encoding offers progress, cancellation, and explicit resource limits.

### Fullscreen details

Choose Fullscreen or press F in photo details. Option / Alt zoom, dragging, and adjacent-photo navigation remain available. Escape exits fullscreen first; a second Escape closes details. Closing details restores the prior window state.
