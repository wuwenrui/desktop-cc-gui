package messaging

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/fastclaw-ai/weclaw/agent"
	"github.com/fastclaw-ai/weclaw/ilink"
)

func TestBuildRichContentPartsIncludesQuoteAndImage(t *testing.T) {
	parts := BuildRichContentParts(
		"分析这张图",
		&QuotedMessage{
			FromUserID: "wxid_other",
			Text:       "这是被引用的消息",
		},
		[]InboundMedia{
			{Kind: "image", LocalPath: "/tmp/weclaw/inbound.png"},
		},
	)

	if len(parts) != 2 {
		t.Fatalf("expected text and image parts, got %d", len(parts))
	}
	if parts[0].Type != "text" {
		t.Fatalf("first part should be text: %#v", parts[0])
	}
	if !strings.Contains(parts[0].Text, "<wechat-quoted-message>") {
		t.Fatalf("quote context missing: %q", parts[0].Text)
	}
	if !strings.Contains(parts[0].Text, "这是被引用的消息") {
		t.Fatalf("quoted text missing: %q", parts[0].Text)
	}
	if !strings.Contains(parts[0].Text, "分析这张图") {
		t.Fatalf("current user text missing: %q", parts[0].Text)
	}
	if parts[1].Type != "image_url" || parts[1].ImageURL == nil {
		t.Fatalf("second part should be image_url: %#v", parts[1])
	}
	if parts[1].ImageURL.URL != "file:///tmp/weclaw/inbound.png" {
		t.Fatalf("unexpected image URL: %q", parts[1].ImageURL.URL)
	}
}

func TestExtractQuotedMessageFromRawItem(t *testing.T) {
	quote := ExtractQuotedMessageFromRaw([]byte(`{
		"type": 1,
		"text_item": {"text": "当前要求"},
		"refer_msg": {
			"from_user_id": "wxid_other",
			"text_item": {"text": "引用原文"}
		}
	}`))
	if quote == nil {
		t.Fatal("expected quoted message")
	}
	if quote.FromUserID != "wxid_other" {
		t.Fatalf("unexpected quote sender: %q", quote.FromUserID)
	}
	if quote.Text != "引用原文" {
		t.Fatalf("unexpected quote text: %q", quote.Text)
	}
}

func TestBuildRichContentPartsIncludesQuotedImagePart(t *testing.T) {
	quote := ExtractQuotedMessageFromRaw([]byte(`{
		"type": 1,
		"text_item": {"text": "当前要求"},
		"refer_msg": {
			"from_user_id": "wxid_other",
			"item_list": [{
				"type": 2,
				"image_item": {"url": "https://example.com/quoted.png"}
			}]
		}
	}`))
	if quote == nil {
		t.Fatal("expected quoted message")
	}
	if len(quote.Media) != 1 {
		t.Fatalf("expected one quoted media item, got %#v", quote)
	}

	parts := BuildRichContentParts("按引用图片说明", quote, nil)
	if len(parts) != 2 {
		t.Fatalf("expected text and quoted image parts, got %#v", parts)
	}
	if parts[1].ImageURL == nil || parts[1].ImageURL.URL != "https://example.com/quoted.png" {
		t.Fatalf("quoted image was not forwarded: %#v", parts[1])
	}
}

