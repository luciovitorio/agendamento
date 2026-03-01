[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$VerifyToken,
  [Parameter(Mandatory = $true)]
  [string]$AppSecret,
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Phone = "5511999999999"
)

$ErrorActionPreference = "Stop"

$Endpoint = "{0}/api/meta/webhook" -f $BaseUrl.TrimEnd("/")
$Challenge = "meta_challenge_123"

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

function New-MetaBody {
  param(
    [string]$Text = "oi",
    [switch]$WithoutMessages
  )

  $value = @{
    messaging_product = "whatsapp"
    metadata = @{
      display_phone_number = "15551234567"
      phone_number_id      = "123456789012345"
    }
    contacts = @(
      @{
        profile = @{ name = "Paciente Teste" }
        wa_id   = $Phone
      }
    )
  }

  if (-not $WithoutMessages) {
    $value["messages"] = @(
      @{
        from      = $Phone
        id        = "wamid.TESTE_META_001"
        timestamp = "1772391000"
        type      = "text"
        text      = @{ body = $Text }
      }
    )
  }

  return @{
    object = "whatsapp_business_account"
    entry  = @(
      @{
        id      = "waba_test_001"
        changes = @(
          @{
            field = "messages"
            value = $value
          }
        )
      }
    )
  }
}

function Get-MetaSignature {
  param(
    [string]$Payload,
    [string]$Secret
  )

  $hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($Secret))
  try {
    $hash = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($Payload))
  } finally {
    $hmac.Dispose()
  }

  $hex = -join ($hash | ForEach-Object { $_.ToString("x2") })
  return "sha256=$hex"
}

function Invoke-PostTest {
  param(
    [string]$Id,
    [string]$Name,
    [hashtable]$Headers,
    [string]$Payload,
    [int]$ExpectedStatus,
    [scriptblock]$Assert
  )

  try {
    $response = Invoke-WebRequest `
      -Uri $Endpoint `
      -Method POST `
      -Headers $Headers `
      -ContentType "application/json" `
      -Body $Payload `
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

$results = @()

try {
  $uriOk = "{0}?hub.mode=subscribe&hub.verify_token={1}&hub.challenge={2}" -f $Endpoint, [uri]::EscapeDataString($VerifyToken), [uri]::EscapeDataString($Challenge)
  $respOk = Invoke-WebRequest -Uri $uriOk -Method GET -SkipHttpErrorCheck
  if (($respOk.StatusCode -eq 200) -and ($respOk.Content -eq $Challenge)) {
    $results += New-Result -Id "M01" -Name "GET challenge com verify token correto" -Outcome "PASS" -Status $respOk.StatusCode
  } else {
    $results += New-Result -Id "M01" -Name "GET challenge com verify token correto" -Outcome "FAIL" -Status $respOk.StatusCode -Note $respOk.Content
  }
} catch {
  $results += New-Result -Id "M01" -Name "GET challenge com verify token correto" -Outcome "FAIL" -Status "EXCEPTION" -Note $_.Exception.Message
}

try {
  $uriBad = "{0}?hub.mode=subscribe&hub.verify_token=token_errado&hub.challenge={1}" -f $Endpoint, [uri]::EscapeDataString($Challenge)
  $respBad = Invoke-WebRequest -Uri $uriBad -Method GET -SkipHttpErrorCheck
  if ($respBad.StatusCode -eq 403) {
    $results += New-Result -Id "M02" -Name "GET challenge com verify token errado" -Outcome "PASS" -Status $respBad.StatusCode
  } else {
    $results += New-Result -Id "M02" -Name "GET challenge com verify token errado" -Outcome "FAIL" -Status $respBad.StatusCode -Note $respBad.Content
  }
} catch {
  $results += New-Result -Id "M02" -Name "GET challenge com verify token errado" -Outcome "FAIL" -Status "EXCEPTION" -Note $_.Exception.Message
}

$payloadText = (New-MetaBody -Text "oi meta") | ConvertTo-Json -Depth 30 -Compress
$validSignature = Get-MetaSignature -Payload $payloadText -Secret $AppSecret
$invalidSignature = "sha256=00"

$results += Invoke-PostTest `
  -Id "M03" `
  -Name "POST sem assinatura deve retornar 401" `
  -Headers @{} `
  -Payload $payloadText `
  -ExpectedStatus 401 `
  -Assert { param($json, $raw) $raw -match "Assinatura" }

$results += Invoke-PostTest `
  -Id "M04" `
  -Name "POST com assinatura invalida deve retornar 401" `
  -Headers @{ "x-hub-signature-256" = $invalidSignature } `
  -Payload $payloadText `
  -ExpectedStatus 401 `
  -Assert { param($json, $raw) $raw -match "Assinatura" }

$results += Invoke-PostTest `
  -Id "M05" `
  -Name "POST com assinatura valida processa mensagem" `
  -Headers @{ "x-hub-signature-256" = $validSignature } `
  -Payload $payloadText `
  -ExpectedStatus 200 `
  -Assert { param($json, $raw) $json -and $json.received -eq $true }

$payloadNoMessages = (New-MetaBody -WithoutMessages) | ConvertTo-Json -Depth 30 -Compress
$validSignatureNoMessages = Get-MetaSignature -Payload $payloadNoMessages -Secret $AppSecret

$results += Invoke-PostTest `
  -Id "M06" `
  -Name "POST valido sem messages retorna recebido=true" `
  -Headers @{ "x-hub-signature-256" = $validSignatureNoMessages } `
  -Payload $payloadNoMessages `
  -ExpectedStatus 200 `
  -Assert { param($json, $raw) $json -and $json.received -eq $true }

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
