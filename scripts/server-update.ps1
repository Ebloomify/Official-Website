# eBloomify 服务器代码更新脚本(在服务器上运行)
# 作用:从 GitHub 拉最新代码,只更新程序和模板,不碰 data/(后台改的内容)和 uploads/(后台传的图),
#      然后重建页面、重启后台服务。
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
New-Item -ItemType Directory -Force "C:\Temp" | Out-Null

# 1. 备份服务器配置(仓库里是开发配置,不能覆盖线上的)
Copy-Item "C:\ebloomify-app\admin\config.json" "C:\Temp\config.server.json" -Force

# 2. 下载最新代码(带随机参数防缓存)
Invoke-WebRequest -UseBasicParsing -Uri ("https://codeload.github.com/Ebloomify/Official-Website/zip/refs/heads/main?nocache=" + (Get-Random)) -OutFile "C:\Temp\site.zip"
Remove-Item "C:\Temp\site_extract" -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive "C:\Temp\site.zip" "C:\Temp\site_extract" -Force
$src = "C:\Temp\site_extract\Official-Website-main"

# 3. 更新程序代码与模板(不动 data/)
foreach ($d in @('admin', 'lib', 'scripts')) {
  Copy-Item "$src\$d" "C:\ebloomify-app\" -Recurse -Force
}
Copy-Item "$src\site\templates" "C:\ebloomify-app\site\" -Recurse -Force

# 4. 恢复线上配置
Copy-Item "C:\Temp\config.server.json" "C:\ebloomify-app\admin\config.json" -Force

# 5. 静态资源更新到 wwwroot;uploads 只补新文件,不覆盖服务器上已有的(后台传的图/视频优先)
Copy-Item "$src\site\assets" "C:\wwwroot\" -Recurse -Force
New-Item -ItemType Directory -Force "C:\wwwroot\uploads" | Out-Null
foreach ($f in Get-ChildItem "$src\site\uploads" -File -ErrorAction SilentlyContinue) {
  $dst = "C:\wwwroot\uploads\$($f.Name)"
  if (-not (Test-Path $dst)) { Copy-Item $f.FullName $dst }
}

# 6. 用服务器上的数据重建全部页面
& "C:\Program Files\nodejs\node.exe" -e "require('C:/ebloomify-app/lib/build.js').buildSite({dataDir:'C:/ebloomify-app/data',templatesDir:'C:/ebloomify-app/site/templates',outDir:'C:/wwwroot'})"

# 7. 重启后台服务
schtasks /End /TN "EbloomifyAdmin" 2>$null | Out-Null
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -notlike '*Temp*' } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 2
schtasks /Run /TN "EbloomifyAdmin" | Out-Null
Start-Sleep 5

# 8. 自检
$r = Invoke-WebRequest -UseBasicParsing "http://localhost:3000/admin" -TimeoutSec 10
Write-Output "更新完成。后台自检: HTTP $($r.StatusCode)"
