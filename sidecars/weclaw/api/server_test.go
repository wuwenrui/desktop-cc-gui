package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandleSendValidatesMediaPath(t *testing.T) {
	server := NewServer(nil, "")

	req := httptest.NewRequest(http.MethodPost, "/api/send", strings.NewReader(`{"to":"user@im.wechat","media_path":"report.xlsx"}`))
	rec := httptest.NewRecorder()
	server.handleSend(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("relative media_path status = %d, want %d", rec.Code, http.StatusBadRequest)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/send", strings.NewReader(`{"to":"user@im.wechat","media_path":"/tmp/report.xlsx"}`))
	rec = httptest.NewRecorder()
	server.handleSend(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("absolute media_path status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}

func TestHandleSendRequiresContent(t *testing.T) {
	server := NewServer(nil, "")

	req := httptest.NewRequest(http.MethodPost, "/api/send", strings.NewReader(`{"to":"user@im.wechat"}`))
	rec := httptest.NewRecorder()
	server.handleSend(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("empty content status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}
