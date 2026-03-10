package utils

import (
	"os"
	"path/filepath"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func InitLogger(debug bool) {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	
	consoleOutput := zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339}
	
	var logFile *os.File
	var err error
	
	logDir := ""
	if os.Getenv("ProgramData") != "" {
		logDir = filepath.Join(os.Getenv("ProgramData"), "ZimDNS")
		_ = os.MkdirAll(logDir, 0755)
		logPath := filepath.Join(logDir, "agent.log")
		logFile, err = os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	}

	var multi zerolog.LevelWriter
	if err == nil && logFile != nil {
		multi = zerolog.MultiLevelWriter(consoleOutput, logFile)
	} else {
		multi = zerolog.MultiLevelWriter(consoleOutput)
	}

	log.Logger = zerolog.New(multi).With().Timestamp().Logger()

	if debug {
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	} else {
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	}
}
