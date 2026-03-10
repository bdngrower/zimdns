//go:build windows

package dns

import (
	"os/exec"

	"github.com/rs/zerolog/log"
)

// SetSystemDNS define o DNS do sistema para 127.0.53.1 usando PowerShell para interfaces ativas.
func SetSystemDNS() error {
	script := `
$interfaces = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.InterfaceAlias -notmatch 'vEthernet|Loopback|Virtual' }
foreach ($iface in $interfaces) {
    Set-DnsClientServerAddress -InterfaceIndex $iface.ifIndex -ServerAddresses "127.0.53.1"
}
`
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", script)
	if err := cmd.Run(); err != nil {
		log.Error().Err(err).Msg("Falha ao definir o DNS do sistema")
		return err
	}
	log.Info().Msg("DNS do sistema definido para 127.0.53.1")
	return nil
}

// RestoreSystemDNS reseta as configurações de DNS do sistema (voltar para DHCP / padrão).
func RestoreSystemDNS() error {
	script := `
$interfaces = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.InterfaceAlias -notmatch 'vEthernet|Loopback|Virtual' }
foreach ($iface in $interfaces) {
    Set-DnsClientServerAddress -InterfaceIndex $iface.ifIndex -ResetServerAddresses
}
`
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", script)
	if err := cmd.Run(); err != nil {
		log.Error().Err(err).Msg("Falha ao restaurar o DNS do sistema")
		return err
	}
	log.Info().Msg("DNS do sistema restaurado com sucesso")
	return nil
}
