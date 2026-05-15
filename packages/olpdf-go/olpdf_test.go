package olpdf

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestExtractPostsToV1(t *testing.T) {
	var capturedPath string
	var capturedBody map[string]string

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedPath = r.URL.Path
		json.NewDecoder(r.Body).Decode(&capturedBody)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"blocks": []}`))
	}))
	defer ts.Close()

	client := &Client{
		apiKey:  "test-key",
		baseURL: ts.URL,
		http:    ts.Client(),
	}

	result, err := client.Extract("https://example.com/doc.pdf")
	if err != nil {
		t.Fatal(err)
	}

	if capturedPath != "/v1/extract" {
		t.Errorf("expected /v1/extract, got %s", capturedPath)
	}

	if capturedBody["url"] != "https://example.com/doc.pdf" {
		t.Errorf("expected url in body, got %v", capturedBody)
	}

	if result["blocks"] == nil {
		t.Error("expected blocks in response")
	}
}