func TestExtractQuotedMessageFromCamelCaseRawItem(t *testing.T) {
	quote := ExtractQuotedMessageFromRaw([]byte(`{
		"type": 1,
		"textItem": {"text": "当前要求"},
		"referMsg": {
			"fromUserId": "wxid_other",
			"itemList": [
				{"type": 1, "textItem": {"text": "camel 引用原文"}},
				{"type": 2, "imageItem": {"imageUrl": "https://example.com/camel.png"}},
				{"type": 4, "fileItem": {"fileName": "合同.pdf"}}
			]
		}
	}`))
	if quote == nil {
		t.Fatal("expected quoted message")
	}
	if quote.FromUserID != "wxid_other" {
		t.Fatalf("unexpected quote sender: %q", quote.FromUserID)
	}
	if quote.Text != "camel 引用原文" {
		t.Fatalf("unexpected quote text: %q", quote.Text)
	}
	if len(quote.Media) != 2 {
		t.Fatalf("expected quoted image and file media, got %#v", quote.Media)
	}

	parts := BuildRichContentParts("按引用处理", quote, nil)
	if len(parts) != 2 {
		t.Fatalf("expected text and image parts, got %#v", parts)
	}
	if !strings.Contains(parts[0].Text, "file: 合同.pdf") {
		t.Fatalf("quoted file name missing from text context: %q", parts[0].Text)
	}
	if parts[1].ImageURL == nil || parts[1].ImageURL.URL != "https://example.com/camel.png" {
		t.Fatalf("camelCase quoted image was not forwarded: %#v", parts[1])
	}
}

func TestExtractQuotedMessageFromNestedPayload(t *testing.T) {
	quote := ExtractQuotedMessageFromRaw([]byte(`{
		"type": 1,
		"textItem": {"text": "这条消息什么意思"},
		"messageContext": {
			"source": {
				"quotedMessage": {
					"senderId": "wxid_other",
					"textItem": {"text": "嵌套引用原文"}
				}
			}
		}
	}`))
	if quote == nil {
		t.Fatal("expected nested quoted message")
	}
	if quote.FromUserID != "wxid_other" {
		t.Fatalf("unexpected quote sender: %q", quote.FromUserID)
	}
	if quote.Text != "嵌套引用原文" {
		t.Fatalf("unexpected quote text: %q", quote.Text)
	}
}

func TestExtractQuotedMessageFromMessageEnvelopeRaw(t *testing.T) {
	var msg ilink.WeixinMessage
	rawMessage := `{
		"messageId": 3001,
		"fromUserId": "wxid_user",
		"toUserId": "bot",
		"messageType": 1,
		"messageState": 2,
		"contextToken": "ctx",
		"referMsg": {
			"fromUserId": "wxid_other",
			"textItem": {"text": "envelope 引用原文"}
		},
		"itemList": [{
			"type": 1,
			"textItem": {"text": "按引用处理"}
		}]
	}`
	if err := json.Unmarshal([]byte(rawMessage), &msg); err != nil {
		t.Fatalf("unmarshal message: %v", err)
	}

	quote := extractQuotedMessage(msg)
	if quote == nil {
		t.Fatal("expected quoted message from envelope raw payload")
	}
	if quote.FromUserID != "wxid_other" {
		t.Fatalf("unexpected quote sender: %q", quote.FromUserID)
	}
	if quote.Text != "envelope 引用原文" {
		t.Fatalf("unexpected quote text: %q", quote.Text)
	}
}

