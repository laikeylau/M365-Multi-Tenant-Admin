<#
.SYNOPSIS
    Batch create Azure AD App Registrations for multiple tenants
    
.DESCRIPTION
    This script reads a tenant list from CSV file and creates app registrations
    in each tenant with all required permissions.
    
.PARAMETER TenantListFile
    Path to CSV file containing tenant information
    
.PARAMETER AppName
    Display name for the app registration

.EXAMPLE
    .\Register-M365AdminApp-Batch.ps1 -TenantListFile "tenants.csv"
    
.NOTES
    CSV file format:
    TenantId,TenantName,AdminEmail
    xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx,Tenant1,admin@tenant1.onmicrosoft.com
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$TenantListFile = "tenants.csv",
    
    [Parameter(Mandatory = $false)]
    [string]$AppName = "M365-Multi-Tenant-Admin",
    
    [Parameter(Mandatory = $false)]
    [int]$SecretValidityYears = 2
)

# ============================================================================
# Microsoft Graph API Permission Definitions
# ============================================================================
$GraphAppId = "00000003-0000-0000-c000-000000000000"

$ApplicationPermissions = @(
    "AuditLog.Read.All"
    "Directory.Read.All"
    "IdentityRiskEvent.Read.All"   # Health report: risk detections
    "IdentityRiskyUser.Read.All"   # Health report: risky users
    "Organization.Read.All"
    "Reports.Read.All"
    "SecurityEvents.Read.All"      # Health report: security alerts + secure score
    "ServiceHealth.Read.All"       # Read service health
    "Sites.Read.All"
    "User.Read.All"
    "User.ReadWrite.All"           # User management: edit / delete
)

$DelegatedPermissions = @(
    "BookingsAppointment.ReadWrite.All"
    "Calendars.Read"
    "Contacts.Read"
    "Directory.Read.All"
    "Files.Read.All"
    "Files.ReadWrite.All"
    "Group.Read.All"
    "Mail.Read"
    "MailboxSettings.Read"
    "Notes.Read.All"
    "offline_access"
    "openid"
    "People.Read.All"
    "Presence.Read.All"
    "profile"
    "Sites.Read.All"
    "Tasks.ReadWrite"
    "User.Read"
    "User.Read.All"
)

# ============================================================================
# Helper Functions
# ============================================================================

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Initialize-GraphModule {
    if (-not (Get-Module -ListAvailable -Name "Microsoft.Graph")) {
        Write-ColorOutput "Installing Microsoft.Graph module..." "Yellow"
        Install-Module -Name Microsoft.Graph -Scope CurrentUser -Force -AllowClobber
    }
    Import-Module Microsoft.Graph.Applications -ErrorAction Stop
    Import-Module Microsoft.Graph.Identity.SignIns -ErrorAction Stop
}

function Connect-ToTenant {
    param([string]$TenantId)
    
    try {
        $scopes = @("Application.ReadWrite.All", "AppRoleAssignment.ReadWrite.All", "Directory.Read.All")
        Connect-MgGraph -TenantId $TenantId -Scopes $scopes -NoWelcome
        $context = Get-MgContext
        return $context
    }
    catch {
        throw "Failed to connect to tenant: $_"
    }
}

function Get-PermissionIds {
    param(
        [object]$GraphSP,
        [string[]]$PermNames,
        [string]$PermType
    )
    
    $perms = @()
    foreach ($name in $PermNames) {
        $perm = if ($PermType -eq "Role") {
            $GraphSP.AppRoles | Where-Object { $_.Value -eq $name }
        }
        else {
            $GraphSP.Oauth2PermissionScopes | Where-Object { $_.Value -eq $name }
        }
        if ($perm) { $perms += @{ Name = $name; Id = $perm.Id } }
    }
    return $perms
}

function Get-TenantDefaultDomain {
    # Get the default .onmicrosoft.com domain
    try {
        $domains = Get-MgDomain -All
        $defaultDomain = $domains | Where-Object { $_.Id -like "*.onmicrosoft.com" -and $_.Id -notlike "*.mail.onmicrosoft.com" } | Select-Object -First 1
        if ($defaultDomain) {
            return $defaultDomain.Id
        }
        # Fallback: get any initial domain
        $initialDomain = $domains | Where-Object { $_.IsInitial -eq $true } | Select-Object -First 1
        if ($initialDomain) {
            return $initialDomain.Id
        }
        return ""
    }
    catch {
        return ""
    }
}

