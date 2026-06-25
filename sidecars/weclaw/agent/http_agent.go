package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const defaultHTTPAgentTimeout = 16 * time.Minute

// ChatMessage represents a single message in a conversation.
type ChatMessage struct {
	Role    string `json:"role"`
	Content any    `json:"content"`
}

// HTTPAgent is an OpenAI-compatible chat completions API client.
type HTTPAgent struct {
	endpoint     string
	apiKey       string
	headers      map[string]string
	model        string
	systemPrompt string
	httpClient   *http.Client
	mu           sync.Mutex
	history      map[string][]ChatMessage // conversationID -> messages
	maxHistory   int
}

// HTTPAgentConfig holds configuration for the HTTP agent.
type HTTPAgentConfig struct {
	Endpoint     string
	APIKey       string
	Headers      map[string]string
	Model        string
	SystemPrompt string
	MaxHistory   int
}

// NewHTTPAgent creates a new OpenAI-compatible HTTP agent.
func NewHTTPAgent(cfg HTTPAgentConfig) *HTTPAgent {
	if cfg.MaxHistory == 0 {
		cfg.MaxHistory = 20
	}
	if cfg.Model == "" {
		cfg.Model = "gpt-4o-mini"
	}
	return &HTTPAgent{
		endpoint:     cfg.Endpoint,
		apiKey:       cfg.APIKey,
		headers:      cfg.Headers,
		model:        cfg.Model,
		systemPrompt: cfg.SystemPrompt,
		httpClient:   &http.Client{Timeout: defaultHTTPAgentTimeout},
		history:      make(map[string][]ChatMessage),
		maxHistory:   cfg.MaxHistory,
	}
}

// Info returns metadata about this agent.
func (a *HTTPAgent) Info() AgentInfo {
	return AgentInfo{
		Name:    "http",
		Type:    "http",
		Model:   a.model,
		Command: a.endpoint,
	}
}

// SetCwd is a no-op for HTTP agents (they have no working directory).
func (a *HTTPAgent) SetCwd(_ string) {}

// ResetSession clears the conversation history for the given conversationID.
// HTTP agents have no server-side session ID, so an empty string is returned.
func (a *HTTPAgent) ResetSession(_ context.Context, conversationID string) (string, error) {
	a.mu.Lock()
	delete(a.history, conversationID)
	a.mu.Unlock()
	return "", nil
}

// Chat sends a message to the OpenAI-compatible API and returns the response.
func (a *HTTPAgent) Chat(ctx context.Context, conversationID string, message string) (string, error) {
	return a.chatWithContent(ctx, conversationID, message)
}

// ChatRich sends OpenAI-compatible content parts to the API and returns the response.
func (a *HTTPAgent) ChatRich(ctx context.Context, conversationID string, parts []RichContentPart) (string, error) {
	return a.chatWithContent(ctx, conversationID, parts)
}

func (a *HTTPAgent) chatWithContent(ctx context.Context, conversationID string, content any) (string, error) {
	a.mu.Lock()
	messages := a.buildMessages(conversationID, content)
	a.mu.Unlock()

	reqBody := map[string]interface{}{
		"model":    a.model,
		"messages": messages,
	}
	if userID := safeHeaderValue(conversationID); userID != "" {
		reqBody["user"] = userID
	}

	data, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.endpoint, bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if a.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+a.apiKey)
	}
	for k, v := range a.headers {
		req.Header.Set(k, v)
	}
	if userID := safeHeaderValue(conversationID); userID != "" {
		req.Header.Set("X-WeClaw-User", userID)
	}
	if messageID := safeHeaderValue(WeChatMessageIDFromContext(ctx)); messageID != "" {
		req.Header.Set("X-WeClaw-Msg-Id", messageID)
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("HTTP request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API error HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content json.RawMessage `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse response: %w", err)
	}

	if len(result.Choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}

	reply, err := richContentToText(result.Choices[0].Message.Content)
	if err != nil {
		return "", err
	}

	// Save to history
	a.mu.Lock()
	a.history[conversationID] = append(a.history[conversationID],
		ChatMessage{Role: "user", Content: content},
		ChatMessage{Role: "assistant", Content: reply},
	)
	// Trim history
	if len(a.history[conversationID]) > a.maxHistory*2 {
		a.history[conversationID] = a.history[conversationID][len(a.history[conversationID])-a.maxHistory*2:]
	}
	a.mu.Unlock()

	return reply, nil
}

func safeHeaderValue(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	return strings.Map(func(r rune) rune {
		if r == '\r' || r == '\n' {
			return -1
		}
		return r
	}, value)
}

func (a *HTTPAgent) buildMessages(conversationID string, content any) []ChatMessage {
	var messages []ChatMessage
	if a.systemPrompt != "" {
		messages = append(messages, ChatMessage{Role: "system", Content: a.systemPrompt})
	}
	if hist, ok := a.history[conversationID]; ok {
		messages = append(messages, hist...)
	}
	messages = append(messages, ChatMessage{Role: "user", Content: content})
	return messages
}

func richContentToText(raw json.RawMessage) (string, error) {
	var text string
	if err := json.Unmarshal(raw, &text); err == nil {
		return text, nil
	}

	var parts []RichContentPart
	if err := json.Unmarshal(raw, &parts); err != nil {
		return "", fmt.Errorf("parse response content: %w", err)
	}

	var lines []string
	for _, part := range parts {
		switch part.Type {
		case "text":
			if strings.TrimSpace(part.Text) != "" {
				lines = append(lines, part.Text)
			}
		case "image_url":
			if part.ImageURL == nil || strings.TrimSpace(part.ImageURL.URL) == "" {
				continue
			}
			imageURL := strings.TrimSpace(part.ImageURL.URL)
			if strings.HasPrefix(imageURL, "file://") {
				path, err := fileURLToPath(imageURL)
				if err == nil && path != "" {
					lines = append(lines, path)
					continue
				}
			}
			lines = append(lines, fmt.Sprintf("![image](%s)", imageURL))
		case "file_url":
			if part.FileURL == nil || strings.TrimSpace(part.FileURL.URL) == "" {
				continue
			}
			fileURL := strings.TrimSpace(part.FileURL.URL)
			if strings.HasPrefix(fileURL, "file://") {
				path, err := fileURLToPath(fileURL)
				if err == nil && path != "" {
					lines = append(lines, path)
					continue
				}
			}
			lines = append(lines, fileURL)
		}
	}
	return strings.Join(lines, "\n"), nil
}

func fileURLToPath(fileURL string) (string, error) {
	parsed, err := url.Parse(fileURL)
	if err != nil {
		return "", err
	}
	if parsed.Scheme != "file" {
		return "", fmt.Errorf("not a file URL: %s", fileURL)
	}
	if parsed.Host != "" {
		return "//" + parsed.Host + parsed.Path, nil
	}
	return parsed.Path, nil
}
