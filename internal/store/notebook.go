package store

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"wread/internal/model"

	"github.com/google/uuid"
)

// CreateNotebook 新建笔记本并设为当前打开。
func (s *Store) CreateNotebook(title string) (model.SessionDO, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		title = "未命名笔记本"
	}
	now := time.Now().Unix()
	id := uuid.NewString()
	var out model.SessionDO
	err := s.withLock(func(db *sql.DB) error {
		if _, err := db.Exec(`
INSERT INTO sessions(id, book_name, rolling_summary, created_at, updated_at)
VALUES(?, ?, '', ?, ?)
`, id, title, now, now); err != nil {
			return err
		}
		_, err := db.Exec(`
INSERT INTO settings(key, value) VALUES(?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value
`, "session.active_id", id)
		if err != nil {
			return err
		}
		out = model.SessionDO{ID: id, NotebookName: title, CreatedAt: now, UpdatedAt: now}
		return nil
	})
	return out, err
}

// OpenNotebook 切换当前打开的笔记本。
func (s *Store) OpenNotebook(id string) (model.SessionDO, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return model.SessionDO{}, fmt.Errorf("笔记本不存在")
	}
	sess, err := s.GetSession(id)
	if err != nil {
		return model.SessionDO{}, fmt.Errorf("笔记本不存在")
	}
	if err := s.SetActiveSessionID(id); err != nil {
		return model.SessionDO{}, err
	}
	return sess, nil
}

// DeleteNotebook 删除笔记本及其目录、解读页。
func (s *Store) DeleteNotebook(id string) (model.SessionDO, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return model.SessionDO{}, fmt.Errorf("笔记本不存在")
	}
	var next model.SessionDO
	err := s.withLock(func(db *sql.DB) error {
		var exists int
		if err := db.QueryRow(`SELECT 1 FROM sessions WHERE id = ?`, id).Scan(&exists); err != nil {
			return fmt.Errorf("笔记本不存在")
		}
		active := strings.TrimSpace(s.getSettingLocked(db, "session.active_id"))
		if _, err := db.Exec(`DELETE FROM catalog_nodes WHERE session_id = ?`, id); err != nil {
			return err
		}
		if _, err := db.Exec(`DELETE FROM snaps WHERE session_id = ?`, id); err != nil {
			return err
		}
		if _, err := db.Exec(`DELETE FROM sessions WHERE id = ?`, id); err != nil {
			return err
		}
		if active != "" && active != id {
			if err := db.QueryRow(`
SELECT id, book_name, created_at, updated_at FROM sessions WHERE id = ?
`, active).Scan(&next.ID, &next.NotebookName, &next.CreatedAt, &next.UpdatedAt); err == nil {
				return nil
			}
		}
		sess, err := s.ensureActiveSessionLocked(db)
		if err != nil {
			return err
		}
		next = sess
		return nil
	})
	return next, err
}

// ensureActiveSessionLocked 确保存在有效当前笔记本并返回。
func (s *Store) ensureActiveSessionLocked(db *sql.DB) (model.SessionDO, error) {
	active := strings.TrimSpace(s.getSettingLocked(db, "session.active_id"))
	if active != "" {
		var sess model.SessionDO
		err := db.QueryRow(`
SELECT id, book_name, created_at, updated_at FROM sessions WHERE id = ?
`, active).Scan(&sess.ID, &sess.NotebookName, &sess.CreatedAt, &sess.UpdatedAt)
		if err == nil {
			return sess, nil
		}
	}
	var pickID string
	err := db.QueryRow(`SELECT id FROM sessions ORDER BY updated_at DESC LIMIT 1`).Scan(&pickID)
	if err == sql.ErrNoRows {
		now := time.Now().Unix()
		pickID = uuid.NewString()
		if _, err := db.Exec(`
INSERT INTO sessions(id, book_name, rolling_summary, created_at, updated_at)
VALUES(?, '未命名笔记本', '', ?, ?)
`, pickID, now, now); err != nil {
			return model.SessionDO{}, err
		}
		_, err = db.Exec(`
INSERT INTO settings(key, value) VALUES(?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value
`, "session.active_id", pickID)
		if err != nil {
			return model.SessionDO{}, err
		}
		return model.SessionDO{ID: pickID, NotebookName: "未命名笔记本", CreatedAt: now, UpdatedAt: now}, nil
	}
	if err != nil {
		return model.SessionDO{}, err
	}
	_, err = db.Exec(`
INSERT INTO settings(key, value) VALUES(?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value
`, "session.active_id", pickID)
	if err != nil {
		return model.SessionDO{}, err
	}
	var sess model.SessionDO
	err = db.QueryRow(`
SELECT id, book_name, created_at, updated_at FROM sessions WHERE id = ?
`, pickID).Scan(&sess.ID, &sess.NotebookName, &sess.CreatedAt, &sess.UpdatedAt)
	return sess, err
}

// getSettingLocked 在已有锁内读取设置。
func (s *Store) getSettingLocked(db *sql.DB, key string) string {
	var v string
	_ = db.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&v)
	return v
}

// SetSessionNotebookName 更新笔记本名称。
func (s *Store) SetSessionNotebookName(sessionID, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("请填写笔记本名称")
	}
	return s.withLock(func(db *sql.DB) error {
		res, err := db.Exec(`
UPDATE sessions SET book_name = ?, updated_at = ? WHERE id = ?
`, name, time.Now().Unix(), sessionID)
		if err != nil {
			return err
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			return fmt.Errorf("笔记本不存在")
		}
		return nil
	})
}