func TestHandleMessageSendsImageAndQuoteToRichDefaultAgent(t *testing.T) {
	var logs bytes.Buffer
	oldLogOutput := log.Writer()
	log.SetOutput(&logs)
	t.Cleanup(func() {
		log.SetOutput(oldLogOutput)
	})

	receivedReplies := make(chan ilink.SendMessageRequest, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/image.png":
			w.Header().Set("Content-Type", "image/png")
			_, _ = w.Write([]byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A})
		case "/ilink/bot/getconfig":
			_, _ = w.Write([]byte(`{"ret":0,"typing_ticket":"ticket"}`))
		case "/ilink/bot/sendtyping":
			_, _ = w.Write([]byte(`{"ret":0}`))
		case "/ilink/bot/sendmessage":
			var req ilink.SendMessageRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				t.Fatalf("decode sendmessage: %v", err)
			}
			receivedReplies <- req
			_, _ = w.Write([]byte(`{"ret":0}`))
		default:
			t.Fatalf("unexpected request path: %s", r.URL.Path)
		}
	}))
	defer server.Close()

	var msg ilink.WeixinMessage
	rawMessage := `{
		"message_id": 1001,
		"from_user_id": "wxid_user",
		"to_user_id": "bot",
		"message_type": 1,
		"message_state": 2,
		"context_token": "ctx",
		"item_list": [
			{
				"type": 1,
				"text_item": {"text": "请按引用消息分析图片"},
				"refer_msg": {
					"from_user_id": "wxid_other",
					"text_item": {"text": "这是引用原文"}
				}
			},
			{
				"type": 2,
				"image_item": {"url": "` + server.URL + `/image.png"}
			}
		]
	}`
	if err := json.Unmarshal([]byte(rawMessage), &msg); err != nil {
		t.Fatalf("unmarshal message: %v", err)
	}

	richAgent := &recordingRichAgent{reply: "rich reply"}
	handler := NewHandler(nil, nil)
	handler.SetSaveDir(t.TempDir())
	handler.SetDefaultAgent("lawyer-copilot", richAgent)
	client := ilink.NewClient(&ilink.Credentials{
		BaseURL:    server.URL,
		BotToken:   "token",
		ILinkBotID: "bot",
	})

	handler.HandleMessage(context.Background(), client, msg)

	if richAgent.calledPlain {
		t.Fatal("handler used plain Chat instead of ChatRich")
	}
	if richAgent.userID != "wxid_user" {
		t.Fatalf("expected rich agent user id to preserve WeChat sender, got %q", richAgent.userID)
	}
	if len(richAgent.parts) != 2 {
		t.Fatalf("expected text and image parts, got %#v", richAgent.parts)
	}
	if !strings.Contains(richAgent.parts[0].Text, "这是引用原文") {
		t.Fatalf("quote text missing from rich agent payload: %#v", richAgent.parts[0])
	}
	if richAgent.parts[1].ImageURL == nil || !strings.HasPrefix(richAgent.parts[1].ImageURL.URL, "file://") {
		t.Fatalf("image file URL missing from rich agent payload: %#v", richAgent.parts[1])
	}
	if filepath.Ext(richAgent.parts[1].ImageURL.URL) != ".png" {
		t.Fatalf("expected saved image extension in URL, got %q", richAgent.parts[1].ImageURL.URL)
	}
	if !strings.Contains(logs.String(), "[handler] received quoted message from wxid_user") {
		t.Fatalf("quote parse log missing: %s", logs.String())
	}

	select {
	case reply := <-receivedReplies:
		if got := reply.Msg.ItemList[0].TextItem.Text; got != "rich reply" {
			t.Fatalf("unexpected reply text: %q", got)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for WeChat reply")
	}
}

func TestHandleMessageSendsProgressAckBeforeSlowDefaultAgentReply(t *testing.T) {
	receivedReplies := make(chan string, 2)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/ilink/bot/getconfig":
			_, _ = w.Write([]byte(`{"ret":0,"typing_ticket":"ticket"}`))
		case "/ilink/bot/sendtyping":
			_, _ = w.Write([]byte(`{"ret":0}`))
		case "/ilink/bot/sendmessage":
			var req ilink.SendMessageRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				t.Fatalf("decode sendmessage: %v", err)
			}
			receivedReplies <- req.Msg.ItemList[0].TextItem.Text
			_, _ = w.Write([]byte(`{"ret":0}`))
		default:
			t.Fatalf("unexpected request path: %s", r.URL.Path)
		}
	}))
	defer server.Close()

	handler := NewHandler(nil, nil)
	handler.progressAckDelay = 10 * time.Millisecond
	handler.SetDefaultAgent("lawyer-copilot", &recordingRichAgent{
		reply: "最终结果",
		delay: 60 * time.Millisecond,
	})
	client := ilink.NewClient(&ilink.Credentials{
		BaseURL:    server.URL,
		BotToken:   "token",
		ILinkBotID: "bot",
	})

	handler.HandleMessage(context.Background(), client, textMessage("wxid_user", "ctx", "整理世界杯赛事到 Excel"))

	assertNextReply(t, receivedReplies, "我先帮你查资料并整理成 Excel")
	assertNextReply(t, receivedReplies, "最终结果")
}

