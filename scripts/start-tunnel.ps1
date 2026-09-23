# =====================================================================
# Veyra - Development Tunnel Script
# Sets up an ngrok tunnel so Vapi can reach your local Express gateway
# =====================================================================

Write-Host ""
Write-Host "  Veyra - ngrok Tunnel" -ForegroundColor Cyan
Write-Host "  =====================================================" -ForegroundColor DarkGray

# ── Check ngrok is installed ──────────────────────────────────────────
$ngrokCmd = Get-Command ngrok -ErrorAction SilentlyContinue
if (-not $ngrokCmd) {
    Write-Host ""
    Write-Host "  ⚠️  ngrok is not installed." -ForegroundColor Yellow
    Write-Host "     Install it from: https://ngrok.com/download" -ForegroundColor Gray
    Write-Host "     Or run:  winget install ngrok" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  💡 Alternative: Using cloudflared tunnel instead..." -ForegroundColor Cyan
    
    $cfCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cfCmd) {
        Write-Host "  ✅ cloudflared found — starting tunnel on port 3001..." -ForegroundColor Green
        Write-Host ""
        cloudflared tunnel --url http://localhost:3001
        exit 0
    } else {
        Write-Host ""
        Write-Host "  ❌ Neither ngrok nor cloudflared found." -ForegroundColor Red
        Write-Host "     For now, you can still use TEXT MODE in the Voice Studio." -ForegroundColor Yellow
        Write-Host "     Text mode sends queries directly to FastAPI RAG without Vapi." -ForegroundColor Gray
        Write-Host ""
        Write-Host "  📌 To install ngrok:" -ForegroundColor White
        Write-Host "     winget install ngrok" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  📌 Or install cloudflared:" -ForegroundColor White
        Write-Host "     winget install Cloudflare.cloudflared" -ForegroundColor Cyan
        exit 1
    }
}

# ── Start ngrok tunnel ────────────────────────────────────────────────
Write-Host ""
Write-Host "  🚇 Starting ngrok tunnel on port 3001..." -ForegroundColor Green
Write-Host "     (This may take a few seconds)" -ForegroundColor DarkGray
Write-Host ""

# Start ngrok in background
$ngrokJob = Start-Job -ScriptBlock { ngrok http 3001 --log=stdout }

# Wait for ngrok to initialize
Start-Sleep -Seconds 3

# ── Fetch tunnel URL from ngrok local API ─────────────────────────────
try {
    $ngrokApi = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction Stop
    $publicUrl = $ngrokApi.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1 -ExpandProperty public_url
    
    if (-not $publicUrl) {
        $publicUrl = $ngrokApi.tunnels | Select-Object -First 1 -ExpandProperty public_url
    }

    if ($publicUrl) {
        Write-Host "  ✅ Tunnel URL:" -ForegroundColor Green
        Write-Host "     $publicUrl" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  📋 Your Vapi Webhook URL (for /api/voice/webhook):" -ForegroundColor White
        Write-Host "     $publicUrl/api/voice/webhook" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  📋 Your Vapi Custom LLM URL (for /api/voice/vapi-llm):" -ForegroundColor White  
        Write-Host "     $publicUrl/api/voice/vapi-llm" -ForegroundColor Yellow
        Write-Host ""
        
        # ── Update .env with PUBLIC_WEBHOOK_URL ──────────────────────────
        $envPath = Join-Path $PSScriptRoot ".." ".env"
        $envContent = Get-Content $envPath -Raw
        
        if ($envContent -match "PUBLIC_WEBHOOK_URL=.*") {
            $envContent = $envContent -replace "PUBLIC_WEBHOOK_URL=.*", "PUBLIC_WEBHOOK_URL=$publicUrl"
        } else {
            $envContent += "`nPUBLIC_WEBHOOK_URL=$publicUrl"
        }
        
        Set-Content $envPath $envContent
        Write-Host "  ✅ .env updated with PUBLIC_WEBHOOK_URL=$publicUrl" -ForegroundColor Green

        Write-Host ""
        Write-Host "  ─────────────────────────────────────────────────────" -ForegroundColor DarkGray
        Write-Host "  NEXT STEPS:" -ForegroundColor White
        Write-Host "  1. The frontend will use this tunnel URL automatically." -ForegroundColor Gray
        Write-Host "  2. Restart the Express gateway to pick up the new env var." -ForegroundColor Gray
        Write-Host "  3. In Voice Studio, click 'Start Voice Call'." -ForegroundColor Gray
        Write-Host "  ─────────────────────────────────────────────────────" -ForegroundColor DarkGray
    }
} catch {
    Write-Host "  ⚠️  Could not fetch ngrok URL automatically." -ForegroundColor Yellow
    Write-Host "     Open http://localhost:4040 in your browser to see the URL." -ForegroundColor Gray
}

Write-Host ""
Write-Host "  Press Ctrl+C to stop the tunnel." -ForegroundColor DarkGray
Write-Host ""

# Keep script alive while ngrok runs
Wait-Job $ngrokJob
