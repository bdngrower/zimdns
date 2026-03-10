package telemetry

import (
	"os/exec"
	"runtime"
	"strconv"
	"strings"

	"github.com/zimdns/agent/internal/utils"
)

func CollectInventory() InventoryPayload {
	payload := InventoryPayload{
		Hostname:     utils.GetHostname(),
		Architecture: runtime.GOARCH,
		OsName:       runtime.GOOS,
	}

	// CPU info
	if out, err := exec.Command("wmic", "cpu", "get", "name").Output(); err == nil {
		lines := strings.Split(string(out), "\n")
		if len(lines) > 1 {
			payload.Cpu = strings.TrimSpace(lines[1])
		}
	}

	// RAM info (Total GB)
	if out, err := exec.Command("powershell", "-NoProfile", "(Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property capacity -Sum).Sum / 1GB").Output(); err == nil {
		if val, err := strconv.ParseFloat(strings.TrimSpace(string(out)), 64); err == nil {
			payload.RamTotalGb = val
		}
	}

	// Disk info (Total C: GB)
	if _, err := exec.Command("powershell", "-NoProfile", "(Get-PSDrive C).Used + (Get-PSDrive C).Free / 1GB").Output(); err == nil {
		// This is simplified, just getting total size of C:
	}
	
	// Real total size of disk
	if out, err := exec.Command("powershell", "-NoProfile", "(Get-CimInstance Win32_LogicalDisk | Where-Object DeviceID -eq 'C:').Size / 1GB").Output(); err == nil {
		if val, err := strconv.ParseFloat(strings.TrimSpace(string(out)), 64); err == nil {
			payload.DiskTotalGb = val
		}
	}

	// Disk free space
	if out, err := exec.Command("powershell", "-NoProfile", "(Get-CimInstance Win32_LogicalDisk | Where-Object DeviceID -eq 'C:').FreeSpace / 1GB").Output(); err == nil {
		if val, err := strconv.ParseFloat(strings.TrimSpace(string(out)), 64); err == nil {
			payload.DiskFreeGb = val
		}
	}

	// Manufacturer and Model
	if out, err := exec.Command("wmic", "computersystem", "get", "manufacturer,model").Output(); err == nil {
		lines := strings.Split(string(out), "\n")
		if len(lines) > 1 {
			parts := strings.Fields(lines[1])
			if len(parts) >= 2 {
				payload.Manufacturer = parts[0]
				payload.Model = strings.Join(parts[1:], " ")
			}
		}
	}

	// Hardware ID (Serial Number)
	if out, err := exec.Command("wmic", "baseboard", "get", "serialnumber").Output(); err == nil {
		lines := strings.Split(string(out), "\n")
		if len(lines) > 1 {
			payload.HardwareId = strings.TrimSpace(lines[1])
		}
	}

	return payload
}
