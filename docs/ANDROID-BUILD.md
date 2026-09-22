# 安卓构建说明

## 建议环境

- 源码、JDK、Gradle 均位于纯英文路径。仅使用目录链接仍可能被 Node 解析回中文真实路径，因此本次使用独立的英文构建副本。
- Node 24、JDK 17、Android SDK 36、Gradle 9.3.1。
- 默认 NDK 为 Expo 指定版本；本机使用已经安装的 NDK 28.2.13676358，通过项目参数覆盖。

```powershell
npm ci
.\scripts\build-android.ps1 `
  -JavaHome 'C:\tools\jdk-17' `
  -AndroidSdk "$env:LOCALAPPDATA\Android\Sdk" `
  -GradleHome 'C:\tools\gradle-9.3.1' `
  -NdkVersion '28.2.13676358'
```

若系统使用自己的受信任根证书，可增加 `-UseWindowsTrustStore`。这只让当前 Java 进程使用 Windows 已有信任库，不关闭 TLS 验证，不修改系统证书。

## 本机遇到的环境问题

1. Gradle 下载发生 HTTP 502，通过官方分发地址重试完成下载。
2. JDK 默认信任库无法识别本机网络证书，改为 Windows 信任库。
3. Windows cmd AutoRun 欢迎画面污染 Expo autolinking 的 JSON。`prepare-native.cjs` 对本项目安装的构建助手加入 `cmd /d /c`，不改系统 AutoRun 设置。
4. 中文 JDK 路径在 AGP 生成的批处理里被错误解码。最终构建副本和工具链都使用英文真实路径。
5. `scripts/build-android.ps1` 与 `scripts/sync-build.ps1` 含中文字符串，必须以 **UTF-8 带 BOM** 保存：Windows PowerShell 5.1 对无 BOM 的 .ps1 按系统 ANSI 代码页读取，会把中文串读坏导致解析失败，或在 `ConvertFrom-Json` 读 `app.json` 时抛错（PowerShell 7 默认按 UTF-8 读取，所以此前未暴露）。编辑器保存时请勿去掉 BOM。

## 发布边界

`assembleRelease` 构建的预览包包含 JS bundle，不需要 Metro 开发服务器，但使用 Expo 模板的开发签名。正式上架必须更换为项目自己的签名与发布配置。本项目没有自动创建 Expo 云项目、GitHub 仓库或商店发布。
