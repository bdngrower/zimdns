package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"

	"github.com/rs/zerolog/log"
)

type AgentConfig struct {
	ApiUrl          string `json:"api_url"`
	DeviceToken     string `json:"device_token,omitempty"`
	DeviceId        string `json:"device_id,omitempty"`
	DohUrl          string `json:"doh_url,omitempty"`
	HeartbeatSec    int    `json:"heartbeat_sec"`
	InventoryMin    int    `json:"inventory_min"`
	TelemetryMin    int    `json:"telemetry_min"`
}

var (
	configInstance *AgentConfig
	configMutex    sync.RWMutex
)

func GetConfigPath() string {
	if runtime.GOOS == "windows" {
		return filepath.Join(os.Getenv("ProgramData"), "ZimDNS", "config.json")
	}
	// Fallback for dev on non-windows
	return "config.json"
}

func Load() (*AgentConfig, error) {
	configMutex.Lock()
	defer configMutex.Unlock()

	path := GetConfigPath()
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// Return default config
			configInstance = &AgentConfig{
				ApiUrl:       "https://zimdns.com.br", // Default Prod URL
				HeartbeatSec: 60,
				InventoryMin: 720,
				TelemetryMin: 5,
			}
			return configInstance, nil
		}
		return nil, err
	}

	var cfg AgentConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}

	configInstance = &cfg
	return configInstance, nil
}

func (c *AgentConfig) Save() error {
	configMutex.Lock()
	defer configMutex.Unlock()

	path := GetConfigPath()
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0600)
}

func Get() *AgentConfig {
	configMutex.RLock()
	defer configMutex.RUnlock()
	return configInstance
}

func Update(fn func(*AgentConfig)) error {
	configMutex.Lock()
	cfg := configInstance
	fn(cfg)
	configMutex.Unlock()
	return cfg.Save()
}
