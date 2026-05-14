package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
)

func documentObjectKey(docID string) string {
	return "documents/" + docID + ".pdf"
}

func outputObjectKey(prefix, suffix string) string {
	return prefix + "/" + suffix
}

func r2DownloadBytes(objectKey string) ([]byte, error) {
	endpoint := os.Getenv("R2_ENDPOINT")
	bucket := os.Getenv("R2_BUCKET_NAME")
	accessKey := os.Getenv("R2_ACCESS_KEY_ID")
	secretKey := os.Getenv("R2_SECRET_ACCESS_KEY")
	if endpoint == "" || bucket == "" || accessKey == "" || secretKey == "" {
		return nil, fmt.Errorf("R2 not configured")
	}

	url := fmt.Sprintf("%s/%s/%s", endpoint, bucket, objectKey)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("R2 GET %s: %s", objectKey, resp.Status)
	}

	return io.ReadAll(resp.Body)
}

func r2UploadBytes(objectKey string, data []byte, contentType string) error {
	endpoint := os.Getenv("R2_ENDPOINT")
	bucket := os.Getenv("R2_BUCKET_NAME")
	if endpoint == "" || bucket == "" {
		return fmt.Errorf("R2 not configured")
	}

	url := fmt.Sprintf("%s/%s/%s", endpoint, bucket, objectKey)
	req, err := http.NewRequest("PUT", url, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", contentType)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("R2 PUT %s: %s", objectKey, resp.Status)
	}
	return nil
}
