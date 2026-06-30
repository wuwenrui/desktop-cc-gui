package messaging

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/fastclaw-ai/weclaw/agent"
	"github.com/fastclaw-ai/weclaw/ilink"
	"github.com/google/uuid"
)

// AgentFactory creates an agent by config name. Returns nil if the name is unknown.
type AgentFactory func(ctx context.Context, name string) agent.Agent

// SaveDefaultFunc persists the default agent name to config file.
type SaveDefaultFunc func(name string) error

// AgentMeta holds static config info about an agent (for /status display).
type AgentMeta struct {
	Name    string
	Type    string // "acp", "cli", "http"
	Command string // binary path or endpoint
	Model   string
}

// Handler processes incoming WeChat messages and dispatches replies.
type Handler struct {
	mu            sync.RWMutex
	defaultName   string
	agents        map[string]agent.Agent // name -> running agent
	agentMetas    []AgentMeta            // all configured agents (for /status)
	agentWorkDirs map[string]string      // agent name -> configured/runtime cwd
	customAliases map[string]string      // custom alias -> agent name (from config)
	factory       AgentFactory
	saveDefault   SaveDefaultFunc
	contextTokens sync.Map // map[userID]contextToken
	saveDir       string   // directory to save images/files to
	seenMsgs      sync.Map // map[int64]time.Time — dedup by message_id

	progressAckDelay time.Duration
	progressAckText  string
}

const (
	defaultProgressAckDelay = 2 * time.Second
	defaultProgressAckText  = "收到，我先帮你处理，完成后发你。"
)

func agentContextForMessage(ctx context.Context, msg ilink.WeixinMessage) context.Context {
	if msg.MessageID == 0 {
		return ctx
	}
	return agent.WithWeChatMessageID(ctx, strconv.FormatInt(msg.MessageID, 10))
}

// NewHandler creates a new message handler.
func NewHandler(factory AgentFactory, saveDefault SaveDefaultFunc) *Handler {
	return &Handler{
		agents:           make(map[string]agent.Agent),
		agentWorkDirs:    make(map[string]string),
		factory:          factory,
		saveDefault:      saveDefault,
		progressAckDelay: defaultProgressAckDelay,
		progressAckText:  defaultProgressAckText,
	}
}

// SetSaveDir sets the directory for saving images and files.
func (h *Handler) SetSaveDir(dir string) {
	h.saveDir = dir
}

// cleanSeenMsgs removes entries older than 5 minutes from the dedup cache.
func (h *Handler) cleanSeenMsgs() {
	cutoff := time.Now().Add(-5 * time.Minute)
	h.seenMsgs.Range(func(key, value any) bool {
		if t, ok := value.(time.Time); ok && t.Before(cutoff) {
			h.seenMsgs.Delete(key)
		}
		return true
	})
}

// SetCustomAliases sets custom alias mappings from config.
func (h *Handler) SetCustomAliases(aliases map[string]string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.customAliases = aliases
}

// SetAgentMetas sets the list of all configured agents (for /status).
func (h *Handler) SetAgentMetas(metas []AgentMeta) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.agentMetas = metas
}

// SetAgentWorkDirs sets the configured working directory for each agent.
func (h *Handler) SetAgentWorkDirs(workDirs map[string]string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.agentWorkDirs = make(map[string]string, len(workDirs))
	for name, dir := range workDirs {
		h.agentWorkDirs[name] = dir
	}
}

// SetDefaultAgent sets the default agent (already started).
func (h *Handler) SetDefaultAgent(name string, ag agent.Agent) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.defaultName = name
	h.agents[name] = ag
	log.Printf("[handler] default agent ready: %s (%s)", name, ag.Info())
}

