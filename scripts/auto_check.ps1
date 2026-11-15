# =============================================================================
# KIỂM TRA SỨC KHỎE DỰ ÁN (AI chạy cuối mỗi việc). Chỉ ĐỌC, không sửa gì.
#   ./scripts/auto_check.ps1
# Mã thoát 1 nếu có lỗi NẶNG (🔴). Cảnh báo vàng (🟡) không chặn.
# =============================================================================
$ErrorActionPreference = "Continue"
$Root = (Get-Location).Path
$Exclude = @("node_modules", ".git", "dist", "build", "_BACKUPS_LOCAL", ".next", ".vercel", ".wrangler", "auto_kit", "auto_memory", ".cursor", "coverage")
$Red = 0; $Yellow = 0

function Get-ScopedFiles($dir) {
    foreach ($item in (Get-ChildItem -LiteralPath $dir -Force -ErrorAction SilentlyContinue)) {
        if ($item.PSIsContainer) {
            if ($Exclude -notcontains $item.Name) { Get-ScopedFiles $item.FullName }
        } else { $item }
    }
}
$All = @(Get-ScopedFiles $Root)
$Code = $All | Where-Object { $_.Extension -in ".js", ".jsx", ".ts", ".tsx", ".html", ".mjs" }

# 1. File quá 300 dòng (File mới hoặc file cũ bị nhồi thêm >25 dòng = 🔴; file cũ chưa đụng = 🟡)
$TouchedFiles = @()
if ((Get-Command git -ErrorAction SilentlyContinue) -and (Test-Path (Join-Path $Root ".git"))) {
    $TouchedFiles = @(git diff --name-only HEAD 2>$null) + @(git ls-files --others --exclude-standard 2>$null)
}
foreach ($f in $Code) {
    $n = @(Get-Content $f.FullName -ErrorAction SilentlyContinue).Count
    if ($n -gt 300) {
        $rel = $f.FullName.Substring($Root.Length + 1)
        $relSlash = $rel.Replace("\", "/")
        if ($TouchedFiles -contains $relSlash -or $TouchedFiles -contains $rel) {
            Write-Host "🔴 File đang sửa vượt 300 dòng ($n): $rel -> tách phần code mới ra file riêng (<250 dòng) rồi import vào!" -ForegroundColor Red; $Red++
        } else {
            $Yellow++
        }
    }
}
# 2. Script vá tạm bị cấm
$All | Where-Object { $_.Name -match '^(patch|fix|revert|replace)[^\\]*\.(js|mjs|cjs)$' } | ForEach-Object {
    Write-Host "🔴 Script vá tạm bị cấm: $($_.FullName.Substring($Root.Length + 1))" -ForegroundColor Red; $Red++ }
# 3. File trùng kiểu copy/final/v2
$All | Where-Object { $_.Name -match '(?i)(copy of|_final|_v\d+|\(\d+\)|backup|_old)\.(js|jsx|ts|tsx|html)$' } | ForEach-Object {
    Write-Host "🟡 Nghi file trùng lặp: $($_.FullName.Substring($Root.Length + 1))" -ForegroundColor Yellow; $Yellow++ }
# 4. Key bí mật nằm trong code front-end
$SecretPat = 'AIza[0-9A-Za-z_\-]{35}|sk-[A-Za-z0-9]{32,}|-----BEGIN (RSA |EC )?PRIVATE KEY|GEMINI_API_KEY\s*[=:]\s*["''][^"'']{8,}|PAYMENT_WEBHOOK_SECRET\s*[=:]\s*["''][^"'']{4,}'
$Code | Where-Object { $_.FullName -notmatch '\\(functions|api)\\' } | ForEach-Object {
    if (Select-String -Path $_.FullName -Pattern $SecretPat -Quiet -ErrorAction SilentlyContinue) {
        Write-Host "🔴 Nghi lộ KHÓA BÍ MẬT trong: $($_.FullName.Substring($Root.Length + 1))" -ForegroundColor Red; $Red++ } }
# 5. .env bị theo dõi bởi Git
if ((Get-Command git -ErrorAction SilentlyContinue) -and (Test-Path (Join-Path $Root ".git"))) {
    git ls-files 2>$null | Where-Object { $_ -match '(^|/)\.env($|\.)' -and $_ -notmatch '\.example$' } | ForEach-Object {
        Write-Host "🔴 File bí mật đang nằm trong Git: $_  (git rm --cached $_ rồi ĐỔI KEY)" -ForegroundColor Red; $Red++ }
}
# 6. Rules Firestore
$Rules = Join-Path $Root "firestore.rules"
if (Test-Path $Rules) {
    $r = Get-Content $Rules -Raw
    if ($r -match 'allow\s+read\s*,\s*write\s*:\s*if\s+true') { Write-Host "🔴 firestore.rules đang mở hoàn toàn (if true)" -ForegroundColor Red; $Red++ }
    $state = if (Test-Path (Join-Path $Root "STATE.md")) { Get-Content (Join-Path $Root "STATE.md") -Raw } else { "" }
    if ($state -match 'PRODUCTION' -and $state -notmatch 'PROTOTYPE \(cho' -and $r -match 'RULES CHO APP ĐANG TEST') {
        Write-Host "🔴 STATE.md ghi PRODUCTION nhưng firestore.rules vẫn là bản prototype" -ForegroundColor Red; $Red++ }
}
# 7. Bộ nhớ dự án
foreach ($m in "auto_memory\CONTEXT.md", "auto_memory\HISTORY.md", "STATE.md") {
    if (-not (Test-Path (Join-Path $Root $m))) { Write-Host "🟡 Thiếu $m (chạy manual_khoi_tao.ps1 hoặc auto_log.ps1)" -ForegroundColor Yellow; $Yellow++ } }
# 8. Mất đồng bộ MAP: file code mới hơn MAP
$MapFile = Join-Path $Root "auto_memory\MAP.md"
if (Test-Path $MapFile) {
    $mt = (Get-Item $MapFile).LastWriteTime
    $newer = $Code | Where-Object { $_.LastWriteTime -gt $mt.AddMinutes(1) } | Select-Object -First 1
    if ($newer) { Write-Host "🟡 MAP.md cũ hơn code -> chạy ./scripts/auto_map.ps1 (hoặc auto_log.ps1)" -ForegroundColor Yellow; $Yellow++ }
}

if ($Red -eq 0) { Write-Host "✅ Kiểm tra xong: không có lỗi nặng ($Yellow cảnh báo)." -ForegroundColor Green; exit 0 }
else { Write-Host "❌ Có $Red lỗi NẶNG cần sửa trước khi báo xong." -ForegroundColor Red; exit 1 }
