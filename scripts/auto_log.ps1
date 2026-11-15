# =============================================================================
# GHI NHẬT KÝ THAY ĐỔI vào auto_memory/HISTORY.md (mới nhất ở trên) rồi cập nhật MAP.
#   ./scripts/auto_log.ps1 -Type feat -Summary "Them man hinh nhap luong vi can tinh tong" -Files "src/utils/payroll.js,src/App.jsx"
# Type: feat | fix | refactor | docs | chore
# =============================================================================
param (
    [ValidateSet("feat", "fix", "refactor", "docs", "chore")]
    [string]$Type = "chore",
    [Parameter(Mandatory = $true)][string]$Summary,
    [string]$Files = ""
)
$ErrorActionPreference = "Continue"
$Root = (Get-Location).Path
$AiDir = Join-Path $Root "auto_memory"
if (-not (Test-Path $AiDir)) { New-Item -ItemType Directory -Path $AiDir | Out-Null }
$Hist = Join-Path $AiDir "HISTORY.md"
if (-not (Test-Path $Hist)) {
    "# Nhật ký thay đổi (mới nhất Ở TRÊN CÙNG). Ghi bằng scripts/auto_log.ps1, không sửa tay.`r`n<!-- LOG_START -->`r`n" | Out-File $Hist -Encoding utf8
}

$Branch = ""; $Commit = ""
if ((Get-Command git -ErrorAction SilentlyContinue) -and (Test-Path (Join-Path $Root ".git"))) {
    $Branch = (git branch --show-current 2>$null); $Commit = (git rev-parse --short HEAD 2>$null)
}
$Entry = @("", "## $(Get-Date -Format 'yyyy-MM-dd HH:mm') [$Type] $Summary", "- Nhánh: $Branch | Commit trước đó: $Commit")
if ($Files) { $Entry += "- File: $Files" }

$Lines = [IO.File]::ReadAllLines($Hist, [Text.Encoding]::UTF8)
$idx = [Array]::IndexOf($Lines, "<!-- LOG_START -->")
if ($idx -lt 0) { $Lines = $Lines + "<!-- LOG_START -->"; $idx = $Lines.Length - 1 }
$Tail = if ($idx -lt $Lines.Length - 1) { @($Lines[($idx + 1)..($Lines.Length - 1)]) } else { @() }
$New = @($Lines[0..$idx]) + $Entry + $Tail
[IO.File]::WriteAllLines($Hist, $New, (New-Object Text.UTF8Encoding($false)))
Write-Host "Đã ghi HISTORY: [$Type] $Summary" -ForegroundColor Green

$Map = Join-Path $PSScriptRoot "auto_map.ps1"
if (Test-Path $Map) { & $Map }
