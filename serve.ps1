# =====================================================================
#  serve.ps1  -  zero-dependency local server (Windows 10/11 built-in PowerShell)
#
#  Why this exists:
#    Cloudimage 360 View sets crossOrigin="anonymous" on every image and only
#    accepts plain HTTP URLs - file://, data: and blob: never render. This
#    script serves the folder over local HTTP using .NET TcpListener: no IIS,
#    no Node, no Python, and no urlacl / admin rights required.
#
#  Routes:
#    GET    /                   -> open the configured start page
#    GET    /<path>             -> static file
#    GET    /@ping              -> {"ok":true,...}
#    POST   /@upload            -> store material in memory, return {"url":..}
#    GET    /@mat/<token>/<n>   -> serve stored material
#    DELETE /@mat               -> clear stored materials
#
#  Stop: press Ctrl+C in this window
# =====================================================================
param(
    [int]$Port = 8788,
    [string]$Root = "",
    [string]$Open = "index.html",
    [switch]$NoBrowser,
    [switch]$Local
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrEmpty($Root)) {
    $Root = Split-Path -Parent $MyInvocation.MyCommand.Definition
}
try {
    $Root = (Resolve-Path -LiteralPath $Root).Path
} catch {
    $Root = Split-Path -Parent $MyInvocation.MyCommand.Definition
}

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".mjs"  = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".txt"  = "text/plain; charset=utf-8"
    ".md"   = "text/plain; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".webp" = "image/webp"
    ".avif" = "image/avif"
    ".bmp"  = "image/bmp"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2" = "font/woff2"
}

# ---------- uploaded materials (in-memory) ----------
$materials = @{}
$uploadSeq = 0

# 本次启动的唯一标识：素材存在内存里，服务一重启就全没了，
# 前端拿它来判断「是否需要把素材重新传一遍」。
$bootId = (Get-Date -Format "yyyyMMddHHmmss") + "-" + (Get-Random -Maximum 999999)