// getAgent returns a running agent by name, or starts it on demand via factory.
func (h *Handler) getAgent(ctx context.Context, name string) (agent.Agent, error) {
	// Fast path: already running
	h.mu.RLock()
	ag, ok := h.agents[name]
	h.mu.RUnlock()
	if ok {
		return ag, nil
	}

	// Slow path: create on demand
	if h.factory == nil {
		return nil, fmt.Errorf("agent %q not found and no factory configured", name)
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	// Double-check after acquiring write lock
	if ag, ok := h.agents[name]; ok {
		return ag, nil
	}

	log.Printf("[handler] starting agent %q on demand...", name)
	ag = h.factory(ctx, name)
	if ag == nil {
		return nil, fmt.Errorf("agent %q not available", name)
	}

	h.agents[name] = ag
	log.Printf("[handler] agent started on demand: %s (%s)", name, ag.Info())
	return ag, nil
}

// getDefaultAgent returns the default agent (may be nil if not ready yet).
func (h *Handler) getDefaultAgent() agent.Agent {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if h.defaultName == "" {
		return nil
	}
	return h.agents[h.defaultName]
}

// isKnownAgent checks if a name corresponds to a configured agent.
func (h *Handler) isKnownAgent(name string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	// Check running agents
	if _, ok := h.agents[name]; ok {
		return true
	}
	// Check configured agents (metas)
	for _, meta := range h.agentMetas {
		if meta.Name == name {
			return true
		}
	}
	return false
}

// agentAliases maps short aliases to agent config names.
var agentAliases = map[string]string{
	"cc":  "claude",
	"cx":  "codex",
	"oc":  "openclaw",
	"cs":  "cursor",
	"km":  "kimi",
	"gm":  "gemini",
	"ocd": "opencode",
	"pi":  "pi",
	"cp":  "copilot",
	"dr":  "droid",
	"if":  "iflow",
	"kr":  "kiro",
	"qw":  "qwen",
}

var downloadFromCDN = DownloadFileFromCDN

// resolveAlias returns the full agent name for an alias, or the original name if no alias matches.
// Checks custom aliases (from config) first, then built-in aliases.
func (h *Handler) resolveAlias(name string) string {
	h.mu.RLock()
	custom := h.customAliases
	h.mu.RUnlock()
	if custom != nil {
		if full, ok := custom[name]; ok {
			return full
		}
	}
	if full, ok := agentAliases[name]; ok {
		return full
	}
	return name
}

// parseCommand checks if text starts with "/" or "@" followed by agent name(s).
// Supports multiple agents: "@cc @cx hello" returns (["claude","codex"], "hello").
// Returns (agentNames, actualMessage). Aliases are resolved automatically.
// If no command prefix, returns (nil, originalText).
func (h *Handler) parseCommand(text string) ([]string, string) {
	if !strings.HasPrefix(text, "/") && !strings.HasPrefix(text, "@") {
		return nil, text
	}

	// Parse consecutive @name or /name tokens from the start
	var names []string
	rest := text
	for {
		rest = strings.TrimSpace(rest)
		if !strings.HasPrefix(rest, "/") && !strings.HasPrefix(rest, "@") {
			break
		}

		// Strip prefix
		after := rest[1:]
		idx := strings.IndexAny(after, " /@")
		var token string
		if idx < 0 {
			// Rest is just the name, no message
			token = after
			rest = ""
		} else if after[idx] == '/' || after[idx] == '@' {
			// Next token is another @name or /name
			token = after[:idx]
			rest = after[idx:]
		} else {
			// Space — name ends here
			token = after[:idx]
			rest = strings.TrimSpace(after[idx+1:])
		}

		if token != "" {
			names = append(names, h.resolveAlias(token))
		}

		if rest == "" {
			break
		}
	}

	// Deduplicate names preserving order
	seen := make(map[string]bool)
	unique := names[:0]
	for _, n := range names {
		if !seen[n] {
			seen[n] = true
			unique = append(unique, n)
		}
	}

	return unique, rest
}

// HandleMessage processes a single incoming message.
func (h *Handler) HandleMessage(ctx context.Context, client *ilink.Client, msg ilink.WeixinMessage) {
	// Only process user messages that are finished
	if msg.MessageType != ilink.MessageTypeUser {
		return
	}
	if msg.MessageState != ilink.MessageStateFinish {
		return
	}

	// Deduplicate by message_id to avoid processing the same message multiple times
	// (voice messages may trigger multiple finish-state updates)
	if msg.MessageID != 0 {
		if _, loaded := h.seenMsgs.LoadOrStore(msg.MessageID, time.Now()); loaded {
			return
		}
		// Clean up old entries periodically (fire-and-forget)
		go h.cleanSeenMsgs()
	}

	// Extract text from item list (text message or voice transcription)
	text := extractText(msg)
	if text == "" {
		if voiceText := extractVoiceText(msg); voiceText != "" {
			text = voiceText
			log.Printf("[handler] voice transcription from %s: %q", msg.FromUserID, truncate(text, 80))
		}
	}
	quote := extractQuotedMessage(msg)
	if quote != nil {
		log.Printf("[handler] received quoted message from %s", msg.FromUserID)
	} else if summary := summarizeQuoteCandidateShape(msg); summary != "" {
		log.Printf("[handler] unparsed quote candidate from %s: %s", msg.FromUserID, summary)
	} else if summary := summarizeInterestingMessageShape(msg); summary != "" {
		log.Printf("[handler] message shape from %s: %s", msg.FromUserID, summary)
	}
	media := h.collectInboundMedia(ctx, msg)
	hasRichPayload := quote != nil || len(media) > 0
	if text == "" && !hasRichPayload {
		log.Printf("[handler] unsupported non-text message from %s: %s", msg.FromUserID, summarizeUnsupportedMessageShape(msg))
		return
	}

	log.Printf("[handler] received from %s: %q", msg.FromUserID, truncate(text, 80))

	// Store context token for this user
	h.contextTokens.Store(msg.FromUserID, msg.ContextToken)

	// Generate a clientID for this reply (used to correlate typing → finish)
	clientID := NewClientID()

	// Intercept URLs: save to Linkhoard directly without AI agent
	trimmed := strings.TrimSpace(text)
	if !hasRichPayload && h.saveDir != "" && IsURL(trimmed) {
		rawURL := ExtractURL(trimmed)
		if rawURL != "" {
			log.Printf("[handler] saving URL to linkhoard: %s", rawURL)
			title, err := SaveLinkToLinkhoard(ctx, h.saveDir, rawURL)
			var reply string
			if err != nil {
				log.Printf("[handler] link save failed: %v", err)
				reply = fmt.Sprintf("保存失败: %v", err)
			} else {
				reply = fmt.Sprintf("已保存: %s", title)
			}
			if err := SendTextReply(ctx, client, msg.FromUserID, reply, msg.ContextToken, clientID); err != nil {
				log.Printf("[handler] failed to send reply to %s: %v", msg.FromUserID, err)
			}
			return
		}
	}

	// Built-in commands (no typing needed)
	if !hasRichPayload && trimmed == "/info" {
		reply := h.buildStatus()
		if err := SendTextReply(ctx, client, msg.FromUserID, reply, msg.ContextToken, clientID); err != nil {
			log.Printf("[handler] failed to send reply to %s: %v", msg.FromUserID, err)
		}
		return
	} else if !hasRichPayload && trimmed == "/help" {
		reply := buildHelpText()
		if err := SendTextReply(ctx, client, msg.FromUserID, reply, msg.ContextToken, clientID); err != nil {
			log.Printf("[handler] failed to send reply to %s: %v", msg.FromUserID, err)
		}
		return
	} else if !hasRichPayload && (trimmed == "/new" || trimmed == "/clear") {
		reply := h.resetDefaultSession(ctx, msg.FromUserID)
		if err := SendTextReply(ctx, client, msg.FromUserID, reply, msg.ContextToken, clientID); err != nil {
			log.Printf("[handler] failed to send reply to %s: %v", msg.FromUserID, err)
		}
		return
	} else if !hasRichPayload && strings.HasPrefix(trimmed, "/cwd") {
		reply := h.handleCwd(trimmed)
		if err := SendTextReply(ctx, client, msg.FromUserID, reply, msg.ContextToken, clientID); err != nil {
			log.Printf("[handler] failed to send reply to %s: %v", msg.FromUserID, err)
		}
		return
	} else if !hasRichPayload && isCapabilityIntroRequest(trimmed) {
		reply := h.buildCapabilityIntro()
		if err := SendTextReply(ctx, client, msg.FromUserID, reply, msg.ContextToken, clientID); err != nil {
			log.Printf("[handler] failed to send reply to %s: %v", msg.FromUserID, err)
		}
		return
	}

	// Route: "/agentname message" or "@agent1 @agent2 message" -> specific agent(s)
	agentNames, message := h.parseCommand(text)

	// No command prefix -> send to default agent
	if len(agentNames) == 0 {
		if hasRichPayload {
			h.sendRichToDefaultAgent(ctx, client, msg, text, quote, media, clientID)
			return
		}
		h.sendToDefaultAgent(ctx, client, msg, text, clientID)
		return
	}

	// No message -> switch default agent (only first name)
	if message == "" {
		if len(agentNames) == 1 && h.isKnownAgent(agentNames[0]) {
			reply := h.switchDefault(ctx, agentNames[0])
			if err := SendTextReply(ctx, client, msg.FromUserID, reply, msg.ContextToken, clientID); err != nil {
				log.Printf("[handler] failed to send reply to %s: %v", msg.FromUserID, err)
			}
		} else if len(agentNames) == 1 && !h.isKnownAgent(agentNames[0]) {
			// Unknown agent -> forward to default
			if hasRichPayload {
				h.sendRichToDefaultAgent(ctx, client, msg, text, quote, media, clientID)
			} else {
				h.sendToDefaultAgent(ctx, client, msg, text, clientID)
			}
		} else {
			reply := "Usage: specify one agent to switch, or add a message to broadcast"
			if err := SendTextReply(ctx, client, msg.FromUserID, reply, msg.ContextToken, clientID); err != nil {
				log.Printf("[handler] failed to send reply to %s: %v", msg.FromUserID, err)
			}
		}
		return
	}

	// Filter to known agents; if single unknown agent -> forward to default
	var knownNames []string
	for _, name := range agentNames {
		if h.isKnownAgent(name) {
			knownNames = append(knownNames, name)
		}
	}
	if len(knownNames) == 0 {
		// No known agents -> forward entire text to default agent
		if hasRichPayload {
			h.sendRichToDefaultAgent(ctx, client, msg, text, quote, media, clientID)
		} else {
			h.sendToDefaultAgent(ctx, client, msg, text, clientID)
		}
		return
	}

	// Send typing indicator
	go func() {
		if typingErr := SendTypingState(ctx, client, msg.FromUserID, msg.ContextToken); typingErr != nil {
			log.Printf("[handler] failed to send typing state: %v", typingErr)
		}
	}()

	if len(knownNames) == 1 {
		// Single agent
		h.sendToNamedAgent(ctx, client, msg, knownNames[0], message, clientID)
	} else {
		// Multi-agent broadcast: parallel dispatch, send replies as they arrive
		h.broadcastToAgents(ctx, client, msg, knownNames, message)
	}
}

// sendRichToDefaultAgent sends rich WeChat payload to the default agent and replies.
func (h *Handler) sendRichToDefaultAgent(ctx context.Context, client *ilink.Client, msg ilink.WeixinMessage, text string, quote *QuotedMessage, media []InboundMedia, clientID string) {
	go func() {
		if typingErr := SendTypingState(ctx, client, msg.FromUserID, msg.ContextToken); typingErr != nil {
			log.Printf("[handler] failed to send typing state: %v", typingErr)
		}
	}()
	stopProgressAck := h.startProgressAckForText(ctx, client, msg.FromUserID, msg.ContextToken, text)
	defer stopProgressAck()

	h.mu.RLock()
	defaultName := h.defaultName
	h.mu.RUnlock()

	parts := BuildRichContentParts(text, quote, media)
	ag := h.getDefaultAgent()
	var reply string
	if ag != nil {
		agentCtx := agentContextForMessage(ctx, msg)
		var err error
		reply, err = h.chatWithRichAgent(agentCtx, ag, msg.FromUserID, parts)
		if err != nil {
			reply = fmt.Sprintf("Error: %v", err)
		}
	} else {
		log.Printf("[handler] agent not ready, using echo mode for rich payload from %s", msg.FromUserID)
		reply = "[echo] " + richPartsToText(parts)
	}

	h.sendReplyWithMedia(ctx, client, msg, defaultName, reply, clientID)
}

// sendToDefaultAgent sends the message to the default agent and replies.
func (h *Handler) sendToDefaultAgent(ctx context.Context, client *ilink.Client, msg ilink.WeixinMessage, text, clientID string) {
	go func() {
		if typingErr := SendTypingState(ctx, client, msg.FromUserID, msg.ContextToken); typingErr != nil {
			log.Printf("[handler] failed to send typing state: %v", typingErr)
		}
	}()
	stopProgressAck := h.startProgressAckForText(ctx, client, msg.FromUserID, msg.ContextToken, text)
	defer stopProgressAck()

	h.mu.RLock()
	defaultName := h.defaultName
	h.mu.RUnlock()

	ag := h.getDefaultAgent()
	var reply string
	if ag != nil {
		agentCtx := agentContextForMessage(ctx, msg)
		var err error
		reply, err = h.chatWithAgent(agentCtx, ag, msg.FromUserID, text)
		if err != nil {
			reply = fmt.Sprintf("Error: %v", err)
		}
	} else {
		log.Printf("[handler] agent not ready, using echo mode for %s", msg.FromUserID)
		reply = "[echo] " + text
	}

	h.sendReplyWithMedia(ctx, client, msg, defaultName, reply, clientID)
}

// sendToNamedAgent sends the message to a specific agent and replies.
func (h *Handler) sendToNamedAgent(ctx context.Context, client *ilink.Client, msg ilink.WeixinMessage, name, message, clientID string) {
	stopProgressAck := h.startProgressAckForText(ctx, client, msg.FromUserID, msg.ContextToken, message)
	defer stopProgressAck()

	ag, agErr := h.getAgent(ctx, name)
	if agErr != nil {
		log.Printf("[handler] agent %q not available: %v", name, agErr)
		reply := fmt.Sprintf("Agent %q is not available: %v", name, agErr)
		SendTextReply(ctx, client, msg.FromUserID, reply, msg.ContextToken, clientID)
		return
	}

	agentCtx := agentContextForMessage(ctx, msg)
	reply, err := h.chatWithAgent(agentCtx, ag, msg.FromUserID, message)
	if err != nil {
		reply = fmt.Sprintf("Error: %v", err)
	}
	h.sendReplyWithMedia(ctx, client, msg, name, reply, clientID)
}

// broadcastToAgents sends the message to multiple agents in parallel.
// Each reply is sent as a separate message with the agent name prefix.
func (h *Handler) broadcastToAgents(ctx context.Context, client *ilink.Client, msg ilink.WeixinMessage, names []string, message string) {
	type result struct {
		name  string
		reply string
	}

	stopProgressAck := h.startProgressAckForText(ctx, client, msg.FromUserID, msg.ContextToken, message)
	ch := make(chan result, len(names))

	for _, name := range names {
		go func(n string) {
			ag, err := h.getAgent(ctx, n)
			if err != nil {
				ch <- result{name: n, reply: fmt.Sprintf("Error: %v", err)}
				return
			}
			agentCtx := agentContextForMessage(ctx, msg)
			reply, err := h.chatWithAgent(agentCtx, ag, msg.FromUserID, message)
			if err != nil {
				ch <- result{name: n, reply: fmt.Sprintf("Error: %v", err)}
				return
			}
			ch <- result{name: n, reply: reply}
		}(name)
	}

	// Send replies as they arrive
	for range names {
		r := <-ch
		stopProgressAck()
		reply := fmt.Sprintf("[%s] %s", r.name, r.reply)
		clientID := NewClientID()
		h.sendReplyWithMedia(ctx, client, msg, r.name, reply, clientID)
	}
}

func (h *Handler) startProgressAck(ctx context.Context, client *ilink.Client, userID, contextToken string) func() {
	return h.startProgressAckForText(ctx, client, userID, contextToken, "")
}

func (h *Handler) startProgressAckForText(ctx context.Context, client *ilink.Client, userID, contextToken, userText string) func() {
	if client == nil || h.progressAckDelay <= 0 {
		return func() {}
	}
	if shouldSuppressProgressAckForUserRequest(userText) {
		return func() {}
	}
	text := progressAckTextForUserRequest(userText)
	if strings.TrimSpace(text) == "" {
		text = h.progressAckText
	}
	if strings.TrimSpace(text) == "" {
		text = defaultProgressAckText
	}

	done := make(chan struct{})
	var once sync.Once
	go func() {
		timer := time.NewTimer(h.progressAckDelay)
		defer timer.Stop()
		select {
		case <-timer.C:
			if err := SendTextReply(ctx, client, userID, text, contextToken, NewClientID()); err != nil {
				log.Printf("[handler] failed to send progress ack to %s: %v", userID, err)
			}
		case <-done:
		case <-ctx.Done():
		}
	}()

	return func() {
		once.Do(func() {
			close(done)
		})
	}
}

func shouldSuppressProgressAckForUserRequest(text string) bool {
	compact := compactUserRequestText(text)
	if compact == "" {
		return false
	}
	switch compact {
	case "你好", "您好", "hi", "hello", "在吗", "你是谁", "ok", "收到", "好的":
		return true
	}
	if strings.Contains(compact, "连接测试") && strings.Contains(compact, "ok") {
		return true
	}
	return isCapabilityIntroRequest(text)
}

func compactUserRequestText(text string) string {
	normalized := strings.ToLower(strings.TrimSpace(text))
	if normalized == "" {
		return ""
	}
	return strings.NewReplacer(
		" ", "",
		"\t", "",
		"\n", "",
		"\r", "",
		"　", "",
		"，", "",
		"。", "",
		"？", "",
		"?", "",
		"！", "",
		"!", "",
	).Replace(normalized)
}

func isCapabilityIntroRequest(text string) bool {
	compact := compactUserRequestText(text)
	if compact == "" {
		return false
	}
	switch compact {
	case "你好", "您好", "hi", "hello", "在吗", "你是谁":
		return true
	}
	capabilityMarkers := []string{"你能做什么", "能做什么", "可以做什么", "有什么能力", "怎么用", "介绍一下", "你是谁"}
	return slices.ContainsFunc(capabilityMarkers, func(marker string) bool {
		return strings.Contains(compact, marker)
	})
}

func progressAckTextForUserRequest(text string) string {
	normalized := strings.ToLower(strings.TrimSpace(text))
	if normalized == "" {
		return defaultProgressAckText
	}

	hasExcel := strings.Contains(normalized, "excel") ||
		strings.Contains(normalized, ".xlsx") ||
		strings.Contains(normalized, "表格")
	hasResearch := strings.Contains(normalized, "查") ||
		strings.Contains(normalized, "搜") ||
		strings.Contains(normalized, "赛事") ||
		strings.Contains(normalized, "世界杯") ||
		strings.Contains(normalized, "资料")
	if hasExcel && hasResearch {
		return "收到，我先帮你查资料并整理成 Excel，完成后把文件发你。"
	}
	if hasExcel {
		return "收到，我先帮你整理 Excel 文件，完成后发你。"
	}

	if strings.Contains(normalized, "截图") ||
		strings.Contains(normalized, "截屏") ||
		strings.Contains(normalized, "截个图") {
		return "收到，我先按你说的截图，完成后发你。"
	}

	if strings.Contains(normalized, "发我") ||
		strings.Contains(normalized, "发给我") ||
		strings.Contains(normalized, "发送给我") ||
		strings.Contains(normalized, "文件") ||
		strings.Contains(normalized, "附件") {
		return "收到，我先把文件找出来发你。"
	}

	if strings.Contains(normalized, "修改") ||
		strings.Contains(normalized, "写") ||
		strings.Contains(normalized, "新建") ||
		strings.Contains(normalized, "保存") ||
		strings.Contains(normalized, "编辑") {
		return "收到，我先按你的要求处理文件，完成后把结果发你。"
	}

	if hasResearch {
		return "收到，我先查资料、整理重点，完成后发你。"
	}

	if strings.Contains(normalized, "图片") ||
		strings.Contains(normalized, "照片") ||
		strings.Contains(normalized, "图") {
		return "收到，我先看图并整理结果，完成后发你。"
	}

	return defaultProgressAckText
}

// sendReplyWithMedia sends a text reply and any extracted image URLs.
func (h *Handler) sendReplyWithMedia(ctx context.Context, client *ilink.Client, msg ilink.WeixinMessage, agentName, reply, clientID string) {
	imageURLs := ExtractImageURLs(reply)
	attachmentPaths := extractLocalAttachmentPaths(reply)
	attachmentURLs := extractRemoteAttachmentURLs(reply)
	allowedRoots := h.allowedAttachmentRoots(agentName)

	var sentPaths []string
	var failedPaths []string
	for _, attachmentPath := range attachmentPaths {
		if !isAllowedAttachmentPath(attachmentPath, allowedRoots) {
			log.Printf("[handler] rejected attachment outside allowed roots for agent %q: %s", agentName, attachmentPath)
			failedPaths = append(failedPaths, attachmentPath)
			continue
		}
		if err := SendMediaFromPath(ctx, client, msg.FromUserID, attachmentPath, msg.ContextToken); err != nil {
			log.Printf("[handler] failed to send attachment to %s: %v", msg.FromUserID, err)
			failedPaths = append(failedPaths, attachmentPath)
			continue
		}
		sentPaths = append(sentPaths, attachmentPath)
	}
	for _, attachmentURL := range attachmentURLs {
		if err := SendMediaFromURL(ctx, client, msg.FromUserID, attachmentURL, msg.ContextToken); err != nil {
			log.Printf("[handler] failed to send attachment URL to %s: %v", msg.FromUserID, err)
			failedPaths = append(failedPaths, attachmentURL)
			continue
		}
		sentPaths = append(sentPaths, attachmentURL)
	}

	reply = rewriteReplyWithAttachmentResults(reply, sentPaths, failedPaths)

	var sentImageURLs []string
	var failedImageURLs []string
	for _, imgURL := range imageURLs {
		if err := SendMediaFromURL(ctx, client, msg.FromUserID, imgURL, msg.ContextToken); err != nil {
			log.Printf("[handler] failed to send image to %s: %v", msg.FromUserID, err)
			failedImageURLs = append(failedImageURLs, imgURL)
			continue
		}
		sentImageURLs = append(sentImageURLs, imgURL)
	}
	reply = rewriteReplyWithImageResults(reply, sentImageURLs, failedImageURLs)

	if strings.TrimSpace(reply) == "" {
		log.Printf("[handler] skipped empty reply to %s", msg.FromUserID)
		return
	}
	if err := SendTextReply(ctx, client, msg.FromUserID, reply, msg.ContextToken, clientID); err != nil {
		log.Printf("[handler] failed to send reply to %s: %v", msg.FromUserID, err)
	}
}

func (h *Handler) allowedAttachmentRoots(agentName string) []string {
	roots := defaultAttachmentRoots()
	if h.saveDir != "" {
		roots = append(roots, h.saveDir)
	}

	h.mu.RLock()
	agentDir := h.agentWorkDirs[agentName]
	h.mu.RUnlock()

	if agentDir != "" {
		roots = append(roots, agentDir)
	}

	return roots
}

// chatWithAgent sends a message to an agent and returns the reply, with logging.
func (h *Handler) chatWithAgent(ctx context.Context, ag agent.Agent, userID, message string) (string, error) {
	info := ag.Info()
	log.Printf("[handler] dispatching to agent (%s) for %s", info, userID)

	start := time.Now()
	reply, err := ag.Chat(ctx, userID, message)
	elapsed := time.Since(start)

	if err != nil {
		log.Printf("[handler] agent error (%s, elapsed=%s): %v", info, elapsed, err)
		return "", err
	}

	log.Printf("[handler] agent replied (%s, elapsed=%s): %q", info, elapsed, truncate(reply, 100))
	return reply, nil
}

// chatWithRichAgent sends content parts to an agent that supports them, with text fallback.
func (h *Handler) chatWithRichAgent(ctx context.Context, ag agent.Agent, userID string, parts []agent.RichContentPart) (string, error) {
	info := ag.Info()
	log.Printf("[handler] dispatching rich payload to agent (%s) for %s", info, userID)

	start := time.Now()
	if richAgent, ok := ag.(agent.RichAgent); ok {
		reply, err := richAgent.ChatRich(ctx, userID, parts)
		elapsed := time.Since(start)
		if err != nil {
			log.Printf("[handler] rich agent error (%s, elapsed=%s): %v", info, elapsed, err)
			return "", err
		}
		log.Printf("[handler] rich agent replied (%s, elapsed=%s): %q", info, elapsed, truncate(reply, 100))
		return reply, nil
	}

	message := richPartsToText(parts)
	reply, err := ag.Chat(ctx, userID, message)
	elapsed := time.Since(start)
	if err != nil {
		log.Printf("[handler] rich fallback agent error (%s, elapsed=%s): %v", info, elapsed, err)
		return "", err
	}
	log.Printf("[handler] rich fallback agent replied (%s, elapsed=%s): %q", info, elapsed, truncate(reply, 100))
	return reply, nil
}

// switchDefault switches the default agent. Starts it on demand if needed.
// The change is persisted to config file.
func (h *Handler) switchDefault(ctx context.Context, name string) string {
	ag, err := h.getAgent(ctx, name)
	if err != nil {
		log.Printf("[handler] failed to switch default to %q: %v", name, err)
		return fmt.Sprintf("Failed to switch to %q: %v", name, err)
	}

	h.mu.Lock()
	old := h.defaultName
	h.defaultName = name
	h.agents[name] = ag
	h.mu.Unlock()

	// Persist to config file
	if h.saveDefault != nil {
		if err := h.saveDefault(name); err != nil {
			log.Printf("[handler] failed to save default agent to config: %v", err)
		} else {
			log.Printf("[handler] saved default agent %q to config", name)
		}
	}

	info := ag.Info()
	log.Printf("[handler] switched default agent: %s -> %s (%s)", old, name, info)
	return fmt.Sprintf("switch to %s", name)
}

// resetDefaultSession resets the session for the given userID on the default agent.
func (h *Handler) resetDefaultSession(ctx context.Context, userID string) string {
	ag := h.getDefaultAgent()
	if ag == nil {
		return "No agent running."
	}
	name := ag.Info().Name
	sessionID, err := ag.ResetSession(ctx, userID)
	if err != nil {
		log.Printf("[handler] reset session failed for %s: %v", userID, err)
		return fmt.Sprintf("Failed to reset session: %v", err)
	}
	if sessionID != "" {
		return fmt.Sprintf("已创建新的%s会话\n%s", name, sessionID)
	}
	return fmt.Sprintf("已创建新的%s会话", name)
}

// handleCwd handles the /cwd command. It updates the working directory for all running agents.
func (h *Handler) handleCwd(trimmed string) string {
	arg := strings.TrimSpace(strings.TrimPrefix(trimmed, "/cwd"))
	if arg == "" {
		// No path provided — show current cwd of default agent
		ag := h.getDefaultAgent()
		if ag == nil {
			return "No agent running."
		}
		info := ag.Info()
		return fmt.Sprintf("cwd: (check agent config)\nagent: %s", info.Name)
	}

	// Expand ~ to home directory
	if arg == "~" {
		home, err := os.UserHomeDir()
		if err == nil {
			arg = home
		}
	} else if strings.HasPrefix(arg, "~/") {
		home, err := os.UserHomeDir()
		if err == nil {
			arg = filepath.Join(home, arg[2:])
		}
	}

	// Resolve to absolute path
	absPath, err := filepath.Abs(arg)
	if err != nil {
		return fmt.Sprintf("Invalid path: %v", err)
	}

	// Verify directory exists
	info, err := os.Stat(absPath)
	if err != nil {
		return fmt.Sprintf("Path not found: %s", absPath)
	}
	if !info.IsDir() {
		return fmt.Sprintf("Not a directory: %s", absPath)
	}

	// Update cwd on all running agents
	h.mu.RLock()
	agents := make(map[string]agent.Agent, len(h.agents))
	for name, ag := range h.agents {
		agents[name] = ag
	}
	h.mu.RUnlock()

	for name, ag := range agents {
		ag.SetCwd(absPath)
		log.Printf("[handler] updated cwd for agent %s: %s", name, absPath)
	}

	h.mu.Lock()
	for name := range agents {
		h.agentWorkDirs[name] = absPath
	}
	h.mu.Unlock()

	return fmt.Sprintf("cwd: %s", absPath)
}

// buildStatus returns a short status string showing the current default agent.
func (h *Handler) buildStatus() string {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if h.defaultName == "" {
		return "agent: none (echo mode)"
	}

	ag, ok := h.agents[h.defaultName]
	if !ok {
		return fmt.Sprintf("agent: %s (not started)", h.defaultName)
	}

	info := ag.Info()
	return fmt.Sprintf("agent: %s\ntype: %s\nmodel: %s", h.defaultName, info.Type, info.Model)
}

func (h *Handler) buildCapabilityIntro() string {
	h.mu.RLock()
	defaultName := h.defaultName
	workDir := h.agentWorkDirs[defaultName]
	h.mu.RUnlock()

	if strings.TrimSpace(workDir) == "" {
		workDir = "未配置，可发送 /cwd /path 切换"
	}

	return fmt.Sprintf(`你好，我可以帮你通过微信操作这台电脑上的当前工作区。

当前目录：%s

我可以帮你：
- 读写文件、查看或切换目录、运行命令
- 查资料、分析图片和引用消息
- 生成 Excel、文档、图片或文件，并直接发回微信

要换目录，直接发：切换到 /path`, workDir)
}

func buildHelpText() string {
	return `Available commands:
	@agent or /agent - Switch default agent
@agent msg or /agent msg - Send to a specific agent
@a @b msg - Broadcast to multiple agents
/new or /clear - Start a new session
/cwd /path - Switch workspace directory
/info - Show current agent info
/help - Show this help message

Aliases: /cc(claude) /cx(codex) /cs(cursor) /km(kimi) /gm(gemini) /oc(openclaw) /ocd(opencode) /pi(pi) /cp(copilot) /dr(droid) /if(iflow) /kr(kiro) /qw(qwen)`
}

func extractText(msg ilink.WeixinMessage) string {
	for _, item := range msg.ItemList {
		if item.Type == ilink.ItemTypeText && item.TextItem != nil {
			return item.TextItem.Text
		}
	}
	return ""
}

func extractImage(msg ilink.WeixinMessage) *ilink.ImageItem {
	for _, item := range msg.ItemList {
		if item.Type == ilink.ItemTypeImage && item.ImageItem != nil {
			return item.ImageItem
		}
	}
	return nil
}

func extractQuotedMessage(msg ilink.WeixinMessage) *QuotedMessage {
	for _, item := range msg.ItemList {
		if quote := ExtractQuotedMessageFromRaw(item.Raw); quote != nil {
			return quote
		}
	}
	if quote := ExtractQuotedMessageFromRaw(msg.Raw); quote != nil {
		return quote
	}
	return nil
}

func extractVoiceText(msg ilink.WeixinMessage) string {
	for _, item := range msg.ItemList {
		if item.Type == ilink.ItemTypeVoice && item.VoiceItem != nil && item.VoiceItem.Text != "" {
			return item.VoiceItem.Text
		}
	}
	return ""
}

func (h *Handler) collectInboundMedia(ctx context.Context, msg ilink.WeixinMessage) []InboundMedia {
	var media []InboundMedia
	for _, item := range msg.ItemList {
		switch item.Type {
		case ilink.ItemTypeImage:
			if item.ImageItem == nil {
				continue
			}
			saved, err := h.saveInboundImage(ctx, item.ImageItem)
			if err != nil {
				log.Printf("[handler] failed to prepare inbound image from %s: %v", msg.FromUserID, err)
				continue
			}
			media = append(media, saved)
		case ilink.ItemTypeFile:
			if item.FileItem == nil {
				continue
			}
			saved, err := h.saveInboundFile(ctx, item.FileItem)
			if err != nil {
				log.Printf("[handler] failed to prepare inbound file from %s: %v", msg.FromUserID, err)
				continue
			}
			media = append(media, saved)
		case ilink.ItemTypeVideo:
			if item.VideoItem == nil {
				continue
			}
			saved, err := h.saveInboundVideo(ctx, item.VideoItem)
			if err != nil {
				log.Printf("[handler] failed to prepare inbound video from %s: %v", msg.FromUserID, err)
				continue
			}
			media = append(media, saved)
		}
	}
	return media
}

func (h *Handler) saveInboundImage(ctx context.Context, img *ilink.ImageItem) (InboundMedia, error) {
	if img == nil {
		return InboundMedia{}, fmt.Errorf("image is nil")
	}

	var data []byte
	var err error
	if img.URL != "" {
		data, _, err = downloadFile(ctx, img.URL)
	} else if img.Media != nil && img.Media.EncryptQueryParam != "" {
		data, err = downloadFromCDN(ctx, img.Media.EncryptQueryParam, img.Media.AESKey)
	} else {
		return InboundMedia{}, fmt.Errorf("image has no URL or CDN media info")
	}
	if err != nil {
		return InboundMedia{}, err
	}

	saveDir := h.inboundMediaDir()
	if err := os.MkdirAll(saveDir, 0o755); err != nil {
		return InboundMedia{}, err
	}

	ext := detectImageExt(data)
	fileName := fmt.Sprintf("%s%s", time.Now().Format("20060102-150405"), ext)
	filePath := filepath.Join(saveDir, fileName)
	if err := os.WriteFile(filePath, data, 0o644); err != nil {
		return InboundMedia{}, err
	}

	sidecarPath := filePath + ".sidecar.md"
	sidecarContent := fmt.Sprintf("---\nid: %s\n---\n", uuid.New().String())
	if err := os.WriteFile(sidecarPath, []byte(sidecarContent), 0o644); err != nil {
		log.Printf("[handler] failed to write sidecar: %v", err)
	}

	log.Printf("[handler] saved image to %s (%d bytes)", filePath, len(data))
	return InboundMedia{
		Kind:      "image",
		LocalPath: filePath,
		FileName:  fileName,
	}, nil
}

func (h *Handler) saveInboundFile(ctx context.Context, file *ilink.FileItem) (InboundMedia, error) {
	if file == nil || file.Media == nil || file.Media.EncryptQueryParam == "" {
		return InboundMedia{}, fmt.Errorf("file has no CDN media info")
	}
	data, err := downloadFromCDN(ctx, file.Media.EncryptQueryParam, file.Media.AESKey)
	if err != nil {
		return InboundMedia{}, err
	}
	fileName := sanitizeInboundFileName(file.FileName, "file.bin")
	return h.saveInboundBytes("file", fileName, data)
}

func (h *Handler) saveInboundVideo(ctx context.Context, video *ilink.VideoItem) (InboundMedia, error) {
	if video == nil || video.Media == nil || video.Media.EncryptQueryParam == "" {
		return InboundMedia{}, fmt.Errorf("video has no CDN media info")
	}
	data, err := downloadFromCDN(ctx, video.Media.EncryptQueryParam, video.Media.AESKey)
	if err != nil {
		return InboundMedia{}, err
	}
	fileName := time.Now().Format("20060102-150405") + ".mp4"
	return h.saveInboundBytes("video", fileName, data)
}

func (h *Handler) saveInboundBytes(kind, fileName string, data []byte) (InboundMedia, error) {
	saveDir := h.inboundMediaDir()
	if err := os.MkdirAll(saveDir, 0o755); err != nil {
		return InboundMedia{}, err
	}

	cleanName := sanitizeInboundFileName(fileName, "file.bin")
	filePath := filepath.Join(saveDir, cleanName)
	if _, err := os.Stat(filePath); err == nil {
		cleanName = time.Now().Format("20060102-150405") + "-" + cleanName
		filePath = filepath.Join(saveDir, cleanName)
	}
	if err := os.WriteFile(filePath, data, 0o644); err != nil {
		return InboundMedia{}, err
	}
	log.Printf("[handler] saved %s to %s (%d bytes)", kind, filePath, len(data))
	return InboundMedia{
		Kind:      kind,
		LocalPath: filePath,
		FileName:  cleanName,
	}, nil
}

func sanitizeInboundFileName(fileName, fallback string) string {
	cleanName := filepath.Base(strings.TrimSpace(fileName))
	if cleanName == "" || cleanName == "." || cleanName == string(os.PathSeparator) {
		return fallback
	}
	return cleanName
}

func (h *Handler) inboundMediaDir() string {
	if h.saveDir != "" {
		return h.saveDir
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(os.TempDir(), "weclaw-media")
	}
	return filepath.Join(home, ".weclaw", "media")
}

func (h *Handler) handleImageSave(ctx context.Context, client *ilink.Client, msg ilink.WeixinMessage, img *ilink.ImageItem) {
	clientID := NewClientID()
	log.Printf("[handler] received image from %s, saving to %s", msg.FromUserID, h.inboundMediaDir())
	saved, err := h.saveInboundImage(ctx, img)
	if err != nil {
		log.Printf("[handler] failed to save image from %s: %v", msg.FromUserID, err)
		reply := fmt.Sprintf("Failed to save image: %v", err)
		_ = SendTextReply(ctx, client, msg.FromUserID, reply, msg.ContextToken, clientID)
		return
	}

	reply := fmt.Sprintf("Saved: %s", saved.FileName)
	if err := SendTextReply(ctx, client, msg.FromUserID, reply, msg.ContextToken, clientID); err != nil {
		log.Printf("[handler] failed to send reply to %s: %v", msg.FromUserID, err)
	}
}

func richPartsToText(parts []agent.RichContentPart) string {
	var lines []string
	for _, part := range parts {
		switch part.Type {
		case "text":
			if strings.TrimSpace(part.Text) != "" {
				lines = append(lines, part.Text)
			}
		case "image_url":
			if part.ImageURL != nil && part.ImageURL.URL != "" {
				lines = append(lines, part.ImageURL.URL)
			}
		}
	}
	return strings.Join(lines, "\n")
}

func summarizeUnsupportedMessageShape(msg ilink.WeixinMessage) string {
	if len(msg.ItemList) == 0 {
		return "items=[]"
	}

	summaries := make([]string, 0, len(msg.ItemList))
	for index, item := range msg.ItemList {
		if index >= 6 {
			summaries = append(summaries, "...")
			break
		}
		keys := rawJSONKeys(item.Raw)
		if len(keys) == 0 {
			summaries = append(summaries, fmt.Sprintf("type=%d keys=[]", item.Type))
			continue
		}
		summaries = append(summaries, fmt.Sprintf("type=%d keys=%s", item.Type, strings.Join(keys, ",")))
	}
	return "items=[" + strings.Join(summaries, ";") + "]"
}

func summarizeQuoteCandidateShape(msg ilink.WeixinMessage) string {
	var summaries []string
	for index, item := range msg.ItemList {
		collectQuoteCandidateSummaries(
			item.Raw,
			fmt.Sprintf("item[%d]", index),
			0,
			&summaries,
		)
	}
	collectQuoteCandidateSummaries(msg.Raw, "message", 0, &summaries)
	if len(summaries) > 6 {
		summaries = append(summaries[:6], "...")
	}
	return strings.Join(summaries, ";")
}

func summarizeInterestingMessageShape(msg ilink.WeixinMessage) string {
	var summaries []string
	if keys := rawJSONKeys(msg.Raw); len(keys) > 0 {
		summaries = append(summaries, "message keys="+strings.Join(keys, ","))
	}
	for index, item := range msg.ItemList {
		keys := rawJSONKeys(item.Raw)
		if len(keys) == 0 {
			continue
		}
		summaries = append(
			summaries,
			fmt.Sprintf("item[%d] keys=%s", index, strings.Join(keys, ",")),
		)
		if len(summaries) >= 6 {
			break
		}
	}
	return strings.Join(summaries, ";")
}

func hasUnexpectedMessageItemKey(keys []string) bool {
	for _, key := range keys {
		switch key {
		case "type", "text_item", "textItem", "image_item", "imageItem", "voice_item", "voiceItem", "video_item", "videoItem", "file_item", "fileItem":
			continue
		default:
			return true
		}
	}
	return false
}

func collectQuoteCandidateSummaries(raw []byte, path string, depth int, summaries *[]string) {
	if len(raw) == 0 || len(*summaries) > 6 {
		return
	}
	var payload any
	if json.Unmarshal(raw, &payload) != nil {
		return
	}
	collectQuoteCandidateValueSummaries(payload, path, depth, summaries)
}

func collectQuoteCandidateValueSummaries(value any, path string, depth int, summaries *[]string) {
	if depth > 8 || len(*summaries) > 6 {
		return
	}
	switch payload := value.(type) {
	case map[string]any:
		keys := sortedMapKeys(payload)
		for _, key := range keys {
			childPath := path + "." + key
			child := payload[key]
			if isQuoteCandidateKey(key) {
				*summaries = append(*summaries, childPath+" "+safeValueShape(child))
				if len(*summaries) > 6 {
					return
				}
			}
			collectQuoteCandidateValueSummaries(child, childPath, depth+1, summaries)
		}
	case []any:
		for index, item := range payload {
			if index >= 4 {
				*summaries = append(*summaries, path+"[...]")
				return
			}
			collectQuoteCandidateValueSummaries(
				item,
				fmt.Sprintf("%s[%d]", path, index),
				depth+1,
				summaries,
			)
		}
	}
}

func isQuoteCandidateKey(key string) bool {
	normalized := normalizeQuoteKey(key)
	for _, known := range quotePayloadKeys() {
		if normalized == normalizeQuoteKey(known) {
			return true
		}
	}
	return strings.Contains(normalized, "quote") ||
		strings.Contains(normalized, "quoted") ||
		strings.Contains(normalized, "refer") ||
		strings.Contains(normalized, "reference")
}

func normalizeQuoteKey(key string) string {
	key = strings.ToLower(key)
	key = strings.ReplaceAll(key, "_", "")
	key = strings.ReplaceAll(key, "-", "")
	return key
}

func safeValueShape(value any) string {
	switch typed := value.(type) {
	case map[string]any:
		return "keys=" + strings.Join(sortedMapKeys(typed), ",")
	case []any:
		return fmt.Sprintf("items=%d", len(typed))
	case string:
		return "type=string"
	case float64:
		return "type=number"
	case bool:
		return "type=bool"
	case nil:
		return "type=null"
	default:
		return fmt.Sprintf("type=%T", value)
	}
}

func sortedMapKeys(payload map[string]any) []string {
	keys := make([]string, 0, len(payload))
	for key := range payload {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	return keys
}

func rawJSONKeys(raw []byte) []string {
	var payload map[string]any
	if len(raw) == 0 || json.Unmarshal(raw, &payload) != nil {
		return nil
	}
	keys := sortedMapKeys(payload)
	if len(keys) > 8 {
		keys = append(keys[:8], "...")
	}
	return keys
}

func detectImageExt(data []byte) string {
	if len(data) < 4 {
		return ".bin"
	}
	// PNG: 89 50 4E 47
	if data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 {
		return ".png"
	}
	// JPEG: FF D8 FF
	if data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
		return ".jpg"
	}
	// GIF: 47 49 46
	if data[0] == 0x47 && data[1] == 0x49 && data[2] == 0x46 {
		return ".gif"
	}
	// WebP: 52 49 46 46 ... 57 45 42 50
	if len(data) >= 12 && data[0] == 0x52 && data[1] == 0x49 && data[8] == 0x57 && data[9] == 0x45 {
		return ".webp"
	}
	// BMP: 42 4D
	if data[0] == 0x42 && data[1] == 0x4D {
		return ".bmp"
	}
	return ".jpg" // default to jpg for WeChat images
}
