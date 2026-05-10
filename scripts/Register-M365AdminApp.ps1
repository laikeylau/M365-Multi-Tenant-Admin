<#
.SYNOPSIS
    Auto-create Azure AD App Registration with Microsoft Graph API permissions
    
.DESCRIPTION
    This script creates an App Registration in Azure AD and configures all required
    Microsoft Graph API permissions for M365 Multi-Tenant Admin.
    
.PARAMETER AppName
    Display name for the app registration, default: "M365-Multi-Tenant-Admin"
    
.PARAMETER CreateClientSecret
    Whether to create a client secret, default: true
    
.PARAMETER SecretValidityYears
    Client secret validity in years, default: 2
    
.PARAMETER GrantAdminConsent
    Whether to auto-grant admin consent, default: true

.EXAMPLE
    .\Register-M365AdminApp.ps1
    
.EXAMPLE
    .\Register-M365AdminApp.ps1 -AppName "MyCustomApp" -SecretValidityYears 1

.NOTES
    Requires Microsoft.Graph PowerShell module
    Requires Global Administrator or Application Administrator role
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$AppName = "M365-Multi-Tenant-Admin",
    
    [Parameter(Mandatory = $false)]
    [bool]$CreateClientSecret = $true,
    
    [Parameter(Mandatory = $false)]
    [int]$SecretValidityYears = 2,
    
    [Parameter(Mandatory = $false)]
    [bool]$GrantAdminConsent = $true
)

# ============================================================================
# Microsoft Graph API Permission Definitions
# ============================================================================

$GraphAppId = "00000003-0000-0000-c000-000000000000"

# Application permissions (require admin consent)
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

# Delegated permissions
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
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Test-GraphModuleInstalled {
    $module = Get-Module -ListAvailable -Name "Microsoft.Graph" | Select-Object -First 1
    return $null -ne $module
}

function Install-GraphModuleIfNeeded {
    if (-not (Test-GraphModuleInstalled)) {
        Write-ColorOutput "Installing Microsoft.Graph module..." "Yellow"
        try {
            Install-Module -Name Microsoft.Graph -Scope CurrentUser -Force -AllowClobber
            Write-ColorOutput "Microsoft.Graph module installed successfully!" "Green"
        }
        catch {
            Write-ColorOutput "Failed to install module: $_" "Red"
            exit 1
        }
    }
    else {
        Write-ColorOutput "Microsoft.Graph module is installed" "Green"
    }
}

function Connect-ToGraph {
    Write-ColorOutput "`nConnecting to Microsoft Graph..." "Cyan"
    Write-ColorOutput "Please sign in with a Global Administrator account in the browser" "Yellow"
    
    try {
        $scopes = @(
            "Application.ReadWrite.All",
            "AppRoleAssignment.ReadWrite.All",
            "Directory.Read.All"
        )
        
        Connect-MgGraph -Scopes $scopes -NoWelcome
        
        $context = Get-MgContext
        if ($null -eq $context) {
            throw "Cannot get Graph context"
        }
        
        Write-ColorOutput "Connected to tenant: $($context.TenantId)" "Green"
        Write-ColorOutput "Account: $($context.Account)" "Green"
        return $context
    }
    catch {
        Write-ColorOutput "Connection failed: $_" "Red"
        exit 1
    }
}

function Get-GraphServicePrincipal {
    Write-ColorOutput "`nGetting Microsoft Graph service principal..." "Cyan"
    
    $graphSP = Get-MgServicePrincipal -Filter "appId eq '$GraphAppId'" -ErrorAction Stop
    
    if ($null -eq $graphSP) {
        throw "Cannot find Microsoft Graph service principal"
    }
    
    Write-ColorOutput "Found Microsoft Graph service principal" "Green"
    return $graphSP
}

function Get-PermissionIds {
    param(
        [object]$GraphServicePrincipal,
        [string[]]$PermissionNames,
        [string]$PermissionType
    )
    
    $permissions = @()
    
    foreach ($permName in $PermissionNames) {
        if ($PermissionType -eq "Role") {
            $perm = $GraphServicePrincipal.AppRoles | Where-Object { $_.Value -eq $permName }
        }
        else {
            $perm = $GraphServicePrincipal.Oauth2PermissionScopes | Where-Object { $_.Value -eq $permName }
        }
        
        if ($null -ne $perm) {
            $permissions += @{
                Name = $permName
                Id   = $perm.Id
            }
        }
        else {
            Write-ColorOutput "Warning: Permission '$permName' not found" "Yellow"
        }
    }
    
    return $permissions
}

