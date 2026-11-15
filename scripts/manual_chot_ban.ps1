# =============================================================================
# CHỐT TÍNH NĂNG: commit nhánh nháp -> gộp về main -> gắn tag "stable-..."
#   ./scripts/manual_chot_ban.ps1 -Message "Them bang luong"
# Chỉ chạy khi: đã test local, F12 sạch lỗi đỏ, build OK.
# Script KHÔNG push và KHÔNG deploy — bước đó founder tự quyết.
# =============================================================================
param ([string]$Message = "Chot tinh nang")

$ErrorActionPreference = "Stop"
$Branch = (git branch --show-current)
if ($Branch -eq "main") {
    Write-Host "Đang ở main rồi. Muốn tạo tag cho bản hiện tại thì chạy: git tag stable-$(Get-Date -Format 'yyyyMMdd-HHmm')" -ForegroundColor Yellow
    exit 0
}

git add -A
git commit -m $Message 2>$null | Out-Null

git checkout main
git merge --no-ff $Branch -m "Gop $Branch : $Message"
if ($LASTEXITCODE -ne 0) {
    Write-Host "XUNG ĐỘT khi gộp. Đừng tự sửa lung tung: git merge --abort rồi hỏi AI/CTO." -ForegroundColor Red
    exit 1
}

$Tag = "stable-$(Get-Date -Format 'yyyyMMdd-HHmm')"
git tag $Tag
Write-Host "XONG. main đã có tính năng mới, gắn tag: $Tag" -ForegroundColor Green
Write-Host "Quay lại bản này bất cứ lúc nào: git checkout $Tag" -ForegroundColor Cyan
Write-Host "Muốn đưa lên mạng: git push origin main (tự tay làm)." -ForegroundColor Cyan
