// The mini-app backend: exchange initData for a session, then proxy an
// allowlisted set of exchange endpoints with the session's identity as
// X-User. The client never chooses its own user id — that is the entire
// security story of a Telegram mini-app, so it lives server-side here.
package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/mohammadzeyghami/tg-trade-miniapp/internal/tgauth"
)

type Config struct {
	BotToken    string
	ExchangeURL string // e.g. http://localhost:8140
	DevMode     bool   // accepts {"devUser": "..."} logins — local dev only
}

type session struct {
	userID string // "tg:<id>"
	name   string
}

type Server struct {
	cfg      Config
	client   *http.Client
	mu       sync.Mutex
	sessions map[string]session
}

func New(cfg Config) *Server {
	return &Server{
		cfg:      cfg,
		client:   &http.Client{Timeout: 10 * time.Second},
		sessions: map[string]session{},
	}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /auth", s.auth)
	mux.HandleFunc("GET /api/orderbook", s.proxy("GET", "/api/orderbook"))
	mux.HandleFunc("GET /api/trades", s.proxy("GET", "/api/trades"))
	mux.HandleFunc("GET /api/balances", s.proxy("GET", "/api/balances"))
	mux.HandleFunc("GET /api/orders", s.proxy("GET", "/api/orders"))
	mux.HandleFunc("POST /api/orders", s.proxy("POST", "/api/orders"))
	mux.HandleFunc("DELETE /api/orders/{id}", s.proxyCancel)
	mux.HandleFunc("GET /api/me", s.me)
	return withCORS(mux)
}

// ---- auth ----

func (s *Server) auth(w http.ResponseWriter, r *http.Request) {
	var req struct {
		InitData string `json:"initData"`
		DevUser  string `json:"devUser"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpErr(w, http.StatusBadRequest, "invalid json")
		return
	}

	var sess session
	switch {
	case req.InitData != "":
		u, err := tgauth.Validate(req.InitData, s.cfg.BotToken, 24*time.Hour, time.Now())
		if err != nil {
			if errors.Is(err, tgauth.ErrExpired) {
				httpErr(w, http.StatusUnauthorized, "session expired — reopen the mini app")
				return
			}
			httpErr(w, http.StatusUnauthorized, "invalid initData")
			return
		}
		name := u.FirstName
		if u.Username != "" {
			name = "@" + u.Username
		}
		sess = session{userID: userIDFor(u.ID), name: name}
	case s.cfg.DevMode && req.DevUser != "":
		sess = session{userID: "dev:" + req.DevUser, name: req.DevUser + " (dev)"}
	default:
		httpErr(w, http.StatusUnauthorized, "initData required")
		return
	}

	// paper-money faucet on every login — idempotent on the exchange side
	if err := s.exchangeFaucet(sess.userID); err != nil {
		log.Printf("faucet for %s: %v", sess.userID, err)
	}

	buf := make([]byte, 32)
	_, _ = rand.Read(buf)
	token := hex.EncodeToString(buf)
	s.mu.Lock()
	s.sessions[token] = sess
	s.mu.Unlock()

	writeJSON(w, http.StatusOK, map[string]string{
		"token": token, "userId": sess.userID, "name": sess.name,
	})
}

func userIDFor(tgID int64) string {
	return "tg:" + itoa(tgID)
}

func itoa(v int64) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func (s *Server) sessionOf(r *http.Request) (session, bool) {
	tok := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	s.mu.Lock()
	defer s.mu.Unlock()
	sess, ok := s.sessions[tok]
	return sess, ok
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	sess, ok := s.sessionOf(r)
	if !ok {
		httpErr(w, http.StatusUnauthorized, "no session")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"userId": sess.userID, "name": sess.name})
}

// ---- exchange proxy ----

func (s *Server) exchangeFaucet(userID string) error {
	req, _ := http.NewRequest(http.MethodPost, s.cfg.ExchangeURL+"/api/faucet", nil)
	req.Header.Set("X-User", userID)
	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

func (s *Server) proxy(method, path string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		s.forward(w, r, method, path)
	}
}

func (s *Server) proxyCancel(w http.ResponseWriter, r *http.Request) {
	s.forward(w, r, http.MethodDelete, "/api/orders/"+r.PathValue("id"))
}

func (s *Server) forward(w http.ResponseWriter, r *http.Request, method, path string) {
	sess, ok := s.sessionOf(r)
	if !ok {
		httpErr(w, http.StatusUnauthorized, "no session")
		return
	}
	url := s.cfg.ExchangeURL + path
	if r.URL.RawQuery != "" {
		url += "?" + r.URL.RawQuery
	}
	req, err := http.NewRequestWithContext(r.Context(), method, url, r.Body)
	if err != nil {
		httpErr(w, http.StatusInternalServerError, "proxy error")
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User", sess.userID) // identity comes from the session, period
	resp, err := s.client.Do(req)
	if err != nil {
		httpErr(w, http.StatusBadGateway, "exchange unreachable")
		return
	}
	defer resp.Body.Close()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

// ---- plumbing ----

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func httpErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
