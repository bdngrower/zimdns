.PHONY: build-agent build-proxy build-all

# Main build target
build-all: build-agent build-proxy

# Build Windows Agent (requires Go)
build-agent:
	@echo "Building ZIM DNS Agent for Windows..."
	cd zimdns-agent && go build -o bin/zimdns-agent.exe ./cmd/agent

# Build DoH Proxy Docker Image (requires Docker)
build-proxy:
	@echo "Building ZIM DNS DoH Proxy Docker Image..."
	cd zimdns-doh-proxy && docker build -t zimdns-doh-proxy:latest .

# Install dependencies (requires Go)
install-deps:
	cd zimdns-agent && go mod tidy
	cd zimdns-doh-proxy && go mod tidy

# Test all components
test:
	@echo "Running backend/frontend tests (placeholder)..."
	npm test
	@echo "Running Go tests..."
	cd zimdns-agent && go test ./...
	cd zimdns-doh-proxy && go test ./...
