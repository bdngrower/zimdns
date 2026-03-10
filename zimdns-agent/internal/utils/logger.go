package utils

import (
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func InitLogger(debug bool) {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	
	output := zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339}
	if !debug {
		// In production/windows service, we might want to log to a file or Event log
		// but for v1, console (redirected) is fine.
	}

	log.Logger = zerolog.New(output).With().Timestamp().Logger()

	if debug {
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	} else {
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	}
}
