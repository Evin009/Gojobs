package db

import (
	"context"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

var pool *pgxpool.Pool

// Connect opens the connection pool and pings it, crashing on failure since
// the app is useless without a DB. Must be called once before any other
// function in this package.
func Connect() *pgxpool.Pool {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, relying on real environment variables")
	}

	connString := os.Getenv("DATABASE_URL")

	p, err := pgxpool.New(context.Background(), connString)
	if err != nil {
		log.Fatalf("failed to create connection pool: %v", err)
	}

	if err := p.Ping(context.Background()); err != nil {
		log.Fatalf("failed to ping database: %v", err)
	}

	pool = p
	return pool
}
