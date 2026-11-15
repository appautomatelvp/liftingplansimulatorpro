# =============================================================================
# BACKUP KÉP: ZIP (HHmmddMMyyyy) + NHÁNH GIT NHÁP — chạy TRƯỚC khi nhờ AI làm việc lớn
#   ./scripts/auto_backup.ps1 -FeatureName "ten-tinh-nang" -Mode test
#   ./scripts/auto_backup.ps1 -FeatureName "chot-v1" -Mode STABLE
#   Thêm -ExtraCopyDir "E:\BACKUP" để copy luôn zip ra ổ ngoài/Drive.
# Không bao giờ commit thẳng lên main: nếu đang ở main sẽ tách nhánh nháp TRƯỚC.
# =============================================================================
param (
    [string]$FeatureName = "update",
    [string]$Mode = "test",
    [string]$ExtraCopyDir = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Get-Location).Path
$ProjectName = Split-Path $ProjectRoot -Leaf
$Stamp = Get-Date -Format "HHmmddMMyyyy"
$CleanFeature = $FeatureName -replace '[^a-zA-Z0-9_-]', '-'
$CleanMode = if ($Mode -match "STABLE") { "STABLE VERSION" } else { "test" }

$BackupDir = Join-Path $ProjectRoot "_BACKUPS_LOCAL"
if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir | Out-Null }
$ZipPath = Join-Path $BackupDir "${ProjectName}-${Stamp} (${CleanMode} - ${CleanFeature}).zip"

Write-Host "[1/3] Nén backup..." -ForegroundColor Yellow
# Dùng .NET (không lỗi với file khoá/đường dẫn dài như Compress-Archive); bỏ thư mục nặng.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$Exclude = @("node_modules", ".git", "dist", "build", "_BACKUPS_LOCAL", ".next", ".vercel", ".wrangler", "playwright-report", "test-results")
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
$zip = [System.IO.Compression.ZipFile]::Open($ZipPath, "Create")
try {
    Get-ChildItem -Path $ProjectRoot -Recurse -File -Force | Where-Object {
        $parts = $_.FullName.Substring($ProjectRoot.Length + 1).Split("\")
        -not ($parts | Where-Object { $Exclude -contains $_ })
    } | ForEach-Object {
        $rel = $_.FullName.Substring($ProjectRoot.Length + 1)
        try {
            [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel, "Optimal")
        } catch { Write-Host "  (bỏ qua file đang bị khoá: $rel)" -ForegroundColor DarkGray }
    }
} finally { $zip.Dispose() }
Write-Host "  -> $ZipPath ($([math]::Round((Get-Item $ZipPath).Length/1KB,1)) KB)" -ForegroundColor Green

if ($ExtraCopyDir) {
    if (-not (Test-Path $ExtraCopyDir)) { New-Item -ItemType Directory -Path $ExtraCopyDir -Force | Out-Null }
    Copy-Item $ZipPath $ExtraCopyDir -Force
    Write-Host "  -> Đã copy thêm ra: $ExtraCopyDir" -ForegroundColor Green
}

Write-Host "[2/3] Git..." -ForegroundColor Yellow
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Host "Chưa cài Git — chỉ có bản ZIP." -ForegroundColor Red; exit 0 }
if (-not (Test-Path (Join-Path $ProjectRoot ".gitignore"))) {
    Write-Host "DỪNG phần Git: thiếu .gitignore (sợ commit nhầm file key). ZIP vẫn đã lưu xong." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path (Join-Path $ProjectRoot ".git"))) { git init -b main | Out-Null }

$Current = (git branch --show-current)
$Branch = "draft/${CleanFeature}-${Stamp}"
if ($Current -eq "main" -or [string]::IsNullOrEmpty($Current)) {
    # Tách nhánh nháp TRƯỚC (mang theo thay đổi chưa commit), rồi mới commit -> main không bị đụng
    git checkout -b $Branch
}
git add -A
git commit -m "Snapshot ${Stamp} (${CleanMode}): truoc khi lam ${CleanFeature}" 2>$null | Out-Null

Write-Host "[3/3] Xong." -ForegroundColor Yellow
Write-Host "HOÀN TẤT. Đang đứng ở nhánh: $(git branch --show-current)  (main được giữ nguyên)" -ForegroundColor Green
Write-Host "Làm xong & chạy ổn -> ./scripts/manual_chot_ban.ps1 để gộp về main." -ForegroundColor Cyan
Write-Host "Làm hỏng muốn bỏ   -> git checkout main  (nhánh nháp vẫn còn, không mất gì)." -ForegroundColor Cyan
