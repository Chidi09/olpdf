// Package olpdf provides a Go client for the OLPDF REST API.
// Import: github.com/Chidi09/olpdf/packages/olpdf-go
package olpdf

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

const defaultBase = "https://api.olpdf.xyz"

// Client is a thin HTTP client for the OLPDF API.
type Client struct {
	apiKey  string
	baseURL string
	http    *http.Client
}

// New creates a new OLPDF client with the given API key.
func New(apiKey string) *Client {
	return &Client{
		apiKey:  apiKey,
		baseURL: defaultBase,
		http:    &http.Client{},
	}
}

func (c *Client) post(path string, body any) (map[string]any, error) {
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", c.baseURL+path, bytes.NewBuffer(b))
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("olpdf: %s %s", resp.Status, raw)
	}
	var out map[string]any
	json.NewDecoder(resp.Body).Decode(&out)
	return out, nil
}

// Extract parses a PDF at the given URL and returns the semantic block model.
func (c *Client) Extract(docURL string) (map[string]any, error) {
	return c.post("/v1/extract", map[string]string{"url": docURL, "mode": "semantic"})
}

// Rewrite runs a natural-language AI instruction on a document.
func (c *Client) Rewrite(documentID, instruction string) (map[string]any, error) {
	return c.post(
		fmt.Sprintf("/api/ai/documents/%s/instruction", documentID),
		map[string]string{"instruction": instruction},
	)
}
