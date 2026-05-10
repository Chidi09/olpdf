//! OLPDF Rust SDK — thin async client for the OLPDF REST API.

use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub struct OlpdfClient {
    api_key: String,
    base_url: String,
    client: reqwest::Client,
}

#[derive(Serialize)]
struct ExtractRequest<'a> {
    url: &'a str,
    mode: &'a str,
}

#[derive(Serialize)]
struct InstructionRequest<'a> {
    instruction: &'a str,
}

#[derive(Debug, Deserialize)]
pub struct ExtractResponse {
    pub blocks: Vec<Value>,
}

impl OlpdfClient {
    pub fn new(api_key: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            base_url: "https://api.olpdf.xyz".into(),
            client: reqwest::Client::new(),
        }
    }

    fn auth(&self) -> String {
        format!("Bearer {}", self.api_key)
    }

    /// Extract semantic blocks from a PDF URL.
    pub async fn extract(&self, url: &str) -> reqwest::Result<ExtractResponse> {
        self.client
            .post(format!("{}/v1/extract", self.base_url))
            .header(AUTHORIZATION, self.auth())
            .header(CONTENT_TYPE, "application/json")
            .json(&ExtractRequest { url, mode: "semantic" })
            .send()
            .await?
            .json()
            .await
    }

    /// Run a natural-language AI instruction on a document.
    pub async fn rewrite(&self, document_id: &str, instruction: &str) -> reqwest::Result<Value> {
        self.client
            .post(format!("{}/api/ai/documents/{}/instruction", self.base_url, document_id))
            .header(AUTHORIZATION, self.auth())
            .header(CONTENT_TYPE, "application/json")
            .json(&InstructionRequest { instruction })
            .send()
            .await?
            .json()
            .await
    }
}
