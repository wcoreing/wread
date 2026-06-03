package app

import (
	"context"
	"errors"
	"log"
	"sync"
	"time"

	"wread/internal/model"
	"wread/internal/overlay"
	"wread/internal/read"
)

const (
	continuousTurnDelay      = 400 * time.Millisecond
	continuousSettleDelay    = 2000 * time.Millisecond
	continuousDupSettleDelay = 2500 * time.Millisecond
	continuousMaxDupRetries  = 4
)

// continuousRead 连续伴读会话状态（运行时，非持久化）。
type continuousRead struct {
	mu        sync.Mutex
	active    bool
	gen       uint64
	dupStreak int // 连续重复页次数（翻页后 OCR 未变）
}

// GetReadSettings 读取伴读行为设置。
func (s *Service) GetReadSettings() model.ReadSettingsDO {
	return s.store.GetReadSettings()
}

// SetContinuousRead 切换连续伴读偏好；关闭时立即停止进行中的会话。
func (s *Service) SetContinuousRead(on bool) error {
	if err := s.store.SetContinuousRead(on); err != nil {
		return err
	}
	if !on {
		s.stopContinuous("")
	}
	s.emit("read:settings", s.store.GetReadSettings())
	return nil
}

// StopContinuousRead 停止连续伴读循环。
func (s *Service) StopContinuousRead() error {
	s.stopContinuous("")
	return nil
}

// IsContinuousReadRunning 连续伴读是否正在运行。
func (s *Service) IsContinuousReadRunning() bool {
	s.cont.mu.Lock()
	defer s.cont.mu.Unlock()
	return s.cont.active
}

// startContinuous 开启连续伴读会话（用户点击解读且偏好已开启时）。
func (s *Service) startContinuous() {
	s.cont.mu.Lock()
	s.cont.gen++
	s.cont.active = true
	s.cont.dupStreak = 0
	gen := s.cont.gen
	s.cont.mu.Unlock()
	s.emit("read:continuous", true)
	log.Printf("[wread] continuous read started gen=%d", gen)
}

// stopContinuous 结束连续伴读会话。
func (s *Service) stopContinuous(reason string) {
	s.cont.mu.Lock()
	if !s.cont.active {
		s.cont.mu.Unlock()
		return
	}
	s.cont.active = false
	s.cont.gen++
	s.cont.mu.Unlock()
	s.engine.CancelJob()
	if reason != "" {
		s.emit("read:continuousStop", reason)
		log.Printf("[wread] continuous read stopped: %s", reason)
	}
	s.emit("read:continuous", false)
}

// continuousOK 判断会话代际是否仍有效。
func (s *Service) continuousOK(gen uint64) bool {
	s.cont.mu.Lock()
	defer s.cont.mu.Unlock()
	return s.cont.active && s.cont.gen == gen
}

// onInterpretDoneContinuous 连续伴读：解读完成后的翻页调度。
func (s *Service) onInterpretDoneContinuous(out read.InterpretOutcome) {
	s.cont.mu.Lock()
	gen := s.cont.gen
	s.cont.mu.Unlock()

	if out.Duplicate {
		s.cont.mu.Lock()
		s.cont.dupStreak++
		streak := s.cont.dupStreak
		s.cont.mu.Unlock()
		log.Printf("[wread] continuous duplicate streak=%d", streak)
		if streak >= continuousMaxDupRetries {
			s.stopContinuous("连续伴读已停止：翻页后内容未变化，请手动翻页后继续")
			return
		}
		s.emit("read:status", "重复页，再次翻页…")
		go s.continuousTurnAndNext(gen, continuousDupSettleDelay)
		return
	}

	s.cont.mu.Lock()
	s.cont.dupStreak = 0
	s.cont.mu.Unlock()
	go s.continuousTurnAndNext(gen, continuousSettleDelay)
}

// continuousTurnAndNext 翻页并触发下一轮解读。
func (s *Service) continuousTurnAndNext(gen uint64, settleDelay time.Duration) {
	time.Sleep(continuousTurnDelay)
	if !s.continuousOK(gen) {
		return
	}
	if s.store.GetScopeMode() != "read" {
		if err := s.SetScopeMode("read"); err != nil {
			s.stopContinuous("连续伴读已停止：请切回阅读模式")
			return
		}
	}

	s.emit("read:status", "自动翻页…")
	if !overlay.TurnPage(s.workspace) {
		s.stopContinuous("连续伴读已停止：翻页失败，请检查辅助功能权限")
		return
	}

	time.Sleep(settleDelay)
	if !s.continuousOK(gen) {
		return
	}

	r := s.DefaultRegion()
	out, err := s.engine.Interpret(context.Background(), r)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			s.stopContinuous("")
		} else {
			s.stopContinuous("连续伴读已停止：" + err.Error())
		}
		return
	}
	s.onInterpretDone(out)
}
