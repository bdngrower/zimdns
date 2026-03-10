package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/zimdns/zimdns-doh-proxy/internal/auth"
	"github.com/zimdns/zimdns-doh-proxy/internal/logger"
	"github.com/zimdns/zimdns-doh-proxy/internal/metrics"
	"github.com/zimdns/zimdns-doh-proxy/internal/upstream"
)

func main() {
	log := logger.Log

	// Load ENV
	supabaseUrl := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")
	adguardURL := os.Getenv("ADGUARD_INTERNAL_URL")
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	if supabaseUrl == "" || supabaseKey == "" || adguardURL == "" {
		log.Fatal().Msg("Missing required ENV variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADGUARD_INTERNAL_URL)")
	}

	// Initialize components
	authenticator, err := auth.NewAuthenticator(supabaseUrl, supabaseKey)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize authenticator")
	}

	resolver := upstream.NewResolver(adguardURL)

	// Routes
	http.Handle("/metrics", promhttp.Handler())
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"ok":true,"uptime_s":%d}`, int(time.Since(time.Now()).Seconds()))
	})

	http.HandleFunc("/dns-query", func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// 1. Authenticate
		authHeader := r.Header.Get("Authorization")
		var tokenRaw string
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenRaw = authHeader[7:]
		}

		device, err := authenticator.Authenticate(tokenRaw)
		if err != nil {
			statusCode := http.StatusUnauthorized
			logReason := "unknown"
			
			if err.Error() == "auth.device_revoked" {
				statusCode = http.StatusForbidden
				logReason = "revoked"
			} else if err.Error() == "auth.missing_token" || err.Error() == "auth.invalid_token" {
				statusCode = http.StatusUnauthorized
				logReason = "invalid_token"
			}

			metrics.RequestsTotal.WithLabelValues(logReason).Inc()
			log.Warn().Str("reason", err.Error()).Msg("authentication failed")
			http.Error(w, err.Error(), statusCode)
			return
		}

		// 2. Read DNS query payload (POST or GET)
		var body []byte
		var contentType string

		if r.Method == http.MethodPost {
			body, _ = io.ReadAll(r.Body)
			contentType = r.Header.Get("Content-Type")
		} else if r.Method == http.MethodGet {
			// DoH GET uses ?dns= parameter (base64url)
			dnsParam := r.URL.Query().Get("dns")
			// In production, real DoH implementations handle base64 decoding.
			// For simplicity in this forwarder, we pass what we have if AdGuard supports it,
			// or we decode here. AdGuard Home's DoH path handles the payload if passed correctly.
			// However, AdGuard Home expects the body for POST.
			// For ZIM DNS Agent, we prioritize POST.
		}

		// 3. Forward to AdGuard
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		upstreamStart := time.Now()
		respBody, respContentType, err := resolver.Resolve(ctx, device.ClientID, body, contentType)
		metrics.UpstreamLatency.Observe(float64(time.Since(upstreamStart).Milliseconds()))

		if err != nil {
			log.Error().Err(err).Str("device_id", device.ID).Msg("upstream resolution failed")
			metrics.RequestsTotal.WithLabelValues("upstream_error").Inc()
			http.Error(w, "upstream error", http.StatusServiceUnavailable)
			return
		}

		// 4. Return response
		w.Header().Set("Content-Type", respContentType)
		w.WriteHeader(http.StatusOK)
		w.Write(respBody)

		// 5. Metrics & Final Log
		metrics.RequestsTotal.WithLabelValues("ok").Inc()
		metrics.TotalLatency.Observe(float64(time.Since(start).Milliseconds()))

		log.Info().
			Str("device_id", device.ID).
			Str("client_id", device.ClientID).
			Int64("latency_ms", time.Since(start).Milliseconds()).
			Msg("query resolved")
	})

	log.Info().Str("port", port).Msg("ZIM DNS DoH Proxy starting")
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal().Err(err).Msg("Server failed")
	}
}
