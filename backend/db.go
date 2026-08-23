package main

import (
	"context"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

var dbPool *pgxpool.Pool


func connectDB() *pgxpool.Pool {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, relying on real environment variables")
	}

	connString := os.Getenv("DATABASE_URL")

	pool, err := pgxpool.New(context.Background(), connString)
	if err != nil {
		log.Fatalf("failed to create connection pool: %v", err)
	}

	if err := pool.Ping(context.Background()); err != nil {
		log.Fatalf("failed to ping database: %v", err)
	}

	return pool
}
