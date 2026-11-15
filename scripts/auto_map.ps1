# =============================================================================
# SINH BẢN ĐỒ DỰ ÁN: auto_memory/MAP.md  (cây file + số dòng + mục đích + file LOCKED)
#   ./scripts/auto_map.ps1
# AI chạy cuối mỗi lần thay đổi (auto_log.ps1 tự gọi). KHÔNG sửa MAP.md bằng tay.
# Mục đích file lấy từ dòng comment ĐẦU TIÊN, ví dụ:  // @purpose: Tính tổng lương
# =============================================================================
$ErrorActionPreference = "Continue"
$Root = (Get-Location).Path.TrimEnd('\')

# Chốt chặn an toàn: không bao giờ quét thư mục hệ thống / ổ đĩa gốc
$BlockedRoots = @(
    $env:USERPROFILE.TrimEnd('\'),
    $env:SystemRoot.TrimEnd('\'),
    "C:", "D:", "E:",
    "D:\APP PROJECT",
    "D:\APP PROJECT\PHUONG PROJECT",
    "D:\APP PROJECT\CMIT"
)
if ($BlockedRoots -contains $Root) {
    Write-Host "DỪNG auto_map: '$Root' là thư mục hệ thống/thư mục cha, không phải thư mục dự án!" -ForegroundColor Red
    exit 1
}

$AiDir = Join-Path $Root "auto_memory"
if (-not (Test-Path $AiDir)) { New-Item -ItemType Directory -Path $AiDir | Out-Null }

$ExcludeDirs = @(
    "node_modules", ".git", "dist", "build", "_BACKUPS_LOCAL", ".next", ".vercel",
    ".wrangler", "playwright-report", "test-results", "auto_kit", "auto_memory",
    ".cursor", ".agents", "coverage", "AppData", ".github", ".vscode"
)
$CodeExt = @(".js", ".jsx", ".ts", ".tsx", ".html", ".css", ".vue", ".svelte", ".mjs", ".json", ".ps1", ".md", ".rules")
$Skip = @("package-lock.json", "GEMINI.md", "AGENTS.md", "STATE.md", "SPEC.md", "LENH_AT.md")

function Get-ProjectFiles($dir) {
    foreach ($item in (Get-ChildItem -LiteralPath $dir -Force -ErrorAction SilentlyContinue)) {
        if ($item.PSIsContainer) {
            if ($ExcludeDirs -notcontains $item.Name) { Get-ProjectFiles $item.FullName }
        } else {
            if (($CodeExt -contains $item.Extension.ToLower()) -and ($Skip -notcontains $item.Name)) { $item }
        }
    }
}
$Files = @(Get-ProjectFiles $Root) | Sort-Object FullName

function Get-Purpose($file) {
    if ($file.Extension -in ".json", ".md", ".rules") { return "" }
    try {
        $head = Get-Content $file.FullName -TotalCount 6 -Encoding UTF8 -ErrorAction Stop
        foreach ($l in $head) {
            if ($l -match '^\s*(//|#|/\*+|<!--)\s*@purpose:?\s*(.+?)\s*(\*/|-->)?\s*$') { return $Matches[2] }
        }
        foreach ($l in $head) {
            if ($l -match '^\s*(//|#|/\*+|<!--)\s*(.+?)\s*(\*/|-->)?\s*$' -and $Matches[2] -notmatch '^[=\-\*]+$') { return $Matches[2] }
        }
    } catch {}
    return ""
}

$Rows = New-Object System.Collections.Generic.List[string]
$Locked = New-Object System.Collections.Generic.List[string]
$Big = New-Object System.Collections.Generic.List[string]
$Total = 0
foreach ($f in $Files | Select-Object -First 500) {
    $rel = $f.FullName.Substring($Root.Length + 1).Replace("\", "/")
    $lines = 0
    try { $lines = @(Get-Content $f.FullName -ErrorAction Stop).Count } catch {}
    $Total += $lines
    $isLocked = $false
    if ($f.Extension -notin ".md", ".ps1") {
        try { $isLocked = [bool]((Get-Content $f.FullName -TotalCount 5 -Encoding UTF8 -ErrorAction Stop) -match '\[LOCKED\]') } catch {}
    }
    $flag = ""
    if ($isLocked) { $flag += " 🔒"; $Locked.Add($rel) }
    if ($f.Extension -in ".js", ".jsx", ".ts", ".tsx", ".html" -and $lines -gt 300) { $flag += " ⚠️>300"; $Big.Add("$rel ($lines dòng)") }
    elseif ($f.Extension -in ".js", ".jsx", ".ts", ".tsx", ".html" -and $lines -gt 250) { $flag += " ⚠️>250" }
    $Rows.Add("| ``$rel`` | $lines | $(Get-Purpose $f)$flag |")
}

$Branch = ""; $LastCommit = ""
if (Get-Command git -ErrorAction SilentlyContinue) {
    if (Test-Path (Join-Path $Root ".git")) {
        $Branch = (git branch --show-current 2>$null)
        $LastCommit = (git log -1 --pretty="%h %s (%ar)" 2>$null)
    }
}

$Out = New-Object System.Collections.Generic.List[string]
$Out.Add("# BẢN ĐỒ DỰ ÁN (TỰ SINH — KHÔNG SỬA TAY)")
$Out.Add("Cập nhật: $(Get-Date -Format 'yyyy-MM-dd HH:mm') | Nhánh: $Branch | Commit cuối: $LastCommit")
$Out.Add("Tổng: $($Rows.Count) file, $Total dòng. 🔒 = file [LOCKED]. ⚠️ = file sắp/đã quá 300 dòng.")
$Out.Add("")
if ($Big.Count -gt 0) { $Out.Add("## ⚠️ Cần tách (quá 300 dòng)"); $Big | ForEach-Object { $Out.Add("- $_") }; $Out.Add("") }
if ($Locked.Count -gt 0) { $Out.Add("## 🔒 File đã khóa [LOCKED]"); $Locked | ForEach-Object { $Out.Add("- $_") }; $Out.Add("") }
$Out.Add("## Danh sách file")
$Out.Add("| File | Dòng | Mục đích |")
$Out.Add("|---|---|---|")
$Rows | ForEach-Object { $Out.Add($_) }

[IO.File]::WriteAllLines((Join-Path $AiDir "MAP.md"), $Out, (New-Object Text.UTF8Encoding($false)))
Write-Host "Đã cập nhật auto_memory/MAP.md ($($Rows.Count) file, $Total dòng)" -ForegroundColor Green
