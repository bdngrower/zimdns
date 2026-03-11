//go:build windows

package dns

import (
	"os/exec"

	"github.com/rs/zerolog/log"
)

func SetSystemDNS() error {
	script := `
$ErrorActionPreference = 'Stop'
try {
    $interfaces = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.InterfaceAlias -notmatch 'vEthernet|Loopback|Virtual' }
    if ($null -eq $interfaces -or $interfaces.Count -eq 0) {
        Write-Warning "No valid network interfaces found."
        exit 0
    }
    foreach ($iface in $interfaces) {
        Set-DnsClientServerAddress -InterfaceIndex $iface.ifIndex -ServerAddresses "127.0.53.1"
    }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
`
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", script)
	out, err := cmd.CombinedOutput()
	if err != nil {
		log.Error().Err(err).Str("output", string(out)).Msg("Falha ao definir o DNS do sistema")
		return err
	}
	log.Info().Msg("DNS do sistema definido para 127.0.53.1 nas interfaces ativas")
	return nil
}

func RestoreSystemDNS() error {
	script := `
$ErrorActionPreference = 'Stop'
try {
    $interfaces = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.InterfaceAlias -notmatch 'vEthernet|Loopback|Virtual' }
    if ($null -eq $interfaces -or $interfaces.Count -eq 0) {
        exit 0
    }
    foreach ($iface in $interfaces) {
        Set-DnsClientServerAddress -InterfaceIndex $iface.ifIndex -ResetServerAddresses
    }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
`
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", script)
	out, err := cmd.CombinedOutput()
	if err != nil {
		log.Error().Err(err).Str("output", string(out)).Msg("Falha ao restaurar o DNS do sistema")
		return err
	}
	log.Info().Msg("DNS do sistema restaurado com sucesso")
	return nil
}
