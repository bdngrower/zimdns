package telemetry

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/zimdns/agent/internal/auth"
)

type HeartbeatPayload struct {
	DohOk        bool    `json:"doh_ok"`
	DohLatencyMs int     `json:"doh_latency_ms"`
	DnsStubOk    bool    `json:"dns_stub_ok"`
	NetworkType  string  `json:"network_type"`
	NetworkSsid  string  `json:"network_ssid"`
	PublicIp     string  `json:"public_ip"`
}

func SendHeartbeat(data HeartbeatPayload) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	req, err := auth.NewRequest("POST", "/api/agent/heartbeat", jsonData)
	if err != nil {
		return err
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("heartbeat failed with status: %d", resp.StatusCode)
	}

	return nil
}

type InventoryPayload struct {
	Cpu             string  `json:"cpu"`
	RamTotalGb      float64 `json:"ram_total_gb"`
	DiskTotalGb     float64 `json:"disk_total_gb"`
	DiskFreeGb      float64 `json:"disk_free_gb"`
	Manufacturer    string  `json:"manufacturer"`
	Model           string  `json:"model"`
	OsName          string  `json:"os_name"`
	OsVersion       string  `json:"os_version"`
	Architecture    string  `json:"architecture"`
	HardwareId      string  `json:"hardware_id"`
}

func SendInventorySnapshot(data InventoryPayload) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	req, err := auth.NewRequest("POST", "/api/agent/inventory", jsonData)
	if err != nil {
		return err
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("inventory update failed with status: %d", resp.StatusCode)
	}

	return nil
}
