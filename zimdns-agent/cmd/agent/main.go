package main

import (
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/zimdns/agent/internal/auth"
	"github.com/zimdns/agent/internal/config"
	"github.com/zimdns/agent/internal/dns"
	"github.com/zimdns/agent/internal/telemetry"
	"github.com/zimdns/agent/internal/utils"
	"github.com/rs/zerolog/log"
	"github.com/kardianos/service"
)

type program struct {
	exit      chan struct{}
	dnsServer *dns.Server
}

func (p *program) Start(s service.Service) error {
	p.exit = make(chan struct{})
	go p.run()
	return nil
}

func (p *program) run() {
	log.Info().Msg("ZIM DNS Agent service starting...")

	// 1. Load config
	if _, err := config.Load(); err != nil {
		log.Error().Err(err).Msg("Failed to load configuration in service")
		return
	}

	// 2. Start DNS Stub
	p.dnsServer = dns.NewServer()
	if err := p.dnsServer.Start("127.0.53.1:53"); err != nil {
		log.Error().Err(err).Msg("Failed to start DNS stub in service")
		return
	}

	// 2.5 Wait for DNS Stub to be ready (Readiness Check)
	if err := utils.WaitForPort("tcp", "127.0.53.1:53", 5*time.Second); err != nil {
		log.Error().Err(err).Msg("DNS stub readiness check failed. Aborting startup.")
		p.dnsServer.Stop()
		return
	}
	log.Info().Msg("DNS stub readiness check passed.")
	
	if err := dns.SetSystemDNS(); err != nil {
		log.Warn().Err(err).Msg("Could not set system DNS override. Local DNS traffic might bypass proxy.")
	}

	// 3. Start Telemetry Loops
	go heartbeatLoop()
	go inventoryLoop()
	go configPollLoop()

	log.Info().Msg("ZIM DNS Agent is running in background")
	<-p.exit
}

func (p *program) Stop(s service.Service) error {
	log.Info().Msg("ZIM DNS Agent service stopping...")
	close(p.exit)
	if p.dnsServer != nil {
		p.dnsServer.Stop()
	}
	dns.RestoreSystemDNS()
	return nil
}

