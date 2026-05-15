# Test-SafeWrite.ps1 — PowerShell equivalent of test_safe_write.sh.
# Writes a 30-line throwaway file with a known marker, verifies size/tail,
# then cleans up. Lets you confirm a file lands intact on disk without
# needing WSL or bash.
#
# Usage:  pwsh -File .\Test-SafeWrite.ps1
#         or, from this folder:  .\Test-SafeWrite.ps1

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$target    = Join-Path $scriptDir '_safe_write_test.tmp'
$expected  = 30
$marker    = 'END-OF-TEST-FILE-MARKER'

# Build deterministic content
$lines = @()
$lines += '# safe_write round-trip test'
$lines += "# generated $(Get-Date -Format o)"
1..27 | ForEach-Object { $lines += "line $_ — quick brown fox jumps over the lazy dog" }
$lines += $marker

# Write atomically: temp file + Move-Item
$tmp = "$target.tmp"
Set-Content -Path $tmp -Value $lines -Encoding utf8
Move-Item -Path $tmp -Destination $target -Force

# Verify
$actualLines = (Get-Content $target).Count
$lastLine    = (Get-Content $target -Tail 1)
$bytes       = (Get-Item $target).Length

Write-Host "=== $target ==="
Write-Host "lines: $actualLines (expected $expected)"
Write-Host "bytes: $bytes"
Write-Host "last line: $lastLine"

if ($lastLine -eq $marker -and $actualLines -eq $expected) {
    Write-Host "PASS — file written intact" -ForegroundColor Green
    $rc = 0
} else {
    Write-Host "FAIL — possible truncation" -ForegroundColor Red
    $rc = 1
}

Remove-Item $target -Force
Write-Host "cleanup: removed $target"
exit $rc
