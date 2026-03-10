package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/jellydator/ttlcache/v3"
	"github.com/supabase-community/supabase-go"
)

type DeviceInfo struct {
	ID             string
	ClientID       string
	ClientPolicyID string
	Status         string
}

type Authenticator struct {
	cache    *ttlcache.Cache[string, *DeviceInfo]
	supabase *supabase.Client
}

func NewAuthenticator(supabaseUrl, supabaseKey string) (*Authenticator, error) {
	client, err := supabase.NewClient(supabaseUrl, supabaseKey, nil)
	if err != nil {
		return nil, err
	}

	cache := ttlcache.New[string, *DeviceInfo](
		ttlcache.WithTTL[string, *DeviceInfo](30 * time.Second),
	)

	go cache.Start()

	return &Authenticator{
		cache:    cache,
		supabase: client,
	}, nil
}

// Authenticate validates a Bearer token and returns DeviceInfo.
// Uses an in-memory TTL cache to minimize Supabase lookups.
func (a *Authenticator) Authenticate(tokenRaw string) (*DeviceInfo, error) {
	if tokenRaw == "" {
		return nil, errors.New("auth.missing_token")
	}

	hash := hashToken(tokenRaw)

	// 1. Check Cache
	if item := a.cache.Get(hash); item != nil {
		return item.Value(), nil
	}

	// 2. Cache Miss -> Supabase Lookup
	device, err := a.lookupDevice(hash)
	if err != nil {
		return nil, err
	}

	// 3. Store in Cache (even if status is revoked, to prevent DB spam)
	a.cache.Set(hash, device, ttlcache.DefaultTTL)

	return device, nil
}

func (a *Authenticator) lookupDevice(hash string) (*DeviceInfo, error) {
	var result []struct {
		ID             string `json:"id"`
		ClientID       string `json:"client_id"`
		ClientPolicyID string `json:"client_policy_id"`
		Status         string `json:"status"`
	}

	_, err := a.supabase.From("devices").
		Select("id, client_id, client_policy_id, status", "exact", false).
		Eq("device_token_hash", hash).
		ExecuteTo(&result)

	if err != nil {
		return nil, err
	}

	if len(result) == 0 {
		return nil, errors.New("auth.invalid_token")
	}

	device := result[0]
	if device.Status == "revoked" {
		return nil, errors.New("auth.device_revoked")
	}

	if device.Status != "active" {
		return nil, errors.New("auth.device_inactive")
	}

	return &DeviceInfo{
		ID:             device.ID,
		ClientID:       device.ClientID,
		ClientPolicyID: device.ClientPolicyID,
		Status:         device.Status,
	}, nil
}

func hashToken(token string) string {
	h := sha256.New()
	h.Write([]byte(token))
	return hex.EncodeToString(h.Sum(nil))
}
