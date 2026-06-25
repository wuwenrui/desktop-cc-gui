package agent

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type contextKey string

const weChatMessageIDContextKey contextKey = "wechat-message-id"

// WithWeChatMessageID stores the upstream WeChat message id for bridge calls.
func WithWeChatMessageID(ctx context.Context, messageID string) context.Context {
	messageID = strings.TrimSpace(messageID)
	if messageID == "" {
		return ctx
	}
	return context.WithValue(ctx, weChatMessageIDContextKey, messageID)
}

// WeChatMessageIDFromContext returns the upstream WeChat message id, if present.
func WeChatMessageIDFromContext(ctx context.Context) string {
	value, _ := ctx.Value(weChatMessageIDContextKey).(string)
	return strings.TrimSpace(value)
}

// AgentInfo holds metadata about an agent for logging/debugging.
type AgentInfo struct {
	Name    string // e.g. "claude-acp", "claude", "gpt-4o"
	Type    string // e.g. "acp", "cli", "http"
	Model   string // e.g. "sonnet", "gpt-4o-mini"
	Command string // binary path, e.g. "/usr/local/bin/claude-agent-acp"
	PID     int    // subprocess PID (0 if not applicable, e.g. http agent)
}

// RichImageURL is an OpenAI-compatible image_url content payload.
type RichImageURL struct {
	URL string `json:"url"`
}

// RichFileURL is an OpenAI-compatible file_url content payload.
type RichFileURL struct {
	URL string `json:"url"`
}

// RichContentPart is a user or assistant content part.
type RichContentPart struct {
	Type     string        `json:"type"`
	Text     string        `json:"text,omitempty"`
	ImageURL *RichImageURL `json:"image_url,omitempty"`
	FileURL  *RichFileURL  `json:"file_url,omitempty"`
}

// RichAgent accepts OpenAI-compatible content parts.
type RichAgent interface {
	ChatRich(ctx context.Context, conversationID string, parts []RichContentPart) (string, error)
}

// String returns a human-readable summary for logging.
func (i AgentInfo) String() string {
	s := fmt.Sprintf("name=%s, type=%s, model=%s, command=%s", i.Name, i.Type, i.Model, i.Command)
	if i.PID > 0 {
		s += fmt.Sprintf(", pid=%d", i.PID)
	}
	return s
}

// defaultWorkspace returns ~/.weclaw/workspace as the default working directory.
func defaultWorkspace() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return os.TempDir()
	}
	dir := filepath.Join(home, ".weclaw", "workspace")
	os.MkdirAll(dir, 0o755)
	return dir
}

// mergeEnv merges extra environment variables into the base environment.
func mergeEnv(base []string, extra map[string]string) ([]string, error) {
	if len(extra) == 0 {
		return base, nil
	}

	merged := append([]string(nil), base...)
	indexByKey := make(map[string]int, len(base))
	for i, entry := range merged {
		key, _, found := strings.Cut(entry, "=")
		if !found || key == "" {
			continue
		}
		indexByKey[key] = i
	}

	newKeys := make([]string, 0, len(extra))
	for key, value := range extra {
		if key == "" || strings.Contains(key, "=") {
			return nil, fmt.Errorf("invalid env key %q", key)
		}
		entry := key + "=" + value
		if idx, ok := indexByKey[key]; ok {
			merged[idx] = entry
			continue
		}
		newKeys = append(newKeys, key)
	}

	sort.Strings(newKeys)
	for _, key := range newKeys {
		merged = append(merged, key+"="+extra[key])
	}

	return merged, nil
}

// Agent is the interface for AI chat agents.
type Agent interface {
	// Chat sends a message to the agent and returns the response.
	// conversationID is used to maintain conversation history per user.
	Chat(ctx context.Context, conversationID string, message string) (string, error)

	// ResetSession clears the existing session for the given conversationID and
	// starts a new one. Returns the new session ID if immediately available
	// (ACP mode), or an empty string if the ID will be assigned on next Chat
	// (CLI mode) or is not applicable (HTTP mode).
	ResetSession(ctx context.Context, conversationID string) (string, error)

	// Info returns metadata about this agent.
	Info() AgentInfo

	// SetCwd changes the working directory for subsequent operations.
	SetCwd(cwd string)
}
