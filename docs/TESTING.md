# 0.8.0 验证记录

- TypeScript 类型检查通过。
- 39 项核心测试通过，覆盖数据迁移、备份、检索、来源变更、请求取消，以及新增的主题色调色板契约。
- Android ARM64 Release 构建通过，包名 app.zixu.memory，versionCode 30，targetSdk 36，仅 arm64-v8a。
- 构建副本按文件相对路径同步并逐个核验 SHA-256，共 54 个文件；Metro 源码映射中 24 个应用模块与工作区源码一致（含新增 `src/palette.ts`）；APK 内 `index.android.bundle` 哈希与该次构建产物一致；签名证书与 0.7.0 相同，可覆盖安装。
- 主题色、布局与增强三套网页回归通过。网页预览不能替代 Android 真机验收。
- 未开展跨设备真机测试，也未验收覆盖安装后的偏好保留。

## 仍需验证

真实软键盘与系统大字体（含色块行在 320 宽度真机上的排布）、录音中断、权限拒绝、跨设备恢复、真实供应商计费调用和长期大数据量性能。主题色在安卓端的实际渲染，以及跟随系统在厂商 ROM 上的表现。

## 已知失效的网页脚本

`mobile/scripts/` 中 smoke、ai-smoke、interaction-smoke、attachments-smoke、values-smoke、self-smoke、draft-failure-smoke、reliability-smoke 这八套脚本自 0.7.0 加入首次引导后未同步更新，在全新浏览器配置下会失败：多数在第一步点击就被引导弹层挡住而超时（smoke 卡在「先看看示例」，ai-smoke 卡在编辑器「保存」），values-smoke 表现为脚本自检失败。已把工作树还原成未改动的 0.7.0 重新导出网页包后跑同一批脚本，失败点与错误类型完全相同，确认与 0.8.0 改动无关。当前可用的网页回归是 layout-smoke、enhancements-smoke 与 accent-smoke。

测试脚本使用虚构数据和模拟接口，不应放入真实用户记忆或 API Key。
