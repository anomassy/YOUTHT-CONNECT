$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ApiUrl = 'http://127.0.0.1:8001/api/healthz'
$WebUrl = 'http://127.0.0.1:5173/login'
$PythonExe = Join-Path $Root '.venv\Scripts\python.exe'
$ChromeExe = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$LogDirectory = Join-Path $env:LOCALAPPDATA 'YouthConnect\logs'
$StartupLog = Join-Path $LogDirectory 'startup.log'

New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null

function Write-StartupLog {
  param([string]$Message)

  Add-Content -Path $StartupLog -Value "$(Get-Date -Format o) $Message"
}

function Test-Endpoint {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -TimeoutSec 3 -UseBasicParsing
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Wait-ForEndpoint {
  param(
    [string]$Url,
    [string]$Name,
    [int]$TimeoutSeconds = 120
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Endpoint $Url) {
      Write-StartupLog "$Name is ready."
      return
    }
    Start-Sleep -Seconds 2
  }

  throw "$Name did not become ready at $Url."
}

try {
  Write-StartupLog 'Starting Youth Connect.'

  $databaseReady = $false
  $databaseDeadline = (Get-Date).AddSeconds(120)
  while ((Get-Date) -lt $databaseDeadline) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
      $connect = $client.ConnectAsync('127.0.0.1', 3306)
      if ($connect.Wait(1000) -and $client.Connected) {
        $databaseReady = $true
        break
      }
    } catch {
    } finally {
      $client.Dispose()
    }
    Start-Sleep -Seconds 2
  }
  if (-not $databaseReady) {
    throw 'XAMPP MySQL did not become available on 127.0.0.1:3306.'
  }
  Write-StartupLog 'XAMPP MySQL is ready.'

  if (-not (Test-Endpoint $ApiUrl)) {
    if (-not (Test-Path $PythonExe)) {
      throw "Python environment not found at $PythonExe."
    }
    $apiProcess = Start-Process `
      -FilePath $PythonExe `
      -ArgumentList '-m uvicorn server.main:app --app-dir artifacts\api-server --host 127.0.0.1 --port 8001' `
      -WorkingDirectory $Root `
      -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $LogDirectory 'api.stdout.log') `
      -RedirectStandardError (Join-Path $LogDirectory 'api.stderr.log') `
      -PassThru
    Write-StartupLog "Started API process $($apiProcess.Id)."
  } else {
    Write-StartupLog 'API was already running.'
  }
  Wait-ForEndpoint -Url $ApiUrl -Name 'API'

  if (-not (Test-Endpoint $WebUrl)) {
    $webProcess = Start-Process `
      -FilePath $env:ComSpec `
      -ArgumentList @('/d', '/c', 'pnpm --filter @workspace/web run dev -- --host 127.0.0.1') `
      -WorkingDirectory $Root `
      -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $LogDirectory 'web.stdout.log') `
      -RedirectStandardError (Join-Path $LogDirectory 'web.stderr.log') `
      -PassThru
    Write-StartupLog "Started web process $($webProcess.Id)."
  } else {
    Write-StartupLog 'Web app was already running.'
  }
  Wait-ForEndpoint -Url $WebUrl -Name 'Web app'

  if (Test-Path $ChromeExe) {
    Start-Process -FilePath $ChromeExe -ArgumentList $WebUrl
    Write-StartupLog 'Opened the web app in Google Chrome.'
  } else {
    Write-StartupLog "Google Chrome was not found at $ChromeExe."
  }
} catch {
  Write-StartupLog "ERROR: $($_.Exception.Message)"
  exit 1
}
