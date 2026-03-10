package auth

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

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

func EnsureEnrolled(input string) error {
	cfg := config.Get()
	if cfg.DeviceToken != "" {
		log.Info().Msg("Device already enrolled, skipping bootstrap")
		return nil
	}

	if input == "" {
		return fmt.Errorf("device not enrolled and no bootstrap token provided")
	}

	bootstrapToken := input
	apiUrl := cfg.ApiUrl

	// If input looks like a URL, parse it
	if strings.Contains(input, "://") {
		log.Info().Msgf("Bootstrap URL detected: %s", input)
		u, err := url.Parse(input)
		if err == nil {
			// Extract token from query param
			tokenParam := u.Query().Get("token")
			if tokenParam != "" {
				bootstrapToken = tokenParam
				// Extract base API URL (e.g., https://zimdns.vercel.app from https://zimdns.vercel.app/api/agent/enroll?token=...)
				apiUrl = fmt.Sprintf("%s://%s", u.Scheme, u.Host)
				log.Info().Msgf("Extracted token starting with %s... and ApiUrl %s", bootstrapToken[:min(5, len(bootstrapToken))], apiUrl)
				
				// Update ApiUrl in config temporarily for this enrollment
				_ = config.Update(func(c *config.AgentConfig) {
					c.ApiUrl = apiUrl
				})
			}
		}
	} else {
		log.Info().Msgf("Using raw bootstrap token starting with %s...", bootstrapToken[:min(5, len(bootstrapToken))])
	}

	log.Info().Msg("Starting device enrollment request...")

	osName, osArch := utils.GetOSInfo()
	reqBody := EnrollRequest{
		EnrollmentToken: bootstrapToken,
		Hostname:        utils.GetHostname(),
		OsName:          osName,
		OsVersion:       osArch,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return err
	}

	endpoint := fmt.Sprintf("%s/api/agent/enroll", apiUrl)
	log.Debug().Msgf("POST %s", endpoint)
	
	resp, err := http.Post(endpoint, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("enrollment request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		var errResp struct{ Error string `json:"error"` }
		_ = json.NewDecoder(resp.Body).Decode(&errResp)
		return fmt.Errorf("enrollment failed with status %d: %s", resp.StatusCode, errResp.Error)
	}

	var res EnrollResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return fmt.Errorf("failed to decode enrollment response: %w", err)
	}

	log.Info().Msgf("Enrollment successful! DeviceID: %s", res.DeviceId)

	// Update and save config permanently
	return config.Update(func(c *config.AgentConfig) {
		c.DeviceToken = res.DeviceToken
		c.DeviceId = res.DeviceId
		c.DohUrl = res.DohUrl
		c.HeartbeatSec = res.Intervals.Heartbeat
		if c.HeartbeatSec == 0 { c.HeartbeatSec = 60 }
		c.InventoryMin = res.Intervals.Inventory
		if c.InventoryMin == 0 { c.InventoryMin = 60 }
		c.TelemetryMin = res.Intervals.Telemetry
		if c.TelemetryMin == 0 { c.TelemetryMin = 5 }
	})
}

func min(a, b int) int {
	if a < b { return a }
	return b
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
