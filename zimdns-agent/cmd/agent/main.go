package main

import (
	"flag"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/zimdns/agent/internal/auth"
	"github.com/zimdns/agent/internal/config"
	"github.com/zimdns/agent/internal/dns"
	"github.com/zimdns/agent/internal/telemetry"
	"github.com/zimdns/agent/internal/utils"
	"github.com/rs/zerolog/log"
)

func main() {
	bootstrapToken := flag.String("enroll", "", "Bootstrap token for first-time enrollment")
	debug := flag.Bool("debug", false, "Enable debug logging")
	flag.Parse()

	// 1. Init logger
	utils.InitLogger(*debug)
	log.Info().Msg("ZIM DNS Agent v1 starting...")

	// 2. Load/Init config
	if _, err := config.Load(); err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	// 3. Ensure enrollment
	// Priority: 1. Flag, 2. Env var, 3. Config (empty)
	token := *bootstrapToken
	if token == "" {
		token = os.Getenv("ZIMDNS_ENROLL_TOKEN")
	}

	if err := auth.EnsureEnrolled(token); err != nil {
		log.Fatal().Err(err).Msg("Device enrollment failed")
	}
	
	// Refresh config after enrollment (internal state is already updated)

	// 4. Start DNS Stub
	dnsServer := dns.NewServer()
	if err := dnsServer.Start("127.0.53.1:53"); err != nil {
		log.Fatal().Err(err).Msg("Failed to start DNS stub")
	}

	// 5. Start Telemetry Loops
	go heartbeatLoop()
	go inventoryLoop()
	go configPollLoop()

	// 6. Graceful Shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	log.Info().Msg("ZIM DNS Agent is running and protecting this device")
	<-stop

	log.Info().Msg("Shutting down ZIM DNS Agent...")
	dnsServer.Stop()
	log.Info().Msg("ZIM DNS Agent stopped")
}

func heartbeatLoop() {
	cfg := config.Get()
	ticker := time.NewTicker(time.Duration(cfg.HeartbeatSec) * time.Second)
	defer ticker.Stop()

	// Immediate first heartbeat
	sendHB()

	for range ticker.C {
		sendHB()
	}
}

func sendHB() {
	// In v1, we assume network info collection is simple
	hb := telemetry.HeartbeatPayload{
		DohOk:        true, // This should be checked by probing the proxy
		DohLatencyMs: 10,   // Placeholder
		DnsStubOk:    true,
		NetworkType:  "ethernet",
		PublicIp:     "", // Backend will detect public IP
	}
	if err := telemetry.SendHeartbeat(hb); err != nil {
		log.Warn().Err(err).Msg("Failed to send heartbeat")
	}
}

func inventoryLoop() {
	cfg := config.Get()
	ticker := time.NewTicker(time.Duration(cfg.InventoryMin) * time.Minute)
	defer ticker.Stop()

	// Immediate first inventory
	sendInv()

	for range ticker.C {
		sendInv()
	}
}

func sendInv() {
	inv := telemetry.CollectInventory()
	if err := telemetry.SendInventorySnapshot(inv); err != nil {
		log.Warn().Err(err).Msg("Failed to send inventory snapshot")
	} else {
		log.Info().Msg("Inventory snapshot sent successfully")
	}
}

func configPollLoop() {
	// Poll every 5 minutes for revocation or config changes
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		// This would call GET /api/agent/config
		// Implement polling logic if needed for v1
		log.Debug().Msg("Polling for configuration updates...")
	}
}
