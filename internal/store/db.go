package store

import (
	"database/sql"
	"fmt"
)

// withLock 串行化 SQLite 访问，避免 SQLITE_BUSY。
func (s *Store) withLock(fn func(db *sql.DB) error) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return fn(s.db)
}

// openSQLite 打开 SQLite 并启用 WAL 与 busy_timeout。
func openSQLite(dbPath string) (*sql.DB, error) {
	dsn := fmt.Sprintf(
		"file:%s?cache=shared&_pragma=journal_mode(WAL)&_pragma=busy_timeout(15000)&_pragma=synchronous(NORMAL)",
		dbPath,
	)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	return db, nil
}