func TestHandleMessageDoesNotSendProgressAckForGreeting(t *testing.T) {
	receivedReplies := make(chan string, 2)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/ilink/bot/getconfig":
			_, _ = w.Write([]byte(`{"ret":0,"typing_ticket":"ticket"}`))
		case "/ilink/bot/sendtyping":
			_, _ = w.Write([]byte(`{"ret":0}`))
		case "/ilink/bot/sendmessage":
			var req ilink.SendMessageRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				t.Fatalf("decode sendmessage: %v", err)
			}
			receivedReplies <- req.Msg.ItemList[0].TextItem.Text
			_, _ = w.Write([]byte(`{"ret":0}`))
		default:
			t.Fatalf("unexpected request path: %s", r.URL.Path)
		}
	}))
	defer server.Close()

	handler := NewHandler(nil, nil)
	handler.progressAckDelay = 10 * time.Millisecond
	handler.SetDefaultAgent("lawyer-copilot", &recordingRichAgent{
		reply: "你好，我可以帮你看文件、查资料、整理表格。",
		delay: 60 * time.Millisecond,
	})
	client := ilink.NewClient(&ilink.Credentials{
		BaseURL:    server.URL,
		BotToken:   "token",
		ILinkBotID: "bot",
	})

	handler.HandleMessage(context.Background(), client, textMessage("wxid_user", "ctx", "你好"))

	assertNextReply(t, receivedReplies, "你好，我可以帮你")
	select {
	case got := <-receivedReplies:
		t.Fatalf("unexpected progress ack for greeting: %q", got)
	case <-time.After(80 * time.Millisecond):
	}
}

func TestHandleMessageDoesNotSendProgressAckForFastDefaultAgentReply(t *testing.T) {
	receivedReplies := make(chan string, 2)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/ilink/bot/getconfig":
			_, _ = w.Write([]byte(`{"ret":0,"typing_ticket":"ticket"}`))
		case "/ilink/bot/sendtyping":
			_, _ = w.Write([]byte(`{"ret":0}`))
		case "/ilink/bot/sendmessage":
			var req ilink.SendMessageRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				t.Fatalf("decode sendmessage: %v", err)
			}
			receivedReplies <- req.Msg.ItemList[0].TextItem.Text
			_, _ = w.Write([]byte(`{"ret":0}`))
		default:
			t.Fatalf("unexpected request path: %s", r.URL.Path)
		}
	}))
	defer server.Close()

	handler := NewHandler(nil, nil)
	handler.progressAckDelay = 80 * time.Millisecond
	handler.SetDefaultAgent("lawyer-copilot", &recordingRichAgent{reply: "快速结果"})
	client := ilink.NewClient(&ilink.Credentials{
		BaseURL:    server.URL,
		BotToken:   "token",
		ILinkBotID: "bot",
	})

	handler.HandleMessage(context.Background(), client, textMessage("wxid_user", "ctx", "当前目录地址是啥"))

	assertNextReply(t, receivedReplies, "快速结果")
	select {
	case got := <-receivedReplies:
		t.Fatalf("unexpected progress ack after fast reply: %q", got)
	case <-time.After(120 * time.Millisecond):
	}
}

