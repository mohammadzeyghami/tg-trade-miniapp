package tgauth

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
	"testing"
	"time"
)

const token = "1234567:TEST_FAKE_BOT_TOKEN"

func validInitData(t *testing.T, authDate time.Time) string {
	t.Helper()
	v := url.Values{}
	v.Set("auth_date", fmt.Sprintf("%d", authDate.Unix()))
	v.Set("query_id", "AAF9tEs3AAAAAH20SzdVL60O")
	v.Set("user", `{"id":42,"first_name":"Mohammad","username":"mz"}`)
	return Sign(v, token)
}

func TestValidateAccepts(t *testing.T) {
	now := time.Now()
	u, err := Validate(validInitData(t, now), token, 24*time.Hour, now)
	if err != nil {
		t.Fatal(err)
	}
	if u.ID != 42 || u.Username != "mz" {
		t.Fatalf("user: %+v", u)
	}
}

func TestValidateRejectsTampering(t *testing.T) {
	now := time.Now()
	data := validInitData(t, now)
	// attacker swaps the user id, keeps the hash
	tampered := strings.Replace(data, "%22id%22%3A42", "%22id%22%3A666", 1)
	if tampered == data {
		t.Fatal("tampering did not change the payload")
	}
	if _, err := Validate(tampered, token, 24*time.Hour, now); !errors.Is(err, ErrBadSignature) {
		t.Fatalf("want ErrBadSignature, got %v", err)
	}
}

func TestValidateRejectsWrongBotToken(t *testing.T) {
	now := time.Now()
	data := validInitData(t, now)
	if _, err := Validate(data, "other-bot-token", 24*time.Hour, now); !errors.Is(err, ErrBadSignature) {
		t.Fatalf("want ErrBadSignature, got %v", err)
	}
}

func TestValidateRejectsReplay(t *testing.T) {
	now := time.Now()
	old := validInitData(t, now.Add(-48*time.Hour))
	if _, err := Validate(old, token, 24*time.Hour, now); !errors.Is(err, ErrExpired) {
		t.Fatalf("want ErrExpired, got %v", err)
	}
}
