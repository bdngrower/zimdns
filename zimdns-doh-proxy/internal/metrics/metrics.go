package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	RequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "zimdns_doh_requests_total",
		Help: "Total number of DoH requests",
	}, []string{"status"})

	UpstreamLatency = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "zimdns_doh_upstream_latency_ms",
		Help:    "Latency of upstream AdGuard queries in milliseconds",
		Buckets: prometheus.DefBuckets,
	})

	TotalLatency = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "zimdns_doh_total_latency_ms",
		Help:    "Total latency of DoH requests in milliseconds",
		Buckets: prometheus.DefBuckets,
	})

	CacheHits = promauto.NewCounter(prometheus.CounterOpts{
		Name: "zimdns_doh_cache_hits_total",
		Help: "Total number of auth cache hits",
	})

	CacheMisses = promauto.NewCounter(prometheus.CounterOpts{
		Name: "zimdns_doh_cache_misses_total",
		Help: "Total number of auth cache misses",
	})
)