function New-AppRegistration {
    param(
        [string]$DisplayName,
        [object]$GraphServicePrincipal,
        [array]$AppPermissions,
        [array]$DelPermissions
    )
    
    Write-ColorOutput "`nCreating app registration: $DisplayName" "Cyan"
    
    $requiredResourceAccess = @{
        ResourceAppId  = $GraphAppId
        ResourceAccess = @()
    }
    
    foreach ($perm in $AppPermissions) {
        $requiredResourceAccess.ResourceAccess += @{
            Id   = $perm.Id
            Type = "Role"
        }
    }
    
    foreach ($perm in $DelPermissions) {
        $requiredResourceAccess.ResourceAccess += @{
            Id   = $perm.Id
            Type = "Scope"
        }
    }
    
    $appParams = @{
        DisplayName            = $DisplayName
        SignInAudience         = "AzureADMyOrg"
        RequiredResourceAccess = @($requiredResourceAccess)
        Web                    = @{
            RedirectUris          = @(
                "http://localhost:5000/callback",
                "http://localhost:5173/callback",
                "https://localhost/callback"
            )
            ImplicitGrantSettings = @{
                EnableAccessTokenIssuance = $false
                EnableIdTokenIssuance     = $true
            }
        }
    }
    
    try {
        $app = New-MgApplication -BodyParameter $appParams
        Write-ColorOutput "App registration created successfully!" "Green"
        Write-ColorOutput "  Application (client) ID: $($app.AppId)" "White"
        Write-ColorOutput "  Object ID: $($app.Id)" "White"
        return $app
    }
    catch {
        Write-ColorOutput "Failed to create app: $_" "Red"
        throw
    }
}

function New-AppServicePrincipal {
    param(
        [string]$AppId
    )
    
    Write-ColorOutput "`nCreating service principal for the app..." "Cyan"
    
    try {
        $sp = New-MgServicePrincipal -AppId $AppId
        Write-ColorOutput "Service principal created successfully!" "Green"
        return $sp
    }
    catch {
        Write-ColorOutput "Failed to create service principal: $_" "Red"
        throw
    }
}

function New-AppClientSecret {
    param(
        [string]$AppObjectId,
        [int]$ValidityYears
    )
    
    Write-ColorOutput "`nCreating client secret..." "Cyan"
    
    $endDate = (Get-Date).AddYears($ValidityYears)
    
    $secretParams = @{
        PasswordCredential = @{
            DisplayName = "Auto-generated secret"
            EndDateTime = $endDate
        }
    }
    
    try {
        $secret = Add-MgApplicationPassword -ApplicationId $AppObjectId -BodyParameter $secretParams
        Write-ColorOutput "Client secret created successfully!" "Green"
        Write-ColorOutput "  Secret value: $($secret.SecretText)" "Yellow"
        Write-ColorOutput "  Expires: $($secret.EndDateTime)" "White"
        Write-ColorOutput "`n  WARNING: Save this secret value now, it will not be shown again!" "Red"
        return $secret
    }
    catch {
        Write-ColorOutput "Failed to create secret: $_" "Red"
        throw
    }
}

function Grant-AdminConsentForApp {
    param(
        [object]$AppServicePrincipal,
        [object]$GraphServicePrincipal,
        [array]$AppPermissions
    )
    
    Write-ColorOutput "`nGranting admin consent..." "Cyan"
    
    foreach ($perm in $AppPermissions) {
        try {
            $params = @{
                PrincipalId = $AppServicePrincipal.Id
                ResourceId  = $GraphServicePrincipal.Id
                AppRoleId   = $perm.Id
            }
            
            New-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $AppServicePrincipal.Id -BodyParameter $params -ErrorAction SilentlyContinue | Out-Null
            Write-ColorOutput "  [OK] Granted: $($perm.Name)" "Green"
        }
        catch {
            if ($_.Exception.Message -like "*Permission being assigned already exists*") {
                Write-ColorOutput "  [EXISTS] Already granted: $($perm.Name)" "Gray"
            }
            else {
                Write-ColorOutput "  [FAILED] $($perm.Name) - $_" "Red"
            }
        }
    }
    
    Write-ColorOutput "Admin consent completed!" "Green"
}

