package auth

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/zimdns/agent/internal/config"
	"github.com/zimdns/agent/internal/utils"
	"github.com/rs/zerolog/log"
)

type EnrollRequest struct {
	EnrollmentToken string `json:"enrollment_token"`
	Hostname        string `json:"hostname"`
	OsName          string `json:"os_name"`
	OsVersion       string `json:"os_version"`
}

type EnrollResponse struct {
	DeviceToken  string `json:"device_token"`
	DeviceId     string `json:"device_id"`
	DohUrl       string `json:"doh_url"`
	Intervals    struct {
		Heartbeat int `json:"heartbeat"`
		Inventory int `json:"inventory"`
		Telemetry int `json:"telemetry"`
	} `json:"intervals"`
}

func EnsureEnrolled(bootstrapToken string) error {
	cfg := config.Get()
	if cfg.DeviceToken != "" {
		log.Info().Msg("Device already enrolled")
		return nil
	}

	if bootstrapToken == "" {
		return fmt.Errorf("device not enrolled and no bootstrap token provided")
	}

	log.Info().Msg("Starting device enrollment...")

	osName, osArch := utils.GetOSInfo()
	reqBody := EnrollRequest{
		EnrollmentToken: bootstrapToken,
		Hostname:        utils.GetHostname(),
		OsName:          osName,
		OsVersion:       osArch, // Simplified for v1
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/api/agent/enroll", cfg.ApiUrl)
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("enrollment request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("enrollment failed with status: %d", resp.StatusCode)
	}

	var res EnrollResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return fmt.Errorf("failed to decode enrollment response: %w", err)
	}

	// Update and save config
	return config.Update(func(c *config.AgentConfig) {
		c.DeviceToken = res.DeviceToken
		c.DeviceId = res.DeviceId
		c.DohUrl = res.DohUrl
		c.HeartbeatSec = res.Intervals.Heartbeat
		c.InventoryMin = res.Intervals.Inventory
		c.TelemetryMin = res.Intervals.Telemetry
	})
}

func GetAuthHeader() string {
	cfg := config.Get()
	return fmt.Sprintf("Bearer %s", cfg.DeviceToken)
}

func NewRequest(method, path string, body []byte) (*http.Request, error) {
	cfg := config.Get()
	url := fmt.Sprintf("%s%s", cfg.ApiUrl, path)
	req, err := http.NewRequest(method, url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", GetAuthHeader())
	req.Header.Set("Content-Type", "application/json")
	return req, nil
}
