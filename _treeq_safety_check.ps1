# TreeQ OneDrive vs Canonical safety-check + delete script
# Generated 2026-05-14 by Claude in Cowork mode

$ErrorActionPreference = 'Continue'

$onedrive  = 'C:\Users\camer\OneDrive\Documents\Claude\Projects\TreeQ'
$canonical = 'C:\Users\camer\Projects\Claude Cowork\TreeQ'
$report    = 'C:\Users\camer\Projects\Claude Cowork\TreeQ\_treeq_diff_report.txt'

# Files / dirs we don't care about for the comparison (Windows-sync metadata, dev deps, transient writes)
$ignoreNames    = @('desktop.ini', 'Thumbs.db', '.DS_Store')
$ignoreDirs     = @('node_modules', '.git', '.next', 'dist', 'build')
$ignorePatterns = @('.write_test_*', '*.gdoc', '*.lnk')

function Get-RelevantFiles($root) {
  if (-not (Test-Path -LiteralPath $root)) { return @() }
  Get-ChildItem -LiteralPath $root -Recurse -File -Force -ErrorAction SilentlyContinue |
    Where-Object {
      $rel = $_.FullName.Substring($root.Length).TrimStart('\')
      $parts = $rel.Split('\')
      $skip = $false
      foreach ($p in $parts) { if ($ignoreDirs -contains $p) { $skip = $true; break } }
      if ($skip) { return $false }
      if ($ignoreNames -contains $_.Name) { return $false }
      foreach ($pat in $ignorePatterns) { if ($_.Name -like $pat) { return $false } }
      return $true
    }
}

function Get-FileMap($root) {
  $map = @{}
  foreach ($f in Get-RelevantFiles $root) {
    $rel = $f.FullName.Substring($root.Length).TrimStart('\')
    try {
      $hash = (Get-FileHash -LiteralPath $f.FullName -Algorithm MD5 -ErrorAction Stop).Hash
    } catch {
      $hash = 'HASH_ERROR'
    }
    $map[$rel] = [pscustomobject]@{
      Path = $rel
      Size = $f.Length
      Hash = $hash
    }
  }
  return $map
}

$out = New-Object System.Text.StringBuilder
$null = $out.AppendLine("TreeQ OneDrive -> Canonical safety check")
$null = $out.AppendLine("Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$null = $out.AppendLine("OneDrive  : $onedrive")
$null = $out.AppendLine("Canonical : $canonical")
$null = $out.AppendLine(("=" * 70))

if (-not (Test-Path -LiteralPath $onedrive)) {
  $null = $out.AppendLine("OneDrive folder does not exist. Nothing to delete.")
  $out.ToString() | Out-File -LiteralPath $report -Encoding UTF8
  exit 0
}
if (-not (Test-Path -LiteralPath $canonical)) {
  $null = $out.AppendLine("CANONICAL folder missing! Aborting.")
  $out.ToString() | Out-File -LiteralPath $report -Encoding UTF8
  exit 1
}

$null = $out.AppendLine("Hashing OneDrive...")
$od = Get-FileMap $onedrive
$null = $out.AppendLine("  -> $($od.Count) relevant files")

$null = $out.AppendLine("Hashing Canonical...")
$cn = Get-FileMap $canonical
$null = $out.AppendLine("  -> $($cn.Count) relevant files")
$null = $out.AppendLine(("=" * 70))

$onlyInOnedrive = @()
$diffHash       = @()
$matched        = 0

foreach ($key in $od.Keys) {
  if (-not $cn.ContainsKey($key)) {
    $onlyInOnedrive += $od[$key]
  } elseif ($cn[$key].Hash -ne $od[$key].Hash) {
    $diffHash += [pscustomobject]@{
      Path        = $key
      OneDriveSize= $od[$key].Size
      CanonicalSize= $cn[$key].Size
      OneDriveHash= $od[$key].Hash
      CanonicalHash= $cn[$key].Hash
    }
  } else {
    $matched++
  }
}

$null = $out.AppendLine("RESULTS")
$null = $out.AppendLine("  Matched (identical hash):              $matched")
$null = $out.AppendLine("  OneDrive-only (would be lost):         $($onlyInOnedrive.Count)")
$null = $out.AppendLine("  Hash differs (OneDrive may be newer):  $($diffHash.Count)")
$null = $out.AppendLine(("=" * 70))

if ($onlyInOnedrive.Count -gt 0) {
  $null = $out.AppendLine("`nFILES ONLY IN ONEDRIVE (would be lost on delete):")
  foreach ($f in $onlyInOnedrive | Sort-Object Path) {
    $null = $out.AppendLine("  + $($f.Path)  ($($f.Size) bytes)")
  }
}

if ($diffHash.Count -gt 0) {
  $null = $out.AppendLine("`nFILES WITH DIFFERENT CONTENT (one folder has divergent version):")
  foreach ($f in $diffHash | Sort-Object Path) {
    $null = $out.AppendLine("  ~ $($f.Path)")
    $null = $out.AppendLine("      OneDrive : $($f.OneDriveSize) bytes  $($f.OneDriveHash)")
    $null = $out.AppendLine("      Canonical: $($f.CanonicalSize) bytes  $($f.CanonicalHash)")
  }
}

$null = $out.AppendLine(("=" * 70))

$clean = ($onlyInOnedrive.Count -eq 0) -and ($diffHash.Count -eq 0)

if ($clean) {
  $null = $out.AppendLine("DECISION: All OneDrive files are present and identical in canonical.")
  $null = $out.AppendLine("PROCEEDING WITH DELETE of: $onedrive")
  try {
    Remove-Item -LiteralPath $onedrive -Recurse -Force -ErrorAction Stop
    if (Test-Path -LiteralPath $onedrive) {
      $null = $out.AppendLine("STATUS: DELETE INCOMPLETE - folder still exists. Some files may be locked.")
    } else {
      $null = $out.AppendLine("STATUS: DELETED")
    }
  } catch {
    $null = $out.AppendLine("STATUS: DELETE FAILED - $($_.Exception.Message)")
  }
} else {
  $null = $out.AppendLine("DECISION: NOT SAFE to delete. Manual review required.")
  $null = $out.AppendLine("STATUS: HALTED - no destructive action taken.")
}

$out.ToString() | Out-File -LiteralPath $report -Encoding UTF8
Write-Host "Done. Report written to $report"
