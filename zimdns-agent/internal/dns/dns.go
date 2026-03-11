package dns

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/miekg/dns"
	"github.com/zimdns/agent/internal/config"
	"github.com/rs/zerolog/log"
)

type Server struct {
	udpServer *dns.Server
	tcpServer *dns.Server
	client    *http.Client
	mu        sync.RWMutex
}

func NewServer() *Server {
	return &Server{
		client: &http.Client{
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS12},
				MaxIdleConns:    100,
				IdleConnTimeout: 90 * time.Second,
			},
			Timeout: 5 * time.Second,
		},
	}
}

func (s *Server) Start(addr string) error {
	s.udpServer = &dns.Server{Addr: addr, Net: "udp", Handler: s}
	s.tcpServer = &dns.Server{Addr: addr, Net: "tcp", Handler: s}

	errChan := make(chan error, 2)

	go func() {
		log.Info().Msgf("DNS Stub listening on UDP %s (Fail-Closed Mode)", addr)
		if err := s.udpServer.ListenAndServe(); err != nil {
			errChan <- fmt.Errorf("UDP server failed: %w", err)
		}
	}()

	go func() {
		log.Info().Msgf("DNS Stub listening on TCP %s (Fail-Closed Mode)", addr)
		if err := s.tcpServer.ListenAndServe(); err != nil {
			errChan <- fmt.Errorf("TCP server failed: %w", err)
		}
	}()

	// Wait for any errors
	select {
	case err := <-errChan:
		return err
	case <-time.After(500 * time.Millisecond):
		// Assume started ok
		return nil
	}
}

func (s *Server) Stop() {
	if s.udpServer != nil {
		s.udpServer.Shutdown()
	}
	if s.tcpServer != nil {
		s.tcpServer.Shutdown()
	}
}

func (s *Server) ServeDNS(w dns.ResponseWriter, r *dns.Msg) {
	s.mu.RLock()
	dohUrl := config.Get().DohUrl
	s.mu.RUnlock()

	if dohUrl == "" {
		log.Warn().Msg("DohUrl not configured, dropping query")
		dns.HandleFailed(w, r)
		return
	}

	// Pack DNS message for DoH
	packed, err := r.Pack()
	if err != nil {
		log.Error().Err(err).Msg("Failed to pack DNS message")
		dns.HandleFailed(w, r)
		return
	}

	// Forward to DoH
	respData, err := s.forwardToDoH(dohUrl, packed)
	if err != nil {
		log.Error().Err(err).Msg("DoH forwarding failed")
		dns.HandleFailed(w, r)
		return
	}

	// Unpack response
	respMsg := new(dns.Msg)
	if err := respMsg.Unpack(respData); err != nil {
		log.Error().Err(err).Msg("Failed to unpack DoH response")
		dns.HandleFailed(w, r)
		return
	}

	// Match ID with original query
	respMsg.Id = r.Id
	w.WriteMsg(respMsg)
}

func (s *Server) forwardToDoH(url string, data []byte) ([]byte, error) {
	req, err := http.NewRequest("POST", url, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/dns-message")
	req.Header.Set("Accept", "application/dns-message")
	
	s.mu.RLock()
	deviceToken := config.Get().DeviceToken
	s.mu.RUnlock()
	
	if deviceToken != "" {
		req.Header.Set("Authorization", "Bearer "+deviceToken)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("upstream DoH returned status %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}
