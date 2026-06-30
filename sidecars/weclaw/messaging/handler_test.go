package messaging

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/fastclaw-ai/weclaw/agent"
	"github.com/fastclaw-ai/weclaw/ilink"
)

func newTestHandler() *Handler {
	return &Handler{
		agents:        make(map[string]agent.Agent),
		agentWorkDirs: make(map[string]string),
	}
}

func TestParseCommand_NoPrefix(t *testing.T) {
	h := newTestHandler()
	names, msg := h.parseCommand("hello world")
	if len(names) != 0 {
		t.Errorf("expected nil names, got %v", names)
	}
	if msg != "hello world" {
		t.Errorf("expected full text, got %q", msg)
	}
}

func TestParseCommand_SlashWithAgent(t *testing.T) {
	h := newTestHandler()
	names, msg := h.parseCommand("/claude explain this code")
	if len(names) != 1 || names[0] != "claude" {
		t.Errorf("expected [claude], got %v", names)
	}
	if msg != "explain this code" {
		t.Errorf("expected 'explain this code', got %q", msg)
	}
}

func TestParseCommand_AtPrefix(t *testing.T) {
	h := newTestHandler()
	names, msg := h.parseCommand("@claude explain this code")
	if len(names) != 1 || names[0] != "claude" {
		t.Errorf("expected [claude], got %v", names)
	}
	if msg != "explain this code" {
		t.Errorf("expected 'explain this code', got %q", msg)
	}
}

func TestParseCommand_MultiAgent(t *testing.T) {
	h := newTestHandler()
	names, msg := h.parseCommand("@cc @cx hello")
	if len(names) != 2 || names[0] != "claude" || names[1] != "codex" {
		t.Errorf("expected [claude codex], got %v", names)
	}
	if msg != "hello" {
		t.Errorf("expected 'hello', got %q", msg)
	}
}

func TestParseCommand_MultiAgentDedup(t *testing.T) {
	h := newTestHandler()
	names, msg := h.parseCommand("@cc @cc hello")
	if len(names) != 1 || names[0] != "claude" {
		t.Errorf("expected [claude] (deduped), got %v", names)
	}
	if msg != "hello" {
		t.Errorf("expected 'hello', got %q", msg)
	}
}

func TestParseCommand_SwitchOnly(t *testing.T) {
	h := newTestHandler()
	names, msg := h.parseCommand("/claude")
	if len(names) != 1 || names[0] != "claude" {
		t.Errorf("expected [claude], got %v", names)
	}
	if msg != "" {
		t.Errorf("expected empty message, got %q", msg)
	}
}

func TestParseCommand_Alias(t *testing.T) {
	h := newTestHandler()
	names, msg := h.parseCommand("/cc write a function")
	if len(names) != 1 || names[0] != "claude" {
		t.Errorf("expected [claude] from /cc alias, got %v", names)
	}
	if msg != "write a function" {
		t.Errorf("expected 'write a function', got %q", msg)
	}
}

func TestParseCommand_CustomAlias(t *testing.T) {
	h := newTestHandler()
	h.customAliases = map[string]string{"ai": "claude", "c": "claude"}
	names, msg := h.parseCommand("/ai hello")
	if len(names) != 1 || names[0] != "claude" {
		t.Errorf("expected [claude] from custom alias, got %v", names)
	}
	if msg != "hello" {
		t.Errorf("expected 'hello', got %q", msg)
	}
}

func TestResolveAlias(t *testing.T) {
	h := newTestHandler()
	tests := map[string]string{
		"cc":  "claude",
		"cx":  "codex",
		"oc":  "openclaw",
		"cs":  "cursor",
		"km":  "kimi",
		"gm":  "gemini",
		"ocd": "opencode",
	}
	for alias, want := range tests {
		got := h.resolveAlias(alias)
		if got != want {
			t.Errorf("resolveAlias(%q) = %q, want %q", alias, got, want)
		}
	}
	if got := h.resolveAlias("unknown"); got != "unknown" {
		t.Errorf("resolveAlias(unknown) = %q, want %q", got, "unknown")
	}
	h.customAliases = map[string]string{"cc": "custom-claude"}
	if got := h.resolveAlias("cc"); got != "custom-claude" {
		t.Errorf("resolveAlias(cc) with custom = %q, want custom-claude", got)
	}
}

func TestBuildHelpText(t *testing.T) {
	text := buildHelpText()
	if text == "" {
		t.Error("help text is empty")
	}
	if !strings.Contains(text, "/info") {
		t.Error("help text should mention /info")
	}
	if !strings.Contains(text, "/help") {
		t.Error("help text should mention /help")
	}
}

func TestBuildCapabilityIntroMentionsCurrentWorkdir(t *testing.T) {
	h := newTestHandler()
	h.defaultName = "claude"
	h.agentWorkDirs["claude"] = "/tmp/wechat-workspace"

	text := h.buildCapabilityIntro()

	if !strings.Contains(text, "当前目录：/tmp/wechat-workspace") {
		t.Fatalf("capability intro should mention current workdir, got %q", text)
	}
	if !strings.Contains(text, "读写文件") {
		t.Fatalf("capability intro should mention file operations, got %q", text)
	}
	if !strings.Contains(text, "发回微信") {
		t.Fatalf("capability intro should mention sending files back to WeChat, got %q", text)
	}
}