function Export-AppConfiguration {
    param(
        [object]$App,
        [object]$Secret,
        [string]$TenantId
    )
    
    $configPath = Join-Path $PSScriptRoot "app-config-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    
    $config = @{
        TenantId     = $TenantId
        ClientId     = $App.AppId
        ClientSecret = if ($Secret) { $Secret.SecretText } else { "" }
        ObjectId     = $App.Id
        CreatedAt    = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        SecretExpiry = if ($Secret) { $Secret.EndDateTime.ToString("yyyy-MM-dd") } else { "" }
    }
    
    $config | ConvertTo-Json | Out-File -FilePath $configPath -Encoding UTF8
    
    Write-ColorOutput "`nConfiguration exported to: $configPath" "Cyan"
    return $configPath
}

# ============================================================================
# Main Script
# ============================================================================

Write-ColorOutput @"

===============================================================
   M365 Multi-Tenant Admin - Azure AD App Registration Tool
===============================================================
   This script will create an app registration and configure
   all required API permissions automatically.
===============================================================

"@ "Cyan"

# 1. Check and install Microsoft.Graph module
Install-GraphModuleIfNeeded

# 2. Import modules
Write-ColorOutput "`nImporting Microsoft.Graph modules..." "Cyan"
Import-Module Microsoft.Graph.Applications -ErrorAction Stop
Import-Module Microsoft.Graph.Identity.SignIns -ErrorAction Stop

# 3. Connect to Graph
$context = Connect-ToGraph
$tenantId = $context.TenantId

# 4. Get Microsoft Graph service principal
$graphSP = Get-GraphServicePrincipal

# 5. Get permission IDs
Write-ColorOutput "`nResolving API permissions..." "Cyan"
$appPerms = Get-PermissionIds -GraphServicePrincipal $graphSP -PermissionNames $ApplicationPermissions -PermissionType "Role"
$delPerms = Get-PermissionIds -GraphServicePrincipal $graphSP -PermissionNames $DelegatedPermissions -PermissionType "Scope"

Write-ColorOutput "  Found $($appPerms.Count) Application permissions" "White"
Write-ColorOutput "  Found $($delPerms.Count) Delegated permissions" "White"

# 6. Create app registration
$app = New-AppRegistration -DisplayName $AppName -GraphServicePrincipal $graphSP -AppPermissions $appPerms -DelPermissions $delPerms

# 7. Create service principal
$appSP = New-AppServicePrincipal -AppId $app.AppId

# 8. Create client secret
$secret = $null
if ($CreateClientSecret) {
    $secret = New-AppClientSecret -AppObjectId $app.Id -ValidityYears $SecretValidityYears
}

# 9. Grant admin consent (for Application permissions only)
if ($GrantAdminConsent) {
    Grant-AdminConsentForApp -AppServicePrincipal $appSP -GraphServicePrincipal $graphSP -AppPermissions $appPerms
}

# 10. Export configuration
$configFile = Export-AppConfiguration -App $app -Secret $secret -TenantId $tenantId

# Done
Write-ColorOutput @"

===============================================================
                     COMPLETED SUCCESSFULLY!
===============================================================
   App registration has been created and configured.
===============================================================

"@ "Green"

Write-ColorOutput "Summary:" "Cyan"
Write-ColorOutput "  Tenant ID:     $tenantId" "White"
Write-ColorOutput "  Client ID:     $($app.AppId)" "White"
Write-ColorOutput "  Object ID:     $($app.Id)" "White"
if ($secret) {
    Write-ColorOutput "  Client Secret: $($secret.SecretText)" "Yellow"
}
Write-ColorOutput "  Config File:   $configFile" "White"

Write-ColorOutput "`nNext Steps:" "Cyan"
Write-ColorOutput "  1. Copy the configuration above to your application settings" "White"
Write-ColorOutput "  2. For Delegated permissions, users will be prompted for consent on first login" "White"
Write-ColorOutput "  3. To create apps in other tenants, run this script with different admin accounts" "White"

# Disconnect
Disconnect-MgGraph -ErrorAction SilentlyContinue | Out-Null
Write-ColorOutput "`nDisconnected from Microsoft Graph" "Gray"