# ---------- pick a free port ----------
$listener = $null
$startPort = $Port
for ($p = $startPort; $p -lt ($startPort + 25); $p++) {
    try {
        # 默认监听所有网卡：手机连同一 WiFi 就能打开，方便真机看效果。
        # 只在本机用可加 -Local 参数退回仅回环。
        $bindIp = if ($Local) { [System.Net.IPAddress]::Loopback } else { [System.Net.IPAddress]::Any }
        $listener = New-Object System.Net.Sockets.TcpListener($bindIp, $p)
        $listener.Start()
        $Port = $p
        break
    } catch {
        $listener = $null
    }
}
if ($null -eq $listener) {
    Write-Host ""
    Write-Host "  [ERROR] No free port in $startPort..$($startPort + 24)." -ForegroundColor Red
    Write-Host "  Close other programs using these ports and try again." -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

$url = "http://localhost:$Port/$Open"
Write-Host ""
Write-Host "  ==============================================" -ForegroundColor DarkGray
Write-Host "   360 viewer  -  local server" -ForegroundColor Green
Write-Host "  ==============================================" -ForegroundColor DarkGray
Write-Host "   URL  : http://localhost:$Port/" -ForegroundColor Cyan
if (-not $Local) {
    # 取局域网地址。要注意：装了 WSL / Hyper-V / 虚拟机的话，
    # 会多出 172.x 这类虚拟网卡地址，手机连不上，所以优先挑 192.168.*。
    $cands = @()
    try {
        $cands = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
                   Where-Object { $_.IPAddress -notmatch '^127\.' -and
                                  $_.IPAddress -notmatch '^169\.254\.' -and
                                  $_.AddressState -eq 'Preferred' } |
                   ForEach-Object { $_.IPAddress })
    } catch { }
    if ($cands.Count -eq 0) {
        try {
            $cands = @([System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
                       Where-Object { $_.AddressFamily -eq 'InterNetwork' } |
                       ForEach-Object { $_.IPAddressToString } |
                       Where-Object { $_ -notmatch '^127\.' })
        } catch { }
    }
    $pref = @($cands | Where-Object { $_ -like '192.168.*' })
    if ($pref.Count -eq 0) { $pref = @($cands | Where-Object { $_ -like '10.*' }) }
    if ($pref.Count -eq 0) { $pref = $cands }
    if ($pref.Count -gt 0) {
        Write-Host ""
        Write-Host "   手机访问（连同一个 WiFi）：" -ForegroundColor Yellow
        foreach ($ip in $pref) {
            Write-Host "     http://$ip`:$Port/" -ForegroundColor Yellow
        }
        Write-Host "     打不开就换上面另一个地址试试" -ForegroundColor DarkGray
    }
}
Write-Host "   Root : $Root"
Write-Host "   Stop : press Ctrl+C in this window"
Write-Host ""

if (-not $NoBrowser) { Start-Process $url | Out-Null }

function Send-Response($stream, [string]$status, [string]$contentType, [byte[]]$body) {
    $head = "HTTP/1.1 $status`r`n" +
            "Content-Type: $contentType`r`n" +
            "Content-Length: $($body.Length)`r`n" +
            "Cache-Control: no-cache, no-store`r`n" +
            "Access-Control-Allow-Origin: *`r`n" +
            "Access-Control-Allow-Headers: *`r`n" +
            "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS`r`n" +
            "Connection: close`r`n`r`n"
    $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($hb, 0, $hb.Length)
    if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
    $stream.Flush()
}

function Send-Text($stream, [string]$status, [string]$text, [string]$contentType) {
    Send-Response $stream $status $contentType ([System.Text.Encoding]::UTF8.GetBytes($text))
}

# read bytes until blank line, then \r\n\r\nreturn the raw header block
function Read-HeaderBlock($stream) {
    $buf = New-Object 'System.Collections.Generic.List[byte]'
    $one = New-Object byte[] 1
    while ($true) {
        $n = $stream.Read($one, 0, 1)
        if ($n -le 0) { break }
        [void]$buf.Add($one[0])
        $c = $buf.Count
        if ($c -ge 4 -and $buf[$c - 4] -eq 13 -and $buf[$c - 3] -eq 10 -and $buf[$c - 2] -eq 13 -and $buf[$c - 1] -eq 10) { break }
        if ($c -gt 262144) { break }
    }
    return , $buf.ToArray()
}

$rootLower = $Root.ToLower()

while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
        $stream = $client.GetStream()

        $raw = Read-HeaderBlock $stream
        if ($raw.Length -eq 0) { $client.Close(); continue }

        $text = [System.Text.Encoding]::UTF8.GetString($raw)
        $lines = $text -split "`r`n"
        $requestLine = $lines[0]
        $headers = @{}
        for ($i = 1; $i -lt $lines.Length; $i++) {
            $ln = $lines[$i]
            if ([string]::IsNullOrEmpty($ln)) { continue }
            $idx = $ln.IndexOf(":")
            if ($idx -gt 0) {
                $k = $ln.Substring(0, $idx).Trim().ToLower()
                $headers[$k] = $ln.Substring($idx + 1).Trim()
            }
        }

        $parts = $requestLine.Split(" ")
        $method = "GET"
        $target = "/"
        if ($parts.Length -ge 2) { $method = $parts[0].ToUpper(); $target = $parts[1] }
        $urlPath = [System.Uri]::UnescapeDataString($target.Split("?")[0])

        # ---------- request body ----------
        $body = New-Object byte[] 0
        $clen = 0
        if ($headers.ContainsKey("content-length")) { [void][int]::TryParse($headers["content-length"], [ref]$clen) }
        if ($clen -gt 0) {
            $body = New-Object byte[] $clen
            $got = 0
            while ($got -lt $clen) {
                $n = $stream.Read($body, $got, $clen - $got)
                if ($n -le 0) { break }
                $got += $n
            }
        }

        # ---------- routes ----------
        if ($method -eq "OPTIONS") {
            Send-Response $stream "204 No Content" "text/plain" (New-Object byte[] 0)
            $client.Close(); continue
        }

        if ($urlPath -eq "/@ping") {
            Send-Text $stream "200 OK" ('{"ok":true,"app":"360-studio","boot":"' + $bootId + '","materials":' + $materials.Count + '}') "application/json; charset=utf-8"
            $client.Close(); continue
        }

        if ($urlPath -eq "/@upload" -and $method -eq "POST") {
            $fname = "mat-" + $uploadSeq + ".png"
            if ($headers.ContainsKey("x-file-name")) {
                $decoded = [System.Uri]::UnescapeDataString($headers["x-file-name"])
                $safe = [System.IO.Path]::GetFileName($decoded)
                if (-not [string]::IsNullOrEmpty($safe)) { $fname = $safe }
            }
            $uploadSeq = $uploadSeq + 1
            $key = "$uploadSeq/$fname"
            $materials[$key] = $body
            Send-Text $stream "200 OK" ('{"url":"/@mat/' + $uploadSeq + '/' + $fname + '","size":' + $body.Length + '}') "application/json; charset=utf-8"
            $client.Close(); continue
        }

        if ($urlPath -eq "/@mat" -and $method -eq "DELETE") {
            $materials.Clear()
            Send-Text $stream "200 OK" '{"ok":true}' "application/json; charset=utf-8"
            $client.Close(); continue
        }

        if ($urlPath.StartsWith("/@mat/")) {
            $key = $urlPath.Substring(6)
            if ($materials.ContainsKey($key)) {
                $ext = [System.IO.Path]::GetExtension($key).ToLower()
                $ct = $mime[$ext]
                if (-not $ct) { $ct = "application/octet-stream" }
                Send-Response $stream "200 OK" $ct $materials[$key]
            } else {
                Send-Text $stream "404 Not Found" "material not found: $key" "text/plain; charset=utf-8"
            }
            $client.Close(); continue
        }

        # ---------- static files ----------
        if ($urlPath -eq "/") { $urlPath = "/$Open" }
        $rel = $urlPath.TrimStart("/").Replace("/", "\")
        $full = Join-Path $Root $rel

        $resolved = $null
        try { $resolved = (Resolve-Path -LiteralPath $full -ErrorAction Stop).Path } catch { $resolved = $null }

        $ok = ($null -ne $resolved) -and ($resolved.ToLower().StartsWith($rootLower)) -and (Test-Path -LiteralPath $resolved -PathType Leaf)

        if (-not $ok) {
            Send-Text $stream "404 Not Found" "404 Not Found: $urlPath" "text/plain; charset=utf-8"
        } else {
            $ext = [System.IO.Path]::GetExtension($resolved).ToLower()
            $ct = $mime[$ext]
            if (-not $ct) { $ct = "application/octet-stream" }
            Send-Response $stream "200 OK" $ct ([System.IO.File]::ReadAllBytes($resolved))
        }
    } catch {
        # a single failed request must not kill the server
    } finally {
        try { $client.Close() } catch { }
    }
}