func TestIsCapabilityIntroRequest(t *testing.T) {
	cases := []string{"你好", "你能做什么？", "怎么用", "你是谁"}
	for _, text := range cases {
		t.Run(text, func(t *testing.T) {
			if !isCapabilityIntroRequest(text) {
				t.Fatalf("isCapabilityIntroRequest(%q) = false, want true", text)
			}
		})
	}
	if isCapabilityIntroRequest("OK") {
		t.Fatal("isCapabilityIntroRequest(OK) = true, want false")
	}
}

func TestProgressAckTextForUserRequestUsesScenarioSpecificCopy(t *testing.T) {
	cases := []struct {
		name string
		text string
		want string
	}{
		{
			name: "research excel",
			text: "查一下当前世界杯的赛事，将赛事情况整理到Excel里面，把这个Excel文件发给我",
			want: "我先帮你查资料并整理成 Excel",
		},
		{
			name: "send file",
			text: "把这个目录下的 CLAUDE.md 文件发我",
			want: "我先把文件找出来发你",
		},
		{
			name: "screenshot",
			text: "这个目录下截个图发我看看",
			want: "我先按你说的截图",
		},
		{
			name: "edit file",
			text: "帮我修改 README",
			want: "我先按你的要求处理文件",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := progressAckTextForUserRequest(tc.text)
			if !strings.Contains(got, tc.want) {
				t.Fatalf("progressAckTextForUserRequest(%q) = %q, want to contain %q", tc.text, got, tc.want)
			}
		})
	}
}

func TestShouldSuppressProgressAckForHandshakeMessages(t *testing.T) {
	cases := []string{
		"连接测试：请回复 OK",
		"连接测试：请只回复 OK。",
		"OK",
		"ok",
		"好的",
	}

	for _, text := range cases {
		t.Run(text, func(t *testing.T) {
			if !shouldSuppressProgressAckForUserRequest(text) {
				t.Fatalf("shouldSuppressProgressAckForUserRequest(%q) = false, want true", text)
			}
		})
	}
}

func TestAgentContextForMessageCarriesWeChatMessageID(t *testing.T) {
	ctx := agentContextForMessage(context.Background(), ilink.WeixinMessage{
		MessageID: 1782292707123,
	})

	if got := agent.WeChatMessageIDFromContext(ctx); got != "1782292707123" {
		t.Fatalf("WeChat message id in context = %q, want real message id", got)
	}
}

func TestSummarizeQuoteCandidateShapeOmitsRawContent(t *testing.T) {
	var msg ilink.WeixinMessage
	err := json.Unmarshal([]byte(`{
		"fromUserId": "wxid_user",
		"toUserId": "bot",
		"messageType": 1,
		"messageState": 2,
		"itemList": [{
			"type": 1,
			"textItem": {"text": "这条消息什么意思"},
			"quotePayload": {"unknownText": "不要泄露这段引用正文"}
		}]
	}`), &msg)
	if err != nil {
		t.Fatalf("unmarshal message: %v", err)
	}

	summary := summarizeQuoteCandidateShape(msg)
	if !strings.Contains(summary, "item[0].quotePayload") {
		t.Fatalf("expected quote payload path, got %q", summary)
	}
	if strings.Contains(summary, "不要泄露这段引用正文") {
		t.Fatalf("diagnostic leaked raw content: %s", summary)
	}
}

func TestSummarizeInterestingMessageShapeOmitsRawContent(t *testing.T) {
	var msg ilink.WeixinMessage
	err := json.Unmarshal([]byte(`{
		"fromUserId": "wxid_user",
		"toUserId": "bot",
		"messageType": 1,
		"messageState": 2,
		"contextToken": "ctx-secret",
		"itemList": [{
			"type": 1,
			"textItem": {"text": "不要泄露当前正文"},
			"mysteryContext": {"message": "不要泄露上下文正文"}
		}]
	}`), &msg)
	if err != nil {
		t.Fatalf("unmarshal message: %v", err)
	}

	summary := summarizeInterestingMessageShape(msg)
	if !strings.Contains(summary, "item[0] keys=mysteryContext,textItem,type") {
		t.Fatalf("expected item key summary, got %q", summary)
	}
	if strings.Contains(summary, "不要泄露") || strings.Contains(summary, "ctx-secret") {
		t.Fatalf("diagnostic leaked raw content: %s", summary)
	}
}

func TestSummarizeInterestingMessageShapeIncludesPlainEnvelopeOnly(t *testing.T) {
	var msg ilink.WeixinMessage
	err := json.Unmarshal([]byte(`{
		"fromUserId": "wxid_user",
		"toUserId": "bot",
		"messageType": 1,
		"messageState": 2,
		"contextToken": "ctx-secret",
		"itemList": [{
			"type": 1,
			"textItem": {"text": "不要泄露普通正文"}
		}]
	}`), &msg)
	if err != nil {
		t.Fatalf("unmarshal message: %v", err)
	}

	summary := summarizeInterestingMessageShape(msg)
	if !strings.Contains(summary, "message keys=") {
		t.Fatalf("expected message key summary, got %q", summary)
	}
	if !strings.Contains(summary, "item[0] keys=textItem,type") {
		t.Fatalf("expected item key summary, got %q", summary)
	}
	if strings.Contains(summary, "不要泄露") || strings.Contains(summary, "ctx-secret") {
		t.Fatalf("diagnostic leaked raw content: %s", summary)
	}
}
