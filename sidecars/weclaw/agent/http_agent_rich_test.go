package agent

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestNewHTTPAgentAllowsLongWeChatBridgeTurns(t *testing.T) {
	httpAgent := NewHTTPAgent(HTTPAgentConfig{Endpoint: "http://127.0.0.1:18012/v1/chat/completions"})

	if httpAgent.httpClient.Timeout < 15*time.Minute {
		t.Fatalf("HTTP agent timeout = %s, want at least 15m for long WeChat tasks", httpAgent.httpClient.Timeout)
	}
}

func TestHTTPAgentForwardsWeChatMessageIDHeader(t *testing.T) {
	var requestMessageIDHeader string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestMessageIDHeader = r.Header.Get("x-weclaw-msg-id")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"ok"}}]}`))
	}))
	defer server.Close()

	httpAgent := NewHTTPAgent(HTTPAgentConfig{Endpoint: server.URL})
	ctx := WithWeChatMessageID(context.Background(), "1782292707123")

	if _, err := httpAgent.Chat(ctx, "wxid_user", "同一句话也要作为新消息处理"); err != nil {
		t.Fatalf("Chat returned error: %v", err)
	}
	if requestMessageIDHeader != "1782292707123" {
		t.Fatalf("x-weclaw-msg-id = %q, want real WeChat message id", requestMessageIDHeader)
	}
}

func TestHTTPAgentChatRichSendsContentPartsAndParsesRichReply(t *testing.T) {
	var requestBody map[string]any
	var requestUserHeader string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestUserHeader = r.Header.Get("x-weclaw-user")
		if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
		"choices": [{
			"message": {
				"content": [
					{"type": "text", "text": "看到了图片"},
					{"type": "image_url", "image_url": {"url": "https://example.com/out.png"}},
					{"type": "image_url", "image_url": {"url": "file:///tmp/out.jpg"}},
					{"type": "image_url", "image_url": {"url": "file:///tmp/%E5%BE%AE%E4%BF%A1%20%E5%9B%BE%E7%89%87.png"}},
					{"type": "file_url", "file_url": {"url": "file:///tmp/report.pdf"}}
				]
			}
		}]
	}`))
	}))
	defer server.Close()

	httpAgent := NewHTTPAgent(HTTPAgentConfig{
		Endpoint: server.URL,
		Model:    "bridge-test",
	})

	reply, err := httpAgent.ChatRich(context.Background(), "wxid_rich", []RichContentPart{
		{Type: "text", Text: "请分析这张图"},
		{Type: "image_url", ImageURL: &RichImageURL{URL: "file:///tmp/in.jpg"}},
	})
	if err != nil {
		t.Fatalf("ChatRich returned error: %v", err)
	}
	if requestBody["user"] != "wxid_rich" {
		t.Fatalf("request user should carry conversation id, got %#v", requestBody["user"])
	}
	if requestUserHeader != "wxid_rich" {
		t.Fatalf("x-weclaw-user should carry conversation id, got %q", requestUserHeader)
	}

	messages := requestBody["messages"].([]any)
	user := messages[len(messages)-1].(map[string]any)
	content := user["content"].([]any)
	if content[0].(map[string]any)["text"] != "请分析这张图" {
		t.Fatalf("text part not forwarded: %#v", content[0])
	}
	imageURL := content[1].(map[string]any)["image_url"].(map[string]any)["url"]
	if imageURL != "file:///tmp/in.jpg" {
		t.Fatalf("image part not forwarded: %#v", content[1])
	}

	if !strings.Contains(reply, "看到了图片") {
		t.Fatalf("text content missing from rich reply: %q", reply)
	}
	if !strings.Contains(reply, "![image](https://example.com/out.png)") {
		t.Fatalf("remote image URL not converted to markdown: %q", reply)
	}
	if !strings.Contains(reply, "/tmp/out.jpg") {
		t.Fatalf("local file URL not converted to attachment path: %q", reply)
	}
	if !strings.Contains(reply, "/tmp/微信 图片.png") {
		t.Fatalf("encoded local file URL not decoded to attachment path: %q", reply)
	}
	if !strings.Contains(reply, "/tmp/report.pdf") {
		t.Fatalf("file URL not converted to attachment path: %q", reply)
	}
}
