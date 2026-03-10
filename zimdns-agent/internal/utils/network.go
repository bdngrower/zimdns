package utils

import (
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

var (
	cachedPublicIP     string
	publicIPLastUpdate time.Time
	ipMutex            sync.Mutex
)

// GetPublicIP retorna o IP público da máquina usando a api.ipify.org
// Utiliza um cache de 5 minutos para evitar rate limits.
func GetPublicIP() string {
	ipMutex.Lock()
	defer ipMutex.Unlock()

	if time.Since(publicIPLastUpdate) < 5*time.Minute && cachedPublicIP != "" {
		return cachedPublicIP
	}

	client := http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("https://api.ipify.org")
	if err == nil {
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		if err == nil {
			cachedPublicIP = strings.TrimSpace(string(body))
			publicIPLastUpdate = time.Now()
			return cachedPublicIP
		}
	}

	return cachedPublicIP // retorna o último IP válido caso falhe, ou string vazia
}