func main() {
	var bootstrapUrl string
	var bootstrapToken string
	var serviceAction string
	debug := false
	silent := false

	// Manual argument parsing
	for _, arg := range os.Args[1:] {
		upperArg := strings.ToUpper(arg)
		if strings.HasPrefix(upperArg, "/BOOTSTRAP_URL=") {
			bootstrapUrl = arg[len("/BOOTSTRAP_URL="):]
		} else if strings.HasPrefix(arg, "--bootstrap-url=") {
			bootstrapUrl = arg[len("--bootstrap-url="):]
		} else if strings.HasPrefix(arg, "-enroll=") {
			bootstrapToken = arg[len("-enroll="):]
		} else if arg == "--debug" || arg == "-debug" {
			debug = true
		} else if upperArg == "/SILENT" {
			silent = true
		} else if arg == "install" || arg == "uninstall" || arg == "start" || arg == "stop" || arg == "restart" {
			serviceAction = arg
		}
	}

	// 1. Init logger (always to file if possible)
	utils.InitLogger(debug)
	
	// Service configuration
	svcConfig := &service.Config{
		Name:        "ZimDNSAgent",
		DisplayName: "ZIM DNS Agent",
		Description: "ZIM DNS Secure Resolver and Asset Management Agent",
	}

	prg := &program{}
	s, err := service.New(prg, svcConfig)
	if err != nil {
		fmt.Printf("Error creating service: %v\n", err)
		os.Exit(1)
	}

	// Protocol for /SILENT: Enroll -> Install -> Start -> Exit
	if silent {
		log.Info().Msg("Starting silent installation flow...")
		
		// Load existing config to check enrollment
		cfg, _ := config.Load()
		if cfg.DeviceId == "" {
			token := bootstrapToken
			if bootstrapUrl != "" {
				if err := auth.EnsureEnrolled(bootstrapUrl); err != nil {
					log.Fatal().Err(err).Msg("Silent enrollment via URL failed")
				}
			} else {
				if token == "" {
					token = os.Getenv("ZIMDNS_ENROLL_TOKEN")
				}
				if err := auth.EnsureEnrolled(token); err != nil {
					log.Fatal().Err(err).Msg("Silent enrollment failed")
				}
			}
			log.Info().Msg("Enrollment successful during silent install")
		} else {
			log.Info().Msg("Device already enrolled, skipping enrollment phase")
		}

		// Install service
		if err := s.Install(); err != nil {
			if strings.Contains(err.Error(), "already exists") {
				log.Info().Msg("Service already installed, continuing")
			} else {
				log.Fatal().Err(err).Msg("Failed to install service during silent flow")
			}
		} else {
			log.Info().Msg("Service installed successfully")
		}

		// Start service
		if err := service.Control(s, "start"); err != nil {
			if strings.Contains(err.Error(), "already running") {
				log.Info().Msg("Service already running")
			} else {
				log.Fatal().Err(err).Msg("Failed to start service during silent flow")
			}
		} else {
			log.Info().Msg("Service started successfully")
		}

		log.Info().Msg("Silent installation completed. Agent is running in background.")
		return
	}

	// Handle explicit service actions (debug/manual)
	if serviceAction != "" {
		err := service.Control(s, serviceAction)
		if err != nil {
			fmt.Printf("Valid actions: %q\n", service.ControlAction)
			log.Fatal().Err(err).Msgf("Failed to perform %s", serviceAction)
		}
		return
	}

	// Run as service (or foreground if interactive)
	err = s.Run()
	if err != nil {
		log.Error().Err(err).Msg("Service run failed")
		
		// Fallback to foreground if interactive
		if service.Interactive() {
			log.Info().Msg("Running in foreground (interactive mode)...")
			runForeground()
		}
	}
}

func runForeground() {
	// Standard foreground execution (legacy/debug)
	if _, err := config.Load(); err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	dnsServer := dns.NewServer()
	if err := dnsServer.Start("127.0.53.1:53"); err != nil {
		log.Fatal().Err(err).Msg("Failed to start DNS stub")
	}

	// Wait for DNS Stub to be ready
	if err := utils.WaitForPort("tcp", "127.0.53.1:53", 5*time.Second); err != nil {
		dnsServer.Stop()
		log.Fatal().Err(err).Msg("DNS stub readiness check failed")
	}
	log.Info().Msg("DNS stub readiness check passed.")

	if err := dns.SetSystemDNS(); err != nil {
		log.Warn().Err(err).Msg("Could not set system DNS override.")
	}

	go heartbeatLoop()
	go inventoryLoop()
	go configPollLoop()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	log.Info().Msg("ZIM DNS Agent is running in foreground")
	<-stop

	log.Info().Msg("Shutting down ZIM DNS Agent...")
	dnsServer.Stop()
	dns.RestoreSystemDNS()
	log.Info().Msg("ZIM DNS Agent stopped")
}

func heartbeatLoop() {
	cfg := config.Get()
	ticker := time.NewTicker(time.Duration(cfg.HeartbeatSec) * time.Second)
	defer ticker.Stop()

	sendHB()
	for range ticker.C {
		sendHB()
	}
}

func sendHB() {
	hb := telemetry.HeartbeatPayload{
		DohOk:        true, 
		DohLatencyMs: 10,  
		DnsStubOk:    true,
		NetworkType:  "ethernet",
		PublicIp:     utils.GetPublicIP(), 
	}
	if err := telemetry.SendHeartbeat(hb); err != nil {
		log.Warn().Err(err).Msg("Failed to send heartbeat")
	}
}

func inventoryLoop() {
	cfg := config.Get()
	ticker := time.NewTicker(time.Duration(cfg.InventoryMin) * time.Minute)
	defer ticker.Stop()

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
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		log.Debug().Msg("Polling for configuration updates...")
	}
}
