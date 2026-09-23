# 自叙 0.8.1

## 本次更新

- `importSummary` 通过记录编号索引比较冲突，避免逐条扫描本机记录；范围筛选将 ID 列表转为集合。
- 修复 8 套既有网页冒烟脚本的首次引导和过时选择器问题；保留真实首次引导验收。
- 不改页面布局、功能位置、主题、录音工具栏或依赖。

## 成品

ARM64 APK：27,291,977 字节，versionName `0.8.1`、versionCode `31`。沿用 0.8.0 的 Expo 预览签名。

SHA-256：`FE493CC6F1C08008DCE192A697B19303681532799EB7C160964F5E239712B017`

## 验证

- `npx tsc --noEmit` 通过；核心测试 40 项通过；11 套网页回归通过。
- `npx expo export --platform web` 成功；Android ARM64 Release 构建成功，package 为 `app.zixu.memory`，minSdk 24、targetSdk 36。
- 按相对路径同步并校验 55 个构建文件。APK 内 `assets/index.android.bundle` 的 SHA-256 与本次构建输出一致；源码映射中 23 个项目模块与构建源文件一致，含本次 Map/Set 修改。
- APK 签名证书 SHA-256 为 `fac61745…33b9c`，与 0.8.0 相同。
- 未进行真机安装验收；没有推送或发布。
