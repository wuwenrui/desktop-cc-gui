package ilink

import (
	"encoding/json"
	"testing"
)

func TestMessageItemPreservesRawPayloadForQuotedMessages(t *testing.T) {
	var msg WeixinMessage
	err := json.Unmarshal([]byte(`{
		"from_user_id": "wxid_user",
		"to_user_id": "bot",
		"message_type": 1,
		"message_state": 2,
		"item_list": [{
			"type": 1,
			"text_item": {"text": "帮我处理引用内容"},
			"refer_msg": {
				"from_user_id": "wxid_other",
				"text_item": {"text": "被引用的原文"}
			}
		}]
	}`), &msg)
	if err != nil {
		t.Fatalf("unmarshal message: %v", err)
	}

	if len(msg.ItemList) != 1 {
		t.Fatalf("expected one item, got %d", len(msg.ItemList))
	}
	if len(msg.ItemList[0].Raw) == 0 {
		t.Fatal("raw item payload was not preserved")
	}
	if !json.Valid(msg.ItemList[0].Raw) {
		t.Fatalf("raw item payload is not valid JSON: %s", msg.ItemList[0].Raw)
	}
	if !containsRawJSON(msg.ItemList[0].Raw, "被引用的原文") {
		t.Fatalf("raw item payload lost quoted text: %s", msg.ItemList[0].Raw)
	}
}

func TestWeixinMessageAcceptsCamelCaseEnvelopeAndItems(t *testing.T) {
	var msg WeixinMessage
	err := json.Unmarshal([]byte(`{
		"messageId": 42,
		"fromUserId": "wxid_user",
		"toUserId": "bot",
		"messageType": 1,
		"messageState": 2,
		"contextToken": "ctx",
		"itemList": [{
			"type": 2,
			"imageItem": {
				"url": "https://example.com/image.png",
				"media": {
					"encryptQueryParam": "cdn-param",
					"aesKey": "cdn-key",
					"encryptType": 1
				},
				"midSize": 123
			}
		}]
	}`), &msg)
	if err != nil {
		t.Fatalf("unmarshal message: %v", err)
	}

	if msg.MessageID != 42 || msg.FromUserID != "wxid_user" || msg.MessageState != MessageStateFinish {
		t.Fatalf("camelCase envelope was not decoded: %#v", msg)
	}
	if len(msg.ItemList) != 1 {
		t.Fatalf("camelCase itemList was not decoded: %#v", msg.ItemList)
	}
	item := msg.ItemList[0]
	if item.ImageItem == nil {
		t.Fatalf("camelCase imageItem was not decoded: %#v", item)
	}
	if item.ImageItem.URL != "https://example.com/image.png" {
		t.Fatalf("unexpected image url: %#v", item.ImageItem)
	}
	if item.ImageItem.Media == nil || item.ImageItem.Media.EncryptQueryParam != "cdn-param" || item.ImageItem.Media.AESKey != "cdn-key" {
		t.Fatalf("camelCase media was not decoded: %#v", item.ImageItem.Media)
	}
	if item.ImageItem.MidSize != 123 {
		t.Fatalf("camelCase midSize was not decoded: %#v", item.ImageItem)
	}
	if len(item.Raw) == 0 {
		t.Fatal("raw item payload was not preserved")
	}
	if len(msg.Raw) == 0 {
		t.Fatal("raw message payload was not preserved")
	}
}

func containsRawJSON(raw json.RawMessage, needle string) bool {
	var payload any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return false
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return false
	}
	return stringContains(string(encoded), needle)
}

func stringContains(haystack, needle string) bool {
	for i := 0; i+len(needle) <= len(haystack); i++ {
		if haystack[i:i+len(needle)] == needle {
			return true
		}
	}
	return false
}
