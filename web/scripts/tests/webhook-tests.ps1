[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$WebhookToken,
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Phone = "5511999999999",
  [string]$WrongToken = "token-invalido",
  [switch]$RunDisabledBotTest
)

$ErrorActionPreference = "Stop"

$Endpoint = "{0}/api/evolution/webhook" -f $BaseUrl.TrimEnd("/")

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

function New-WebhookBody {
  param(
    [string]$Event = "messages.upsert",
    [bool]$FromMe = $false,
    [string]$RemoteJid = "",
    [string]$Text = "oi",
    [ValidateSet("text", "non_text", "missing")]
    [string]$MessageKind = "text"
  )

  if ([string]::IsNullOrWhiteSpace($RemoteJid)) {
    $RemoteJid = "{0}@s.whatsapp.net" -f $Phone
  }

  $data = @{
    key = @{
      fromMe    = $FromMe
      remoteJid = $RemoteJid
    }
  }

  switch ($MessageKind) {
    "text" {
      $data["message"] = @{ conversation = $Text }
    }
    "non_text" {
      $data["message"] = @{ imageMessage = @{ caption = "imagem sem texto" } }
    }
    "missing" {
      # Sem campo message para validar retorno rapido do webhook.
    }
  }

  return @{
    event = $Event
    data  = $data
  }
}

function Invoke-Test {
  param(
    [string]$Id,
    [string]$Name,
    [hashtable]$Headers,
    [hashtable]$Body,
    [int]$ExpectedStatus,
    [scriptblock]$Assert
  )

  try {
    $payload = $Body | ConvertTo-Json -Depth 30
    $response = Invoke-WebRequest `
      -Uri $Endpoint `
      -Method POST `
      -Headers $Headers `
      -ContentType "application/json" `
      -Body $payload `
      -SkipHttpErrorCheck

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

$okHeaders = @{ Authorization = "Bearer $WebhookToken" }
$badHeaders = @{ Authorization = "Bearer $WrongToken" }

$results = @()

$results += Invoke-Test `
  -Id "A01" `
  -Name "Token correto + evento valido" `
  -Headers $okHeaders `
  -Body (New-WebhookBody -Event "messages.upsert" -FromMe $false -Text "oi" -MessageKind "text") `
  -ExpectedStatus 200 `
  -Assert { param($json, $raw) $null -ne $json }

$results += Invoke-Test `
  -Id "A02" `
  -Name "Token invalido retorna 401" `
  -Headers $badHeaders `
  -Body (New-WebhookBody -Event "messages.upsert" -FromMe $false -Text "oi") `
  -ExpectedStatus 401 `
  -Assert { param($json, $raw) $raw -match "Token" }

$results += Invoke-Test `
  -Id "A03" `
  -Name "Evento diferente de messages.upsert e ignorado" `
  -Headers $okHeaders `
  -Body (New-WebhookBody -Event "connection.update" -MessageKind "missing") `
  -ExpectedStatus 200 `
  -Assert { param($json, $raw) $json -and $json.received -eq $true }

$results += Invoke-Test `
  -Id "A04" `
  -Name "Mensagem fromMe e ignorada" `
  -Headers $okHeaders `
  -Body (New-WebhookBody -Event "messages.upsert" -FromMe $true -Text "msg interna") `
  -ExpectedStatus 200 `
  -Assert { param($json, $raw) $json -and $json.received -eq $true }

$results += Invoke-Test `
  -Id "A05" `
  -Name "Mensagem de grupo e ignorada" `
  -Headers $okHeaders `
  -Body (New-WebhookBody -Event "messages.upsert" -RemoteJid "1203630TESTE@g.us" -Text "grupo") `
  -ExpectedStatus 200 `
  -Assert { param($json, $raw) $json -and $json.received -eq $true }

$results += Invoke-Test `
  -Id "A06" `
  -Name "Mensagem nao textual (imagem) responde sem quebrar" `
  -Headers $okHeaders `
  -Body (New-WebhookBody -Event "messages.upsert" -FromMe $false -MessageKind "non_text") `
  -ExpectedStatus 200 `
  -Assert { param($json, $raw) $json -and $json.received -eq $true }

if ($RunDisabledBotTest) {
  $results += Invoke-Test `
    -Id "A07" `
    -Name "Bot desabilitado retorna estado DISABLED" `
    -Headers $okHeaders `
    -Body (New-WebhookBody -Event "messages.upsert" -FromMe $false -Text "teste bot off") `
    -ExpectedStatus 200 `
    -Assert { param($json, $raw) $json -and $json.state -eq "DISABLED" }
} else {
  $results += New-Result `
    -Id "A07" `
    -Name "Bot desabilitado retorna estado DISABLED" `
    -Outcome "SKIP" `
    -Note "Execute com -RunDisabledBotTest apos desabilitar o bot em /admin/settings."
}

$results | Format-Table -AutoSize

$pass = ($results | Where-Object { $_.Outcome -eq "PASS" }).Count
$fail = ($results | Where-Object { $_.Outcome -eq "FAIL" }).Count
$skip = ($results | Where-Object { $_.Outcome -eq "SKIP" }).Count

Write-Host ""
Write-Host ("Resumo => PASS: {0} | FAIL: {1} | SKIP: {2}" -f $pass, $fail, $skip)
Write-Host ("Endpoint testado: {0}" -f $Endpoint)

if ($fail -gt 0) {
  exit 1
}
