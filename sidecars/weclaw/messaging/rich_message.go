package messaging

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/fastclaw-ai/weclaw/agent"
)

// InboundMedia is media received from WeChat and prepared for an agent.
type InboundMedia struct {
	Kind      string
	LocalPath string
	URL       string
	FileName  string
}

// QuotedMessage carries the message that the user replied to or quoted.
type QuotedMessage struct {
	FromUserID string
	Text       string
	Media      []InboundMedia
	RawJSON    string
}

// BuildRichContentParts converts WeChat text, quote context, and media into OpenAI-compatible parts.
func BuildRichContentParts(text string, quote *QuotedMessage, media []InboundMedia) []agent.RichContentPart {
	var textBlocks []string
	if quote != nil {
		textBlocks = append(textBlocks, formatQuotedMessage(quote))
	}
	if trimmed := strings.TrimSpace(text); trimmed != "" {
		textBlocks = append(textBlocks, trimmed)
	}

	allMedia := media
	if quote != nil && len(quote.Media) > 0 {
		allMedia = append(append([]InboundMedia(nil), quote.Media...), media...)
	}

	var textAttachments []string
	var parts []agent.RichContentPart
	for _, item := range allMedia {
		if item.Kind == "image" {
			source := mediaURLSource(item)
			if source == "" {
				source = mediaTextSource(item)
				if source != "" {
					textAttachments = append(textAttachments, fmt.Sprintf("image: %s", source))
				}
				continue
			}
			parts = append(parts, agent.RichContentPart{
				Type:     "image_url",
				ImageURL: &agent.RichImageURL{URL: source},
			})
			continue
		}
		source := mediaTextSource(item)
		if source == "" {
			continue
		}
		label := item.Kind
		if label == "" {
			label = "file"
		}
		textAttachments = append(textAttachments, fmt.Sprintf("%s: %s", label, source))
	}
	if len(textAttachments) > 0 {
		textBlocks = append(textBlocks, strings.Join(textAttachments, "\n"))
	}
	if len(textBlocks) > 0 {
		parts = append([]agent.RichContentPart{{
			Type: "text",
			Text: strings.Join(textBlocks, "\n\n"),
		}}, parts...)
	}
	return parts
}

// ExtractQuotedMessageFromRaw extracts common WeChat quote/reference payload shapes.
func ExtractQuotedMessageFromRaw(raw []byte) *QuotedMessage {
	if len(raw) == 0 {
		return nil
	}
	var payload any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil
	}
	return extractQuotedMessageFromValue(payload, 0)
}

func extractQuotedMessageFromValue(value any, depth int) *QuotedMessage {
	if depth > 8 {
		return nil
	}
	switch payload := value.(type) {
	case map[string]any:
		for _, key := range quotePayloadKeys() {
			if value, ok := payload[key]; ok {
				if quote := quotedMessageFromValue(value); quote != nil {
					return quote
				}
			}
		}
		for _, value := range payload {
			if quote := extractQuotedMessageFromValue(value, depth+1); quote != nil {
				return quote
			}
		}
	case []any:
		for _, item := range payload {
			if quote := extractQuotedMessageFromValue(item, depth+1); quote != nil {
				return quote
			}
		}
	}
	return nil
}

func quotePayloadKeys() []string {
	return []string{
		"refer_msg",
		"referMsg",
		"refermsg",
		"ref_msg",
		"refMsg",
		"refer_message",
		"referMessage",
		"reference_msg",
		"referenceMsg",
		"quote_msg",
		"quoteMsg",
		"quoted_msg",
		"quotedMsg",
		"quoted_message",
		"quotedMessage",
		"quote_info",
		"quoteInfo",
		"refer_info",
		"referInfo",
		"reply_to",
		"replyTo",
		"reply_to_message",
		"replyToMessage",
		"source_message",
		"sourceMessage",
	}
}

func mediaURLSource(media InboundMedia) string {
	if media.LocalPath != "" {
		return (&url.URL{Scheme: "file", Path: media.LocalPath}).String()
	}
	return strings.TrimSpace(media.URL)
}

func mediaTextSource(media InboundMedia) string {
	if source := mediaURLSource(media); source != "" {
		return source
	}
	return strings.TrimSpace(media.FileName)
}

