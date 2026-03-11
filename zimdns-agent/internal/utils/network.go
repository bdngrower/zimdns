package utils

import (
	"fmt"
	"io"
	"net"
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

// WaitForPort tenta conectar a um endereço de rede (ex: "tcp", "127.0.53.1:53")
// repetidamente até o timeout ou sucesso. Serve como readiness check.
func WaitForPort(network, addr string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout(network, addr, 500*time.Millisecond)
		if err == nil {
			conn.Close()
			return nil
		}
		time.Sleep(100 * time.Millisecond)
	}
	return fmt.Errorf("timeout waiting for %s %s to become available", network, addr)
}
