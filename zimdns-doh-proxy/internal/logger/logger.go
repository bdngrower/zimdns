package logger

import (
	"os"
	"time"

	"github.com/rs/zerolog"
)

var Log zerolog.Logger

func init() {
	zerolog.TimeFieldFormat = time.RFC3339
	Log = zerolog.New(os.Stdout).With().Timestamp().Logger()
}
