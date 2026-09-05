package main

import (
	"log"
	"net/http"
	"os"

	"github.com/mohammadzeyghami/tg-trade-miniapp/internal/api"
)

func main() {
	cfg := api.Config{
		BotToken:    os.Getenv("BOT_TOKEN"),
		ExchangeURL: os.Getenv("EXCHANGE_URL"),
		DevMode:     os.Getenv("TG_DEV_MODE") == "true",
	}
	if cfg.ExchangeURL == "" {
		cfg.ExchangeURL = "http://localhost:8140"
	}
	if cfg.BotToken == "" && !cfg.DevMode {
		log.Println("WARNING: BOT_TOKEN empty and TG_DEV_MODE!=true — every auth will fail")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8170"
	}
	log.Printf("tg-trade-miniapp backend on :%s (exchange %s, dev=%v)", port, cfg.ExchangeURL, cfg.DevMode)
	log.Fatal(http.ListenAndServe("0.0.0.0:"+port, api.New(cfg).Routes()))
}