func TestCollectInboundMediaDownloadsFileItem(t *testing.T) {
	oldDownloadFromCDN := downloadFromCDN
	defer func() {
		downloadFromCDN = oldDownloadFromCDN
	}()
	downloadFromCDN = func(_ context.Context, encryptQueryParam, aesKeyBase64 string) ([]byte, error) {
		if encryptQueryParam != "file-param" {
			t.Fatalf("unexpected CDN param: %q", encryptQueryParam)
		}
		if aesKeyBase64 != base64.StdEncoding.EncodeToString([]byte("0011223344556677")) {
			t.Fatalf("unexpected AES key: %q", aesKeyBase64)
		}
		return []byte("contract bytes"), nil
	}

	saveDir := t.TempDir()
	handler := NewHandler(nil, nil)
	handler.SetSaveDir(saveDir)

	media := handler.collectInboundMedia(context.Background(), ilink.WeixinMessage{
		FromUserID: "wxid_user",
		ItemList: []ilink.MessageItem{{
			Type: ilink.ItemTypeFile,
			FileItem: &ilink.FileItem{
				FileName: "../contract.pdf",
				Media: &ilink.MediaInfo{
					EncryptQueryParam: "file-param",
					AESKey:            base64.StdEncoding.EncodeToString([]byte("0011223344556677")),
				},
			},
		}},
	})

	if len(media) != 1 {
		t.Fatalf("expected one file media, got %#v", media)
	}
	if media[0].Kind != "file" {
		t.Fatalf("expected file media, got %#v", media[0])
	}
	if filepath.Base(media[0].LocalPath) != "contract.pdf" {
		t.Fatalf("file name was not sanitized/preserved: %#v", media[0])
	}
	if !strings.HasPrefix(media[0].LocalPath, saveDir) {
		t.Fatalf("file saved outside save dir: %q", media[0].LocalPath)
	}
	data, err := os.ReadFile(media[0].LocalPath)
	if err != nil {
		t.Fatalf("read saved file: %v", err)
	}
	if string(data) != "contract bytes" {
		t.Fatalf("unexpected saved file content: %q", data)
	}
}

func TestCollectInboundMediaDownloadsCamelCaseImageURL(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/image.png" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write([]byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A})
	}))
	defer server.Close()

	var msg ilink.WeixinMessage
	rawMessage := `{
		"messageId": 2001,
		"fromUserId": "wxid_user",
		"toUserId": "bot",
		"messageType": 1,
		"messageState": 2,
		"contextToken": "ctx",
		"itemList": [{
			"type": 2,
			"imageItem": {"url": "` + server.URL + `/image.png"}
		}]
	}`
	if err := json.Unmarshal([]byte(rawMessage), &msg); err != nil {
		t.Fatalf("unmarshal message: %v", err)
	}

	saveDir := t.TempDir()
	handler := NewHandler(nil, nil)
	handler.SetSaveDir(saveDir)

	media := handler.collectInboundMedia(context.Background(), msg)
	if len(media) != 1 {
		t.Fatalf("expected one image media, got %#v", media)
	}
	if media[0].Kind != "image" || !strings.HasPrefix(media[0].LocalPath, saveDir) {
		t.Fatalf("unexpected saved image media: %#v", media[0])
	}
	if filepath.Ext(media[0].LocalPath) != ".png" {
		t.Fatalf("expected saved image extension, got %q", media[0].LocalPath)
	}
}

func TestCollectInboundMediaDownloadsCamelCaseImageCDNMedia(t *testing.T) {
	oldDownloadFromCDN := downloadFromCDN
	defer func() {
		downloadFromCDN = oldDownloadFromCDN
	}()
	downloadFromCDN = func(_ context.Context, encryptQueryParam, aesKeyBase64 string) ([]byte, error) {
		if encryptQueryParam != "image-param" {
			t.Fatalf("unexpected CDN param: %q", encryptQueryParam)
		}
		if aesKeyBase64 != "image-key" {
			t.Fatalf("unexpected AES key: %q", aesKeyBase64)
		}
		return []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}, nil
	}

	var msg ilink.WeixinMessage
	rawMessage := `{
		"messageId": 2002,
		"fromUserId": "wxid_user",
		"toUserId": "bot",
		"messageType": 1,
		"messageState": 2,
		"contextToken": "ctx",
		"itemList": [{
			"type": 2,
			"imageItem": {
				"media": {
					"encryptQueryParam": "image-param",
					"aesKey": "image-key",
					"encryptType": 1
				},
				"midSize": 8
			}
		}]
	}`
	if err := json.Unmarshal([]byte(rawMessage), &msg); err != nil {
		t.Fatalf("unmarshal message: %v", err)
	}

	saveDir := t.TempDir()
	handler := NewHandler(nil, nil)
	handler.SetSaveDir(saveDir)

	media := handler.collectInboundMedia(context.Background(), msg)
	if len(media) != 1 {
		t.Fatalf("expected one image media, got %#v", media)
	}
	if media[0].Kind != "image" || !strings.HasPrefix(media[0].LocalPath, saveDir) {
		t.Fatalf("unexpected saved image media: %#v", media[0])
	}
}