func formatQuotedMessage(quote *QuotedMessage) string {
	var lines []string
	lines = append(lines, "<wechat-quoted-message>")
	if quote.FromUserID != "" {
		lines = append(lines, "from: "+quote.FromUserID)
	}
	if quote.Text != "" {
		lines = append(lines, "text: "+quote.Text)
	}
	for _, media := range quote.Media {
		if source := mediaTextSource(media); source != "" {
			label := media.Kind
			if label == "" {
				label = "media"
			}
			lines = append(lines, label+": "+source)
		}
	}
	if quote.RawJSON != "" && quote.Text == "" && len(quote.Media) == 0 {
		lines = append(lines, "raw: "+quote.RawJSON)
	}
	lines = append(lines, "</wechat-quoted-message>")
	return strings.Join(lines, "\n")
}

func quotedMessageFromValue(value any) *QuotedMessage {
	if text, ok := value.(string); ok && strings.TrimSpace(text) != "" {
		return &QuotedMessage{Text: strings.TrimSpace(text)}
	}
	obj, ok := value.(map[string]any)
	if !ok {
		return nil
	}
	quote := &QuotedMessage{
		FromUserID: firstString(
			obj,
			"from_user_id",
			"fromUserId",
			"from",
			"sender",
			"sender_id",
			"senderId",
			"user_id",
			"userId",
		),
		Text:  extractNestedText(obj),
		Media: extractNestedMedia(obj),
	}
	if raw, err := json.Marshal(obj); err == nil {
		quote.RawJSON = string(raw)
	}
	if quote.FromUserID == "" && quote.Text == "" && quote.RawJSON == "" && len(quote.Media) == 0 {
		return nil
	}
	return quote
}

func extractNestedMedia(obj map[string]any) []InboundMedia {
	var media []InboundMedia
	for _, key := range []string{"image_item", "imageItem"} {
		image, ok := obj[key].(map[string]any)
		if !ok {
			continue
		}
		if imageURL := firstString(image, "url", "image_url", "imageUrl"); imageURL != "" {
			media = append(media, InboundMedia{Kind: "image", URL: imageURL})
		}
	}
	for _, key := range []string{"file_item", "fileItem"} {
		file, ok := obj[key].(map[string]any)
		if !ok {
			continue
		}
		fileName := firstString(file, "file_name", "fileName", "filename", "name")
		if fileName != "" {
			media = append(media, InboundMedia{Kind: "file", FileName: fileName})
		}
	}
	for _, key := range []string{"video_item", "videoItem"} {
		video, ok := obj[key].(map[string]any)
		if !ok {
			continue
		}
		if videoURL := firstString(video, "url", "video_url", "videoUrl"); videoURL != "" {
			media = append(media, InboundMedia{Kind: "video", URL: videoURL})
		}
	}
	if items, ok := firstAnySlice(obj, "item_list", "itemList"); ok {
		for _, item := range items {
			if nested, ok := item.(map[string]any); ok {
				media = append(media, extractNestedMedia(nested)...)
			}
		}
	}
	return media
}

func extractNestedText(obj map[string]any) string {
	if text := firstString(obj, "text", "content", "message", "summary"); text != "" {
		return text
	}
	for _, key := range []string{"text_item", "textItem"} {
		if nested, ok := obj[key].(map[string]any); ok {
			if text := firstString(nested, "text", "content"); text != "" {
				return text
			}
		}
	}
	if items, ok := firstAnySlice(obj, "item_list", "itemList"); ok {
		for _, item := range items {
			if nested, ok := item.(map[string]any); ok {
				if text := extractNestedText(nested); text != "" {
					return text
				}
			}
		}
	}
	return ""
}

func firstAnySlice(obj map[string]any, keys ...string) ([]any, bool) {
	for _, key := range keys {
		value, ok := obj[key]
		if !ok {
			continue
		}
		items, ok := value.([]any)
		if ok {
			return items, true
		}
	}
	return nil, false
}

func firstString(obj map[string]any, keys ...string) string {
	for _, key := range keys {
		value, ok := obj[key]
		if !ok {
			continue
		}
		if text, ok := value.(string); ok && strings.TrimSpace(text) != "" {
			return strings.TrimSpace(text)
		}
	}
	return ""
}
