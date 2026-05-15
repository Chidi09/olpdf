# olpdf-embed

Lightweight iframe SDK for embedding the OLPDF editor.

## Usage

```js
import { OlPDFEmbed } from "@olpdf/embed";

const editor = new OlPDFEmbed(document.getElementById("editor"), {
  host: "https://olpdf.xyz",
  documentId: "doc_123",
  token: "jwt_or_api_key"
});

editor.on("save", (payload) => console.log(payload));
```
