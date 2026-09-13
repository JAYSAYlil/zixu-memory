param(
    [string]$JavaHome = $env:JAVA_HOME,
    [string]$AndroidSdk = $env:ANDROID_HOME,
    [string]$GradleHome = '',
    [string]$NdkVersion = '',
    [switch]$UseWindowsTrustStore
)
$ErrorActionPreference = 'Stop'
$projectDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (!$JavaHome -or !(Test-Path -LiteralPath (Join-Path $JavaHome 'bin\java.exe'))) { throw '请指定 JDK 17 的 -JavaHome 或 JAVA_HOME。' }
if (!$AndroidSdk -or !(Test-Path -LiteralPath $AndroidSdk)) { throw '请指定 -AndroidSdk 或 ANDROID_HOME。' }
$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $AndroidSdk
$env:Path = "$JavaHome\bin;$env:Path"
$env:CI = '1'
$env:NODE_ENV = 'production'
$env:JAVA_TOOL_OPTIONS = '-Dfile.encoding=UTF-8'
if ($UseWindowsTrustStore) { $env:JAVA_TOOL_OPTIONS += ' -Djavax.net.ssl.trustStoreType=Windows-ROOT -Djavax.net.ssl.trustStore=NONE' }
Push-Location -LiteralPath $projectDirectory
try {
    & node scripts/prepare-native.cjs
    if ($LASTEXITCODE -ne 0) { throw '构建准备失败。' }
    & node node_modules/expo/bin/cli prebuild --platform android --no-install
    if ($LASTEXITCODE -ne 0) { throw '原生项目生成失败。' }
    $arguments = @('-p', 'android', 'assembleRelease', '-PreactNativeArchitectures=arm64-v8a', '--console=plain', '--max-workers=4')
    if ($NdkVersion) { $arguments += "-PzixuNdkVersion=$NdkVersion" }
    if ($GradleHome) {
        $launcher = Get-ChildItem -LiteralPath (Join-Path $GradleHome 'lib') -Filter 'gradle-gradle-cli-main-*.jar' | Select-Object -First 1
        if (!$launcher) { throw 'GradleHome 中没有找到 Gradle 9 的启动文件。' }
        & "$JavaHome\bin\java.exe" -jar $launcher.FullName @arguments
    } else {
        & "$JavaHome\bin\java.exe" -classpath android/gradle/wrapper/gradle-wrapper.jar org.gradle.wrapper.GradleWrapperMain @arguments
    }
    if ($LASTEXITCODE -ne 0) { throw 'APK 构建失败，请检查上面的错误。' }
    $outputDirectory = Join-Path $projectDirectory '..\artifacts'
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
    Copy-Item -LiteralPath android/app/build/outputs/apk/release/app-release.apk -Destination (Join-Path $outputDirectory 'zixu-0.5.0-arm64.apk')
    Write-Output "APK 已生成：$outputDirectory\zixu-0.5.0-arm64.apk"
} finally { Pop-Location }