func TestHandleMessageLogsUnsupportedMediaShapeWithoutRawContent(t *testing.T) {
	var logs bytes.Buffer
	oldLogOutput := log.Writer()
	log.SetOutput(&logs)
	t.Cleanup(func() {
		log.SetOutput(oldLogOutput)
	})

	var msg ilink.WeixinMessage
	rawMessage := `{
		"messageId": 4001,
		"fromUserId": "wxid_user",
		"toUserId": "bot",
		"messageType": 1,
		"messageState": 2,
		"contextToken": "ctx",
		"itemList": [{
			"type": 2,
			"mysteryImagePayload": {
				"secretUrl": "https://example.com/private-image.png",
				"caption": "不要写入日志"
			}
		}]
	}`
	if err := json.Unmarshal([]byte(rawMessage), &msg); err != nil {
		t.Fatalf("unmarshal message: %v", err)
	}

	handler := NewHandler(nil, nil)
	handler.HandleMessage(context.Background(), nil, msg)

	logText := logs.String()
	if !strings.Contains(logText, "[handler] unsupported non-text message from wxid_user: items=[type=2 keys=mysteryImagePayload,type]") {
		t.Fatalf("unsupported media diagnostic missing: %s", logText)
	}
	if strings.Contains(logText, "private-image.png") || strings.Contains(logText, "不要写入日志") {
		t.Fatalf("diagnostic leaked raw content: %s", logText)
	}
}

func textMessage(userID, contextToken, text string) ilink.WeixinMessage {
	return ilink.WeixinMessage{
		MessageID:    time.Now().UnixNano(),
		FromUserID:   userID,
		MessageType:  ilink.MessageTypeUser,
		MessageState: ilink.MessageStateFinish,
		ContextToken: contextToken,
		ItemList: []ilink.MessageItem{{
			Type: ilink.ItemTypeText,
			TextItem: &ilink.TextItem{
				Text: text,
			},
		}},
	}
}

func assertNextReply(t *testing.T, replies <-chan string, wantContains string) {
	t.Helper()
	select {
	case got := <-replies:
		if !strings.Contains(got, wantContains) {
			t.Fatalf("reply %q does not contain %q", got, wantContains)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for reply containing %q", wantContains)
	}
}

type recordingRichAgent struct {
	reply       string
	delay       time.Duration
	userID      string
	parts       []agent.RichContentPart
	calledPlain bool
}

func (a *recordingRichAgent) Chat(_ context.Context, _ string, _ string) (string, error) {
	if a.delay > 0 {
		time.Sleep(a.delay)
	}
	a.calledPlain = true
	return a.reply, nil
}

func (a *recordingRichAgent) ChatRich(_ context.Context, userID string, parts []agent.RichContentPart) (string, error) {
	if a.delay > 0 {
		time.Sleep(a.delay)
	}
	a.userID = userID
	a.parts = append([]agent.RichContentPart(nil), parts...)
	return a.reply, nil
}

func (a *recordingRichAgent) ResetSession(_ context.Context, _ string) (string, error) {
	return "", nil
}

func (a *recordingRichAgent) Info() agent.AgentInfo {
	return agent.AgentInfo{Name: "lawyer-copilot", Type: "http", Model: "test"}
}

func (a *recordingRichAgent) SetCwd(_ string) {}
