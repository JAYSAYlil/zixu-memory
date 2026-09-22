param([Parameter(Mandatory=$true)][string]$BuildDirectory)
$ErrorActionPreference = 'Stop'
$source = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$target = [IO.Path]::GetFullPath($BuildDirectory)
if ($target -eq $source -or $target.StartsWith($source + [IO.Path]::DirectorySeparatorChar)) { throw '构建副本必须位于源码目录以外。' }
$files = @()
foreach ($folder in @('src','assets','plugins','scripts')) { $files += Get-ChildItem -LiteralPath (Join-Path $source $folder) -File -Recurse }
foreach ($name in @('App.tsx','index.ts','app.json','package.json','package-lock.json','tsconfig.json')) { $files += Get-Item -LiteralPath (Join-Path $source $name) }
$manifest = @()
foreach ($file in $files) {
  $relative = $file.FullName.Substring($source.Length + 1)
  $destination = Join-Path $target $relative
  New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
  Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
  $hash = (Get-FileHash -LiteralPath $file.FullName).Hash
  if ($hash -ne (Get-FileHash -LiteralPath $destination).Hash) { throw "源码同步校验失败：$relative" }
  $manifest += @{ file=$relative; sha256=$hash }
}
$manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $target 'source-manifest.json') -Encoding utf8
Write-Output "已核验 $($manifest.Count) 个构建文件。"