function Create-AppInTenant {
    param(
        [string]$DisplayName,
        [array]$AppPerms,
        [array]$DelPerms,
        [int]$SecretYears
    )
    
    # Get tenant default domain
    $defaultDomain = Get-TenantDefaultDomain
    
    # Get Graph service principal
    $graphSP = Get-MgServicePrincipal -Filter "appId eq '$GraphAppId'"
    
    # Get permission IDs
    $appPermIds = Get-PermissionIds -GraphSP $graphSP -PermNames $ApplicationPermissions -PermType "Role"
    $delPermIds = Get-PermissionIds -GraphSP $graphSP -PermNames $DelegatedPermissions -PermType "Scope"
    
    # Build resource access
    $resourceAccess = @()
    foreach ($p in $appPermIds) { $resourceAccess += @{ Id = $p.Id; Type = "Role" } }
    foreach ($p in $delPermIds) { $resourceAccess += @{ Id = $p.Id; Type = "Scope" } }
    
    # Create app
    $appParams = @{
        DisplayName            = $DisplayName
        SignInAudience         = "AzureADMyOrg"
        RequiredResourceAccess = @(@{
                ResourceAppId  = $GraphAppId
                ResourceAccess = $resourceAccess
            })
        Web                    = @{
            RedirectUris          = @("http://localhost:5000/callback", "http://localhost:5173/callback")
            ImplicitGrantSettings = @{ EnableIdTokenIssuance = $true }
        }
    }
    
    $app = New-MgApplication -BodyParameter $appParams
    
    # Create service principal
    $sp = New-MgServicePrincipal -AppId $app.AppId
    
    # Create secret
    $secretParams = @{
        PasswordCredential = @{
            DisplayName = "Auto-generated"
            EndDateTime = (Get-Date).AddYears($SecretYears)
        }
    }
    $secret = Add-MgApplicationPassword -ApplicationId $app.Id -BodyParameter $secretParams
    
    # Grant admin consent
    foreach ($p in $appPermIds) {
        try {
            New-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $sp.Id -BodyParameter @{
                PrincipalId = $sp.Id
                ResourceId  = $graphSP.Id
                AppRoleId   = $p.Id
            } -ErrorAction SilentlyContinue | Out-Null
        }
        catch { }
    }
    
    return @{
        AppId         = $app.AppId
        ObjectId      = $app.Id
        ClientSecret  = $secret.SecretText
        SecretExpiry  = $secret.EndDateTime
        DefaultDomain = $defaultDomain
    }
}

# ============================================================================
# Main Script
# ============================================================================

Write-ColorOutput @"

===============================================================
   M365 Multi-Tenant Admin - Batch App Registration Tool
===============================================================

"@ "Cyan"

# Initialize module
Initialize-GraphModule

# Check tenant list file
if (-not (Test-Path $TenantListFile)) {
    # Create sample file
    $sampleContent = @"
TenantId,TenantName,AdminEmail
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx,Tenant1,admin@tenant1.onmicrosoft.com
yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy,Tenant2,admin@tenant2.onmicrosoft.com
"@
    $samplePath = Join-Path $PSScriptRoot "tenants-sample.csv"
    $sampleContent | Out-File -FilePath $samplePath -Encoding UTF8
    
    Write-ColorOutput "Tenant list file not found: $TenantListFile" "Red"
    Write-ColorOutput "Sample file created: $samplePath" "Yellow"
    Write-ColorOutput "Please fill in tenant information and run the script again" "Yellow"
    exit 1
}

# Read tenant list
$tenants = Import-Csv $TenantListFile
Write-ColorOutput "Found $($tenants.Count) tenants to process" "Green"

# Results storage
$results = @()
$resultFile = Join-Path $PSScriptRoot "batch-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').csv"

# Process each tenant
$index = 0
foreach ($tenant in $tenants) {
    $index++
    Write-ColorOutput "`n[$index/$($tenants.Count)] Processing tenant: $($tenant.TenantName)" "Cyan"
    Write-ColorOutput "  Tenant ID: $($tenant.TenantId)" "Gray"
    Write-ColorOutput "  Please sign in with admin account: $($tenant.AdminEmail)" "Yellow"
    
    try {
        # Connect to tenant
        $context = Connect-ToTenant -TenantId $tenant.TenantId
        
        # Create app
        $appResult = Create-AppInTenant -DisplayName $AppName -SecretYears $SecretValidityYears
        
        # Record success
        $results += [PSCustomObject]@{
            TenantId      = $tenant.TenantId
            TenantName    = $tenant.TenantName
            DefaultDomain = $appResult.DefaultDomain
            Status        = "Success"
            ClientId      = $appResult.AppId
            ClientSecret  = $appResult.ClientSecret
            SecretExpiry  = $appResult.SecretExpiry
            Error         = ""
        }
        
        Write-ColorOutput "  [OK] App created: $($appResult.AppId)" "Green"
        Write-ColorOutput "  [OK] Default domain: $($appResult.DefaultDomain)" "Green"
        
        # Disconnect
        Disconnect-MgGraph -ErrorAction SilentlyContinue | Out-Null
    }
    catch {
        # Record failure
        $results += [PSCustomObject]@{
            TenantId      = $tenant.TenantId
            TenantName    = $tenant.TenantName
            DefaultDomain = ""
            Status        = "Failed"
            ClientId      = ""
            ClientSecret  = ""
            SecretExpiry  = ""
            Error         = $_.Exception.Message
        }
        
        Write-ColorOutput "  [FAILED] $_" "Red"
    }
    
    # Save results in real-time
    $results | Export-Csv -Path $resultFile -NoTypeInformation -Encoding UTF8
}

# Summary
$successCount = ($results | Where-Object { $_.Status -eq "Success" }).Count
$failCount = ($results | Where-Object { $_.Status -eq "Failed" }).Count

Write-ColorOutput @"

===============================================================
                    BATCH PROCESSING COMPLETED
===============================================================
   Success: $successCount tenants
   Failed:  $failCount tenants
   Results: $resultFile
===============================================================

"@ "Green"
