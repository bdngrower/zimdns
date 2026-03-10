package utils

import (
	"os"
	"runtime"
)

func GetHostname() string {
	hostname, err := os.Hostname()
	if err != nil {
		return "unknown-host"
	}
	return hostname
}

func GetOSInfo() (string, string) {
	return runtime.GOOS, runtime.GOARCH
}
