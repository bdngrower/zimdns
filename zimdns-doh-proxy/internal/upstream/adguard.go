package upstream

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Resolver struct {
	adguardURL string // Base URL ex: http://10.0.x.x:3000
	httpClient *http.Client
}

func NewResolver(adguardURL string) *Resolver {
	return &Resolver{
		adguardURL: strings.TrimRight(adguardURL, "/"),
		httpClient: &http.Client{
			Timeout: 2 * time.Second,
		},
	}
}

// Resolve forwards the DoH request to AdGuard Home using the ClientID mechanism.
// URL format: http://<adguard>/dns-query/<clientid>
func (r *Resolver) Resolve(ctx context.Context, clientID string, payload []byte, contentType string) ([]byte, string, error) {
	// 1. Construct target URL with ClientID
	// Format: zimdns-{uuid_no_hifens}
	adguardClientID := "zimdns-" + strings.ReplaceAll(clientID, "-", "")
	url := fmt.Sprintf("%s/dns-query/%s", r.adguardURL, adguardClientID)

	// 2. Prepare request
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(payload))
	if err != nil {
		return nil, "", err
	}

	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Accept", "application/dns-message")

	// 3. Execute
	resp, err := r.httpClient.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("upstream.adguard_unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, "", fmt.Errorf("upstream.adguard_error: status %d, body: %s", resp.StatusCode, string(body))
	}

	// 4. Return response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}

	return respBody, resp.Header.Get("Content-Type"), nil
}
