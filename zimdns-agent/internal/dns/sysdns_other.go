//go:build !windows

package dns

import "github.com/rs/zerolog/log"

func SetSystemDNS() error {
	log.Info().Msg("SetSystemDNS não está implementado neste SO")
	return nil
}

func RestoreSystemDNS() error {
	log.Info().Msg("RestoreSystemDNS não está implementado neste SO")
	return nil
}
