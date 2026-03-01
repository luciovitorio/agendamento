[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$N8nToken,
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Phone = "5511999999999",
  [string]$WrongToken = "token-invalido",
  [switch]$SkipMessageEndpoints
)

$ErrorActionPreference = "Stop"

$ApiBase = "{0}/api/integrations/n8n" -f $BaseUrl.TrimEnd("/")
$HandoffUri = "{0}/handoff" -f $ApiBase

function New-Result {
  param(
    [string]$Id,
    [string]$Name,
    [string]$Outcome,
    [string]$Status = "-",
    [string]$Note = ""
  )

  [PSCustomObject]@{
    Id      = $Id
    Outcome = $Outcome
    Status  = $Status
    Name    = $Name
    Note    = $Note
  }
}

function Invoke-Test {
  param(
    [string]$Id,
    [string]$Name,
    [string]$Method,
    [string]$Uri,
    [hashtable]$Headers,
    [object]$Body,
    [int]$ExpectedStatus,
    [scriptblock]$Assert
  )

  try {
    $requestArgs = @{
      Uri                = $Uri
      Method             = $Method
      Headers            = $Headers
      SkipHttpErrorCheck = $true
    }

    if ($null -ne $Body) {
      $requestArgs["ContentType"] = "application/json"
      $requestArgs["Body"] = ($Body | ConvertTo-Json -Depth 30)
    }

    $response = Invoke-WebRequest @requestArgs

    $status = [int]$response.StatusCode
    $raw = $response.Content
    $json = $null
    try {
      $json = $raw | ConvertFrom-Json -Depth 30
    } catch {
      $json = $null
    }

    $ok = $status -eq $ExpectedStatus
    if ($ok -and $Assert) {
      $ok = [bool](& $Assert $json $raw)
    }

    if ($ok) {
      return New-Result -Id $Id -Name $Name -Outcome "PASS" -Status $status
    }

    return New-Result -Id $Id -Name $Name -Outcome "FAIL" -Status $status -Note $raw
  } catch {
    return New-Result -Id $Id -Name $Name -Outcome "FAIL" -Status "EXCEPTION" -Note $_.Exception.Message
  }
}

$okHeaders = @{ Authorization = "Bearer $N8nToken" }
$badHeaders = @{ Authorization = "Bearer $WrongToken" }

$results = @()

$results += Invoke-Test `
  -Id "I01" `
  -Name "POST /handoff abre handoff (human)" `
  -Method "POST" `
  -Uri $HandoffUri `
  -Headers $okHeaders `
  -Body @{
    number        = $Phone
    mode          = "human"
    reason        = "Teste automatizado I01"
    actor         = "powershell-n8n-tests"
    assignedAgent = "qa-bot"
  } `
  -ExpectedStatus 200 `
  -Assert { param($json, $raw) $json -and $json.result -eq "UPDATED" -and $json.active -eq $true }

$results += Invoke-Test `
  -Id "I02" `
  -Name "GET /handoff confirma ativo em HUMAN" `
  -Method "GET" `
  -Uri ("{0}?number={1}" -f $HandoffUri, [Uri]::EscapeDataString($Phone)) `
  -Headers $okHeaders `
  -Body $null `
  -ExpectedStatus 200 `
  -Assert { param($json, $raw) $json -and $json.active -eq $true -and $json.handoff.mode -eq "HUMAN" }

$results += Invoke-Test `
  -Id "I03" `
  -Name "POST /handoff fecha handoff (bot/resume)" `
  -Method "POST" `
  -Uri $HandoffUri `
  -Headers $okHeaders `
  -Body @{
    number = $Phone
    mode   = "bot"
    reason = "Teste automatizado I03"
    actor  = "powershell-n8n-tests"
  } `
  -ExpectedStatus 200 `
  -Assert { param($json, $raw) $json -and $json.result -eq "UPDATED" -and $json.active -eq $false }

$results += Invoke-Test `
  -Id "I04" `
  -Name "GET /handoff confirma bot retomado" `
  -Method "GET" `
  -Uri ("{0}?number={1}" -f $HandoffUri, [Uri]::EscapeDataString($Phone)) `
  -Headers $okHeaders `
  -Body $null `
  -ExpectedStatus 200 `
  -Assert { param($json, $raw) $json -and $json.active -eq $false -and $json.handoff.mode -eq "BOT" }

$results += Invoke-Test `
  -Id "I05" `
  -Name "Token invalido retorna 401" `
  -Method "GET" `
  -Uri ("{0}?number={1}" -f $HandoffUri, [Uri]::EscapeDataString($Phone)) `
  -Headers $badHeaders `
  -Body $null `
  -ExpectedStatus 401 `
  -Assert { param($json, $raw) $raw -match "Token" }

$results += Invoke-Test `
  -Id "I06" `
  -Name "Numero invalido retorna 400" `
  -Method "POST" `
  -Uri $HandoffUri `
  -Headers $okHeaders `
  -Body @{
    number = "abc"
    mode   = "human"
  } `
  -ExpectedStatus 400 `
  -Assert { param($json, $raw) $raw -match "Numero|Número|invalido|inválido" }

if ($SkipMessageEndpoints) {
  $results += New-Result `
    -Id "I07" `
    -Name "POST /messages/saudacao envia mensagem configurada" `
    -Outcome "SKIP" `
    -Note "Executado com -SkipMessageEndpoints."

  $results += New-Result `
    -Id "I08" `
    -Name "POST /messages/humano envia mensagem e ativa handoff" `
    -Outcome "SKIP" `
    -Note "Executado com -SkipMessageEndpoints."
} else {
  $results += Invoke-Test `
    -Id "I07" `
    -Name "POST /messages/saudacao envia mensagem configurada" `
    -Method "POST" `
    -Uri ("{0}/messages/saudacao" -f $ApiBase) `
    -Headers $okHeaders `
    -Body @{
      number         = $Phone
      typingDelayMs  = 900
      typingPresence = "composing"
    } `
    -ExpectedStatus 200 `
    -Assert { param($json, $raw) $json -and $json.result -eq "SENT" }

  $results += Invoke-Test `
    -Id "I08" `
    -Name "POST /messages/humano envia mensagem e ativa handoff" `
    -Method "POST" `
    -Uri ("{0}/messages/humano" -f $ApiBase) `
    -Headers $okHeaders `
    -Body @{
      number          = $Phone
      activateHandoff = $true
      assignedAgent   = "qa-bot"
      reason          = "Teste automatizado I08"
    } `
    -ExpectedStatus 200 `
    -Assert { param($json, $raw) $json -and $json.result -eq "SENT" -and $json.handoffActivated -eq $true }

  try {
    Invoke-WebRequest `
      -Uri $HandoffUri `
      -Method POST `
      -Headers $okHeaders `
      -ContentType "application/json" `
      -Body (@{ number = $Phone; mode = "bot"; reason = "Cleanup after I08" } | ConvertTo-Json -Depth 10) `
      -SkipHttpErrorCheck | Out-Null
  } catch {
    # Cleanup de melhor esforco.
  }
}

$results | Format-Table -AutoSize

$pass = ($results | Where-Object { $_.Outcome -eq "PASS" }).Count
$fail = ($results | Where-Object { $_.Outcome -eq "FAIL" }).Count
$skip = ($results | Where-Object { $_.Outcome -eq "SKIP" }).Count

Write-Host ""
Write-Host ("Resumo => PASS: {0} | FAIL: {1} | SKIP: {2}" -f $pass, $fail, $skip)
Write-Host ("Base testada: {0}" -f $ApiBase)

if ($fail -gt 0) {
  exit 1
}
