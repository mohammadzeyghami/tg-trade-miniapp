// Package tgauth validates Telegram WebApp initData server-side.
//
// Security model (the point of this package): everything the mini-app's
// frontend sends can be forged by the user — EXCEPT initData, which Telegram
// signs. The check, per Telegram's spec:
//
//	secret     = HMAC_SHA256(key="WebAppData", message=botToken)
//	expected   = HMAC_SHA256(key=secret, message=dataCheckString)
//	dataCheckString = all key=value pairs except "hash",
//	                  sorted by key, joined with "\n"
//
// A valid signature proves the payload came from Telegram for OUR bot, and
// auth_date bounds replay. Identity therefore derives ONLY from validated
// initData — never from a user-supplied id.
package tgauth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

var (
	ErrBadSignature = errors.New("initData signature invalid")
	ErrExpired      = errors.New("initData too old")
	ErrMalformed    = errors.New("initData malformed")
)

type User struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name"`
	Username  string `json:"username"`
}

// Validate checks initData against botToken and returns the Telegram user.
// maxAge bounds replay of captured initData (Telegram recommends checking
// auth_date; 24h is a common ceiling for a session-bootstrap use).
func Validate(initData, botToken string, maxAge time.Duration, now time.Time) (*User, error) {
	values, err := url.ParseQuery(initData)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrMalformed, err)
	}
	gotHash := values.Get("hash")
	if gotHash == "" {
		return nil, fmt.Errorf("%w: no hash", ErrMalformed)
	}

	keys := make([]string, 0, len(values))
	for k := range values {
		if k != "hash" {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	lines := make([]string, 0, len(keys))
	for _, k := range keys {
		lines = append(lines, k+"="+values.Get(k))
	}
	dataCheckString := strings.Join(lines, "\n")

	secret := hmacSHA256([]byte("WebAppData"), []byte(botToken))
	expected := hex.EncodeToString(hmacSHA256(secret, []byte(dataCheckString)))
	// constant-time compare — a timing oracle on auth material is still a bug
	if !hmac.Equal([]byte(expected), []byte(gotHash)) {
		return nil, ErrBadSignature
	}

	authDate, err := strconv.ParseInt(values.Get("auth_date"), 10, 64)
	if err != nil {
		return nil, fmt.Errorf("%w: bad auth_date", ErrMalformed)
	}
	if now.Sub(time.Unix(authDate, 0)) > maxAge {
		return nil, ErrExpired
	}

	var u User
	if err := json.Unmarshal([]byte(values.Get("user")), &u); err != nil || u.ID == 0 {
		return nil, fmt.Errorf("%w: bad user", ErrMalformed)
	}
	return &u, nil
}

func hmacSHA256(key, msg []byte) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write(msg)
	return mac.Sum(nil)
}

// Sign builds a valid initData string — used by tests and by dev mode to
// exercise the exact same validation path as production.
func Sign(params url.Values, botToken string) string {
	keys := make([]string, 0, len(params))
	for k := range params {
		if k != "hash" {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	lines := make([]string, 0, len(keys))
	for _, k := range keys {
		lines = append(lines, k+"="+params.Get(k))
	}
	secret := hmacSHA256([]byte("WebAppData"), []byte(botToken))
	params.Set("hash", hex.EncodeToString(hmacSHA256(secret, []byte(strings.Join(lines, "\n")))))
	return params.Encode()
}
